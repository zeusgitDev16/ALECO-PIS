/**
 * Server-side poster capture (Puppeteer → Cloudinary) and optional fallback listing image.
 * Used by POST /interruptions/:id/poster-capture and idle regeneration after POST/PUT.
 */

import { Buffer } from 'node:buffer';
import { cloudinary } from '../../cloudinaryConfig.js';
import { getPublicPosterPageUrl } from '../utils/posterCaptureUrl.js';
import {
  getAlecoInterruptionsPosterExtrasSupported,
  getAlecoInterruptionsDeletedAtSupported,
  getAlecoInterruptionsPulledFromFeedAtSupported,
} from '../utils/interruptionsDbSupport.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { mapRowToDto } from '../utils/interruptionsDto.js';
import { shareHeadlineFromType, shareDescriptionFromDto, escapeHtmlAttr } from '../utils/interruptionShareHtml.js';

/** @param {import('mysql2').RowDataPacket} r */
export function rowPosterDigest(r) {
  if (!r) return '';
  const g =
    r.affected_areas_grouped != null
      ? typeof r.affected_areas_grouped === 'string'
        ? r.affected_areas_grouped
        : JSON.stringify(r.affected_areas_grouped)
      : '';
  return JSON.stringify({
    t: r.type,
    s: r.status,
    a: String(r.affected_areas ?? ''),
    g,
    f: r.feeder,
    fi: r.feeder_id,
    c: r.cause,
    cc: r.cause_category,
    b: r.body,
    cn: r.control_no,
    iu: r.image_url,
    ds: r.date_time_start,
    de: r.date_time_end_estimated,
    dr: r.date_time_restored,
    pv: r.public_visible_at,
    pf: r.pulled_from_feed_at,
    da: r.deleted_at,
  });
}

/**
 * @param {import('mysql2').RowDataPacket|null|undefined} prev
 * @param {import('mysql2').RowDataPacket|null|undefined} next
 */
export function posterRelevantFieldsChanged(prev, next) {
  if (!prev || !next) return true;
  return rowPosterDigest(prev) !== rowPosterDigest(next);
}

/**
 * @param {object} dto - mapRowToDto shape
 */
