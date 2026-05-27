/**
 * Server-side poster capture (Puppeteer -> Cloudinary) for Cloud Run worker.
 * Extracted from backend/services/interruptionPosterCapture.js
 * 
 * This worker only handles the capture logic. Database operations and
 * visibility checks are handled by the main API.
 */

import { Buffer } from 'node:buffer';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Hard upper-bound for a single capture attempt (browser-side total)
const CAPTURE_HARD_TIMEOUT_MS = 90_000;

// Browser pool for Cloud Run (simplified - single instance)
let browserInstance = null;

async function acquireBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });
  }
  return browserInstance;
}

async function releaseBrowser(browser) {
  // Keep browser alive for reuse in Cloud Run
  // Browser will be closed when the instance shuts down
}

async function forceCloseBrowser(browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      // Ignore
    }
  }
  browserInstance = null;
}

/**
 * Get the public SPA base URL for poster capture
 */
function getPublicAppBaseUrl() {
  const base = (process.env.PUBLIC_APP_URL_PRODUCTION || process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || '').trim();
  return base ? base.replace(/\/$/, '') : '';
}

/**
 * Get the absolute URL to poster page
 */
function getPublicPosterPageUrl(id, variant = 'print') {
  const base = getPublicAppBaseUrl();
  if (!base) return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (variant === 'infographic') {
    return `${base}/poster/interruption/${n}`;
  }
  return `${base}/print-interruption/${n}`;
}

/**
 * Capture the SPA print poster for an advisory and upload to Cloudinary.
 * Returns { posterUrl } on success or { error } on failure.
 *
 * @param {number} id
 * @param {'print'|'infographic'} [variant]
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function captureInterruptionPosterToCloudinary(id, variant = 'print') {
  const env = process.env;
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
 * @param {number} id
 * @param {'print'|'infographic'} [variant]
 * @returns {Promise<{ posterUrl: string } | { error: string }>}
 */
export async function captureWithHardTimeout(id, variant = 'print') {
  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`Capture exceeded hard timeout of ${CAPTURE_HARD_TIMEOUT_MS}ms`)),
      CAPTURE_HARD_TIMEOUT_MS
    );
  });
  try {
    const result = await Promise.race([
      captureInterruptionPosterToCloudinary(id, variant),
      timeoutPromise,
    ]);
    return result;
  } catch (err) {
    const msg = typeof err?.message === 'string' ? err.message : 'Capture hard-timeout.';
    console.error(`[poster] hard-timeout id=${id}:`, msg);
    // Best-effort: try to force-close the singleton browser to recover.
    try { await forceCloseBrowser(null); } catch { /* ignore */ }
    return { error: msg };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// Cleanup on process exit
process.on('SIGTERM', async () => {
  if (browserInstance) {
    await forceCloseBrowser(browserInstance);
  }
});

process.on('SIGINT', async () => {
  if (browserInstance) {
    await forceCloseBrowser(browserInstance);
  }
});
