/**
 * Browser Pool for Puppeteer - Optimized for e2-micro (1GB RAM)
 * Maintains a single browser instance with concurrency limit of 1
 * Reuses browser across requests to reduce overhead
 */

let browserInstance = null;
let isAcquired = false;
const MAX_CONCURRENT = 1;

/**
 * Acquire a browser instance
 * @returns {Promise<import('puppeteer').Browser>}
 */
export async function acquireBrowser() {
  if (isAcquired) {
    throw new Error('Maximum concurrent browser limit reached (1). Please wait for current poster generation to complete.');
  }

  if (browserInstance && browserInstance.isConnected()) {
    isAcquired = true;
    return browserInstance;
  }

  // Launch new browser instance
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
  return browserInstance;
}

/**
 * Release a browser instance
 * @param {import('puppeteer').Browser} browser
 */
export async function releaseBrowser(browser) {
  if (browser && browser !== browserInstance) {
    // If a different browser instance was somehow created, close it
    try {
      await browser.close();
    } catch (err) {
      console.warn('[browserPool] Error closing foreign browser:', err?.message || err);
    }
  }

  isAcquired = false;

  // Keep browser instance alive for reuse
  // It will be closed on server shutdown or error
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
