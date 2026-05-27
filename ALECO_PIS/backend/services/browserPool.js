/**
 * Browser Pool for Puppeteer - Optimized for e2-micro (1GB RAM)
 * Maintains a single browser instance with concurrency limit of 1
 * Reuses browser across requests to reduce overhead
 */

let browserInstance = null;
let isAcquired = false;
let acquiredAt = 0;
const MAX_CONCURRENT = 1;
// Watchdog: if a caller acquires the browser and forgets to release, free it after this long.
const STALE_ACQUIRE_MS = 2 * 60 * 1000; // 2 min

/**
 * If the singleton has been held longer than STALE_ACQUIRE_MS, treat it as stale and recover.
 */
function clearIfStale() {
  if (!isAcquired) return;
  if (Date.now() - acquiredAt > STALE_ACQUIRE_MS) {
    console.warn('[browserPool] stale acquisition detected, force-clearing flag');
    isAcquired = false;
    acquiredAt = 0;
  }
}

/**
 * Acquire a browser instance
 * @returns {Promise<import('puppeteer').Browser>}
 */
export async function acquireBrowser() {
  clearIfStale();

  if (isAcquired) {
    throw new Error('Maximum concurrent browser limit reached (1). Please wait for current poster generation to complete.');
  }

  if (browserInstance && browserInstance.isConnected()) {
    isAcquired = true;
    acquiredAt = Date.now();
    return browserInstance;
  }

  // Stale or never-launched: launch a fresh instance.
  if (browserInstance) {
    try { await browserInstance.close(); } catch { /* ignore */ }
    browserInstance = null;
  }

  const puppeteerMod = await import('puppeteer');
  const puppeteer = puppeteerMod.default || puppeteerMod;

  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  isAcquired = true;
  acquiredAt = Date.now();
  return browserInstance;
}

/**
 * Release a browser instance. Only updates pool state if `browser` is the
 * current singleton; a late release of a stale instance (e.g. after the outer
 * hard-timeout already replaced the browser) silently does nothing to flags.
 * @param {import('puppeteer').Browser} browser
 */
export async function releaseBrowser(browser) {
  if (!browser) return;

  if (browser !== browserInstance) {
    // Stale reference - the singleton was already replaced. Just try to close
    // this orphan if it's still open; do NOT touch isAcquired/acquiredAt.
    try {
      if (browser.isConnected && browser.isConnected()) {
        await browser.close();
      }
    } catch (err) {
      console.warn('[browserPool] Error closing stale browser:', err?.message || err);
    }
    return;
  }

  // Releasing the current singleton.
  isAcquired = false;
  acquiredAt = 0;

  // Keep browser instance alive for reuse; closed on server shutdown.
}

/**
 * Force-close the singleton browser. Use after a capture failure or hard timeout to
 * recover from a hung Chrome process. Subsequent acquireBrowser() will launch fresh.
 *
 * Passing `null` targets the current singleton (used by the outer hard-timeout).
 * Passing a specific browser only acts if it is still the current singleton; a
 * stale reference is closed in isolation without touching pool flags.
 *
 * @param {import('puppeteer').Browser|null} [browser]
 */
export async function forceCloseBrowser(browser) {
  // Caller passed an explicit browser that is no longer the singleton:
  // close that orphan in isolation, do NOT mutate pool state.
  if (browser && browser !== browserInstance) {
    try {
      if (browser.isConnected && browser.isConnected()) {
        await browser.close();
      }
    } catch (err) {
      console.warn('[browserPool] forceCloseBrowser stale error:', err?.message || err);
    }
    return;
  }

  // Otherwise (browser is null or IS the singleton) recycle the singleton.
  if (browserInstance) {
    try {
      await browserInstance.close();
    } catch (err) {
      console.warn('[browserPool] forceCloseBrowser error:', err?.message || err);
    }
    browserInstance = null;
  }
  isAcquired = false;
  acquiredAt = 0;
}

/**
 * Get current acquisition status
 * @returns {boolean}
 */
export function isBrowserAcquired() {
  return isAcquired;
}

/**
 * Close browser instance (call on server shutdown)
 */
export async function closeBrowserPool() {
  if (browserInstance && browserInstance.isConnected()) {
    try {
      await browserInstance.close();
      console.log('[browserPool] Browser pool closed.');
    } catch (err) {
      console.warn('[browserPool] Error closing browser pool:', err?.message || err);
    }
    browserInstance = null;
    isAcquired = false;
  }
}

/**
 * Graceful shutdown handler
 */
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await closeBrowserPool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closeBrowserPool();
    process.exit(0);
  });
}
