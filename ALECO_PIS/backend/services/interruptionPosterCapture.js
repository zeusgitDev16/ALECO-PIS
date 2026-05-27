/**
 * Server-side poster capture (Puppeteer -> Cloudinary).
 * Used by POST /interruptions/:id/poster-capture and idle regeneration after POST/PUT.
 *
 * Design contract: this service captures the actual SPA-rendered poster design at
 * /print-interruption/:id. If Puppeteer cannot render that design, the capture FAILS
 * (returns { error }) — the dashboard already renders the React component live as a
 * visual fallback, so a stale/simple HTML card image is never written to Cloudinary.
 */

import { Buffer } from 'node:buffer';
import { cloudinary } from '../../cloudinaryConfig.js';
import { extractCloudinaryPublicId } from '../utils/cloudinaryUtils.js';
import { getPublicPosterPageUrl } from '../utils/posterCaptureUrl.js';
import {
  getAlecoInterruptionsPosterExtrasSupported,
  getAlecoInterruptionsDeletedAtSupported,
  getAlecoInterruptionsPulledFromFeedAtSupported,
} from '../utils/interruptionsDbSupport.js';
import { nowPhilippineForMysql } from '../utils/dateTimeUtils.js';
import { shareHeadlineFromType, shareDescriptionFromDto, escapeHtmlAttr } from '../utils/interruptionShareHtml.js';
import { acquireBrowser, releaseBrowser, forceCloseBrowser } from './browserPool.js';
import { capturePosterViaWorker } from '../utils/posterClient.js';

// Hard upper-bound for a single capture attempt (browser-side total).
const CAPTURE_HARD_TIMEOUT_MS = 90_000;

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
 * Capture the SPA print poster for an advisory and upload to Cloudinary.
 * Returns { posterUrl } on success or { error } on failure. NEVER falls back to a
 * simple HTML card — the dashboard renders the React component live when poster_image_url is null.
 *
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

  const startedAt = Date.now();
  const log = (msg, extra) => {
    const ms = Date.now() - startedAt;
    if (extra !== undefined) {
      console.log(`[poster] id=${id} variant=${variant} +${ms}ms ${msg}`, extra);
    } else {
      console.log(`[poster] id=${id} variant=${variant} +${ms}ms ${msg}`);
    }
  };

  let browser;
  let page;
  let pageConsoleErrors = [];
  let pageRequestFailures = [];
  let didCaptureFail = false;
  try {
    browser = await acquireBrowser();
    log('browser acquired');
    page = await browser.newPage();

    // Capture page-side diagnostics for clearer error reporting
    page.on('console', (msg) => {
      const t = msg.type();
      if (t === 'error' || t === 'warning') {
        pageConsoleErrors.push(`[${t}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      pageConsoleErrors.push(`[pageerror] ${err?.message || String(err)}`);
    });
    page.on('requestfailed', (req) => {
      pageRequestFailures.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'failed'}`);
    });

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
    log(`viewport set ${vw}x${vh}@${dsf}x url=${posterPageUrl}`);

    // Navigate with stricter wait: wait for load + network mostly idle so JS/CSS/api are done.
    await page.goto(posterPageUrl, { waitUntil: ['load', 'networkidle2'], timeout: 60_000 });
    log('page loaded (load + networkidle2)');

    const readySelector =
      variant === 'infographic' ? '.feed-advisory-infographic' : '.aleco-print-poster';

    // Wait for the React component to mount (data fetched + render complete)
    try {
      await page.waitForSelector(readySelector, { timeout: 45_000 });
      log(`selector found: ${readySelector}`);
    } catch {
      log(`selector NOT found within timeout: ${readySelector}`);
    }

    // Wait until either selector is present OR error page is rendered
    const rendered = await page.evaluate((sel) => {
      try {
        return Boolean(document.querySelector(sel));
      } catch {
        return false;
      }
    }, readySelector);

    if (!rendered) {
      didCaptureFail = true;
      const errText = await page.evaluate(() => {
        const el = document.querySelector(
          '.print-poster-page--error, .public-poster-page--error, [class*="poster-page--error"]'
        );
        return el?.textContent?.trim() || '';
      });
      const detail = [
        errText || 'Print poster did not render.',
        pageRequestFailures.length ? `Failed requests: ${pageRequestFailures.slice(0, 3).join('; ')}` : '',
        pageConsoleErrors.length ? `Console: ${pageConsoleErrors.slice(0, 3).join('; ')}` : '',
      ].filter(Boolean).join(' | ');
      console.warn(`[poster] id=${id} render check failed: ${detail}`);
      return { error: detail };
    }

    // Wait for web fonts so headings/typography don't flash unstyled
    try {
      await page.evaluate(() => (document.fonts && document.fonts.ready) || Promise.resolve());
      log('fonts ready');
    } catch (e) {
      log('fonts ready failed (non-fatal)', e?.message);
    }

    // Wait for all images inside the poster to finish loading (logo, NGCP image, etc.)
    await page.evaluate(() =>
      Promise.all(
        [...document.images]
          .filter((img) => !img.complete && img.src)
          .map((img) => new Promise((res) => { img.onload = img.onerror = res; }))
      )
    );
    log('images settled');

    // Final settle — animations, layout reflow after late images/fonts
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify poster has meaningful content (not just an empty shell)
    const posterBounds = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Heuristic: meaningful poster should have non-trivial text content
      const text = String(el.textContent || '').trim();
      return {
        x: Math.max(0, Math.floor(r.left)),
        width: Math.ceil(r.width),
        height: Math.ceil(r.bottom),
        textLen: text.length,
      };
    }, readySelector);

    if (!posterBounds || posterBounds.height <= 50 || posterBounds.textLen < 10) {
      didCaptureFail = true;
      const detail = `Poster rendered but appears empty (h=${posterBounds?.height || 0}, textLen=${posterBounds?.textLen || 0}).`;
      console.warn(`[poster] id=${id} ${detail}`);
      return { error: detail };
    }

    const screenshotOpts = {
      type: 'png',
      clip: {
        x: posterBounds.x,
        y: 0,
        width: Math.min(posterBounds.width, vw - posterBounds.x),
        height: posterBounds.height,
      },
    };

    const buf = await page.screenshot(screenshotOpts);
    log(`screenshot captured size=${buf.length}b`);

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
    if (!posterUrl) {
      didCaptureFail = true;
      return { error: 'Cloudinary did not return a URL.' };
    }
    log(`upload ok url=${posterUrl}`);
    return { posterUrl };
  } catch (err) {
    didCaptureFail = true;
    const code = err?.code || err?.statusCode || err?.http_code || 'unknown';
    const msg = typeof err?.message === 'string' ? err.message : 'Poster capture failed.';
    console.error(`[poster] captureInterruptionPosterToCloudinary id=${id} ERROR code=${code}:`, msg, err?.stack || '');
    return { error: `${msg} (code: ${code})` };
  } finally {
    // Always close page to avoid leaks
    if (page) {
      try { await page.close({ runBeforeUnload: false }); } catch { /* ignore */ }
    }
    if (browser) {
      if (didCaptureFail) {
        // Force-close on failure to recover from any hung Chrome state.
        await forceCloseBrowser(browser);
      } else {
        await releaseBrowser(browser);
      }
    }
  }
}