export function buildFallbackListingHtml(dto) {
  const title = escapeHtmlAttr(shareHeadlineFromType(dto.type));
  const desc = escapeHtmlAttr(shareDescriptionFromDto(dto));
  const feeder = escapeHtmlAttr(dto.feeder || '—');
  const control = dto.controlNo ? escapeHtmlAttr(String(dto.controlNo)) : '';
  const areas = Array.isArray(dto.affectedAreas) ? dto.affectedAreas.map((x) => escapeHtmlAttr(String(x))) : [];
  const start = dto.dateTimeStart ? escapeHtmlAttr(String(dto.dateTimeStart)) : '—';
  const end = dto.dateTimeEndEstimated ? escapeHtmlAttr(String(dto.dateTimeEndEstimated)) : '—';
  const status = escapeHtmlAttr(String(dto.status || ''));
  const areaHtml = areas.length
    ? `<ul>${areas.map((a) => `<li>${a}</li>`).join('')}</ul>`
    : '<p>—</p>';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<style>
  body { font-family: system-ui, Segoe UI, Roboto, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
  .card { max-width: 720px; margin: 0 auto; background: #fff; border: 2px solid #1e3a8a; border-radius: 12px; padding: 20px; }
  h1 { font-size: 1.1rem; margin: 0 0 8px; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta { font-size: 0.85rem; color: #334155; margin-bottom: 12px; }
  h2 { font-size: 0.75rem; text-transform: uppercase; color: #b91c1c; margin: 16px 0 6px; }
  .box { background: #e0e7ff; padding: 10px 12px; border-radius: 8px; font-size: 0.85rem; }
  ul { margin: 8px 0 0 18px; padding: 0; }
</style></head><body>
<div class="card">
  <h1>${title}</h1>
  <div class="meta">${desc}</div>
  ${control ? `<p><strong>Reference:</strong> ${control}</p>` : ''}
  <p><strong>Status:</strong> ${status}</p>
  <p><strong>Start:</strong> ${start} &nbsp; <strong>ERT:</strong> ${end}</p>
  <h2>Substation / feeder</h2>
  <div class="box">${feeder}</div>
  <h2>Affected areas</h2>
  <div class="box">${areaHtml}</div>
</div>
</body></html>`;
}

/**
 * Same rules as `GET /api/public/interruptions/:id` and `publicInterruptionVisibilityAndClauses`
 * (public bulletin list). Used to avoid Puppeteer screenshots when the SPA cannot load JSON.
 *
 * @param {import('mysql2').RowDataPacket|null|undefined} row
 * @param {boolean} hasDeletedAtColumn
 * @param {boolean} hasPulledFromFeedAtColumn
 */
export function rawRowVisibleForPublicSnapshot(row, hasDeletedAtColumn, hasPulledFromFeedAtColumn) {
  if (!row) return false;
  if (hasDeletedAtColumn && row.deleted_at != null && String(row.deleted_at).trim() !== '') {
    return false;
  }
  if (
    hasPulledFromFeedAtColumn &&
    row.pulled_from_feed_at != null &&
    String(row.pulled_from_feed_at).trim() !== ''
  ) {
    return false;
  }
  const pv = row.public_visible_at;
  if (pv == null) return true;
  const s = String(pv).trim();
  if (!s) return true;
  const normalized = s.includes('T') ? s : `${s.replace(' ', 'T')}`;
  const ms = Date.parse(normalized);
  if (Number.isNaN(ms)) return false;
  return ms <= Date.now();
}

/**
 * @param {number} id
 * @param {'print'|'infographic'} [variant]
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function captureInterruptionPosterToCloudinary(id, variant = 'print') {
  const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
  if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) {
    return { error: 'Cloudinary not configured.' };
  }
  const posterPageUrl = getPublicPosterPageUrl(id, variant);
  if (!posterPageUrl) {
    return { error: 'PUBLIC_APP_URL or FRONTEND_ORIGIN not set for poster capture.' };
  }

  let browser;
  try {
    const puppeteerMod = await import('puppeteer');
    const puppeteer = puppeteerMod.default || puppeteerMod;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    const vw = Math.min(
      Math.max(parseInt(String(env.POSTER_CAPTURE_VIEWPORT_WIDTH || '1200'), 10) || 1200, 700),
      1800
    );
    const vh = Math.min(
      Math.max(parseInt(String(env.POSTER_CAPTURE_VIEWPORT_HEIGHT || '1700'), 10) || 1700, 900),
      3200
    );
    const dsf = Math.min(
      Math.max(parseInt(String(env.POSTER_CAPTURE_DEVICE_SCALE_FACTOR || '3'), 10) || 3, 2),
      4
    );
    await page.setViewport({ width: vw, height: vh, deviceScaleFactor: dsf });
    await page.goto(posterPageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const readySelector =
      variant === 'infographic' ? '.feed-advisory-infographic' : '.aleco-print-poster';
    try {
      await page.waitForSelector(readySelector, { timeout: 45000 });
    } catch {
      /* may be error state; checked below */
    }
    const rendered = await page.evaluate((sel) => {
      try {
        return Boolean(document.querySelector(sel));
      } catch {
        return false;
      }
    }, readySelector);
    if (!rendered) {
      const errText = await page.evaluate(() => {
        const el = document.querySelector(
          '.print-poster-page--error, .public-poster-page--error, [class*="poster-page--error"]'
        );
        return el?.textContent?.trim() || '';
      });
      return {
        error:
          errText ||
          (variant === 'print'
            ? 'Print poster did not render. The advisory may not be public-visible yet, or the SPA/API URL is wrong.'
            : 'Poster page did not render.'),
      };
    }
    await page.evaluate(() =>
      Promise.all(
        [...document.images]
          .filter((img) => !img.complete && img.src)
          .map((img) => new Promise((res) => { img.onload = img.onerror = res; }))
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const posterBottom = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return 0;
      return Math.ceil(el.getBoundingClientRect().bottom);
    }, readySelector);
    const screenshotOpts =
      posterBottom > 50
        ? { type: 'png', clip: { x: 0, y: 0, width: vw, height: posterBottom } }
        : { type: 'png', fullPage: true };
    const buf = await page.screenshot(screenshotOpts);
    const b64 = Buffer.from(buf).toString('base64');
    const dataUri = `data:image/png;base64,${b64}`;
    const up = await cloudinary.uploader.upload(dataUri, {
      folder: 'aleco_posters',
      public_id: `interruption_${id}_capture`,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      format: 'png',
    });
    const posterUrl = up?.secure_url || up?.url || null;
    if (!posterUrl) return { error: 'Cloudinary did not return a URL.' };
    return { posterUrl };
  } catch (err) {
    return { error: typeof err?.message === 'string' ? err.message : 'Poster capture failed.' };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @param {object} dto - mapRowToDto
 */
export async function captureFallbackListingToCloudinary(dto, id) {
  const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
  if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) {
    return { error: 'Cloudinary not configured.' };
  }
  let browser;
  try {
    const html = buildFallbackListingHtml(dto);
    const puppeteerMod = await import('puppeteer');
    const puppeteer = puppeteerMod.default || puppeteerMod;
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const buf = await page.screenshot({ type: 'png', fullPage: true });
    const b64 = Buffer.from(buf).toString('base64');
    const dataUri = `data:image/png;base64,${b64}`;
    const up = await cloudinary.uploader.upload(dataUri, {
      folder: 'aleco_posters',
      public_id: `interruption_${id}_fallback`,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
    });
    const posterUrl = up?.secure_url || up?.url || null;
    if (!posterUrl) return { error: 'Cloudinary did not return a URL.' };
    return { posterUrl };
  } catch (err) {
    return { error: typeof err?.message === 'string' ? err.message : 'Fallback capture failed.' };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} id
 * @param {import('mysql2').RowDataPacket|null} [previousRawRow] - null on create
 * @param {import('mysql2').RowDataPacket} nextRawRow
 */
export async function maybeRegeneratePosterAfterMutation(pool, id, previousRawRow, nextRawRow) {
  try {
    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    if (!hasPoster) return;

    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) return;

    if (previousRawRow && nextRawRow && !posterRelevantFieldsChanged(previousRawRow, nextRawRow)) {
      return;
    }

    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    if (!rawRowVisibleForPublicSnapshot(nextRawRow, hasDel, hasPulled)) {
      return;
    }

    let r = await captureInterruptionPosterToCloudinary(id, 'print');
    if (r.error) {
      const dto = mapRowToDto(nextRawRow);
      if (dto) {
        r = await captureFallbackListingToCloudinary(dto, id);
      }
    }
    if (r.error || !r.posterUrl) {
      console.warn(`[poster] idle regen id=${id}:`, r.error || 'no url');
      return;
    }
    const phNow = nowPhilippineForMysql();
    await pool.execute('UPDATE aleco_interruptions SET poster_image_url = ?, updated_at = ? WHERE id = ?', [
      r.posterUrl,
      phNow,
      id,
    ]);
  } catch (e) {
    console.warn('[poster] maybeRegeneratePosterAfterMutation:', e?.message || e);
  }
}

/**
 * Admin "Capture poster": live print screenshot when the row is public-visible (SPA can load JSON);
 * otherwise (or if print fails) generate the minimal listing image from row data alone.
 *
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} id
 * @param {import('mysql2').RowDataPacket} rawRow
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function captureInterruptionPosterForAdmin(pool, id, rawRow) {
  const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
  const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
  const visible = rawRowVisibleForPublicSnapshot(rawRow, hasDel, hasPulled);
  let r = visible ? await captureInterruptionPosterToCloudinary(id, 'print') : { error: 'not_public_visible' };
  if (r.error) {
    const dto = mapRowToDto(rawRow);
    if (dto) {
      const fb = await captureFallbackListingToCloudinary(dto, id);
      if (!fb.error && fb.posterUrl) {
        r = fb;
      } else if (!r.posterUrl) {
        const detail = [r.error, fb?.error].filter(Boolean).join(' · ');
        r = { error: detail || 'Poster capture failed.' };
      }
    }
  }
  return r;
}
