// src/utils/screenshotService.js
import puppeteer from 'puppeteer';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

/**
 * @param {string} url
 * @param {object} options
 * @param {string}  [options.userAgent]
 * @param {number}  [options.width=1280]
 * @param {number}  [options.height=720]
 * @param {number}  [options.deviceScaleFactor=2]
 * @param {number}  [options.quality=90]
 * @param {number}  [options.timeout=15000]      - Timeout total (navegação + screenshot)
 * @param {'networkidle2'|'networkidle0'|'domcontentloaded'|'load'} [options.waitUntil]
 * @param {number}  [options.waitAfterLoad=0]
 * @param {{ x, y, width, height }|null} [options.clip]
 * @returns {Promise<string>} data URI base64
 */
export async function takeScreenshot(url, options = {}) {
  const {
    userAgent = DEFAULT_UA,
    width = 1280,
    height = 720,
    deviceScaleFactor = 2,
    quality = 90,
    timeout = 15_000,
    waitUntil = 'domcontentloaded', // ← era 'networkidle2' — nunca resolve no TikTok
    waitAfterLoad = 0,
    clip = null,
  } = options;

  let browser = null;

  // ── Timeout global que garante browser.close() mesmo se travado ──────────
  const killTimer = setTimeout(async () => {
    if (browser) {
      console.warn(`[Screenshot] ⏱ Timeout global atingido — forçando browser.close()`);
      await browser.close().catch(() => { });
    }
  }, timeout + 3_000); // 3s a mais que o timeout da navegação

  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--memory-pressure-off',
        '--max_old_space_size=256',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-first-run',
        '--disable-translate',
      ],
    });

    const page = await browser.newPage();

    // ── Aborta recursos desnecessários (acelera carregamento) ─────────────
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['media', 'font', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // ── Identidade ────────────────────────────────────────────────────────
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // ── Viewport ──────────────────────────────────────────────────────────
    await page.setViewport({ width, height, deviceScaleFactor });

    // ── Navegação com timeout explícito ───────────────────────────────────
    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (err) {
      // TimeoutError é tolerável — a página pode estar parcialmente carregada
      if (err.name === 'TimeoutError') {
        console.warn(`[Screenshot] ⚠️ page.goto timeout (${timeout}ms) — tirando screenshot do estado atual`);
      } else {
        throw err;
      }
    }

    if (waitAfterLoad > 0) {
      await new Promise(r => setTimeout(r, waitAfterLoad));
    }

    // ── Screenshot ────────────────────────────────────────────────────────
    const screenshotOptions = {
      type: 'jpeg',
      quality,
      encoding: 'base64',
      ...(clip && { clip }),
    };

    const screenshot = await page.screenshot(screenshotOptions);
    return `data:image/jpeg;base64,${screenshot}`;

  } finally {
    clearTimeout(killTimer); // cancela o kill timer se terminou normalmente
    if (browser) await browser.close().catch(() => { });
  }
}