/**
 * Wrap capture with a hard timeout so a hung browser cannot stall the queue indefinitely.
 * Now uses Cloud Run worker instead of local Puppeteer.
 * @param {number} id
 * @param {'print'|'infographic'} [variant]
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
async function captureWithHardTimeout(id, variant = 'print') {
  const result = await capturePosterViaWorker(id, variant);
  return result;
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
    browser = await acquireBrowser();
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
      await releaseBrowser(browser);
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
    if (String(nextRawRow?.type || '') === 'CustomPoster') return;

    const hasPoster = await getAlecoInterruptionsPosterExtrasSupported(pool);
    if (!hasPoster) return;

    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.upload) return;

    if (previousRawRow && nextRawRow && !posterRelevantFieldsChanged(previousRawRow, nextRawRow)) {
      return;
    }

    // Auto-regen runs only for advisories currently public-visible. Hidden/pulled/archived
    // rows skip Puppeteer work — the dashboard already renders the React component live.
    const hasDel = await getAlecoInterruptionsDeletedAtSupported(pool);
    const hasPulled = await getAlecoInterruptionsPulledFromFeedAtSupported(pool);
    if (!rawRowVisibleForPublicSnapshot(nextRawRow, hasDel, hasPulled)) {
      return;
    }

    const r = await captureWithHardTimeout(id, 'print');
    if (r.error || !r.posterUrl) {
      // No simple HTML card fallback. Dashboard live-renders the React poster when null.
      console.warn(`[poster] idle regen id=${id} failed:`, r.error || 'no url');
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
 * Best-effort Cloudinary cleanup for a permanently deleted advisory.
 * Destroys: generated poster assets (capture + fallback, by predictable public_id),
 * plus any uploaded image_url and poster_image_url found on the row.
 * All deletions run in parallel and silently ignore individual failures.
 * Safe to call when Cloudinary is not configured — exits immediately.
 *
 * @param {number} id
 * @param {{ image_url?: string|null, poster_image_url?: string|null }} row
 */
export async function deleteCloudinaryAssetsForAdvisory(id, row) {
  try {
    const env = typeof globalThis.process !== 'undefined' ? globalThis.process.env : {};
    if (!env.CLOUDINARY_CLOUD_NAME || !cloudinary?.uploader?.destroy) return;

    const toDelete = new Set();

    toDelete.add(`aleco_posters/interruption_${id}_capture`);
    toDelete.add(`aleco_posters/interruption_${id}_fallback`);

    const imagePublicId = extractCloudinaryPublicId(row?.image_url);
    if (imagePublicId) toDelete.add(imagePublicId);

    const posterPublicId = extractCloudinaryPublicId(row?.poster_image_url);
    if (posterPublicId) toDelete.add(posterPublicId);

    await Promise.allSettled(
      [...toDelete].map((publicId) =>
        cloudinary.uploader
          .destroy(publicId, { invalidate: true })
          .catch((e) => console.warn(`[poster] cleanup destroy "${publicId}":`, e?.message || e))
      )
    );
  } catch (e) {
    console.warn('[poster] deleteCloudinaryAssetsForAdvisory:', e?.message || e);
  }
}

/**
 * Admin-triggered capture (manual via /poster-capture or /poster-stub).
 * Bypasses the public-visibility check so admins can preview / regenerate posters
 * for pulled-from-feed, archived, or future-scheduled advisories. The SPA share
 * endpoint (loadInterruptionRowById) loads any advisory regardless of visibility,
 * so the print page will render properly.
 *
 * NO simple HTML card fallback. If Puppeteer cannot render the design, returns { error }.
 *
 * @param {import('mysql2/promise').Pool} _pool unused (kept for signature stability)
 * @param {number} id
 * @param {import('mysql2').RowDataPacket} rawRow
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function captureInterruptionPosterForAdmin(_pool, id, rawRow) {
  if (String(rawRow?.type || '') === 'CustomPoster') {
    return { error: 'Custom poster advisories use the uploaded image directly and have no template to generate.' };
  }
  return captureWithHardTimeout(id, 'print');
}
