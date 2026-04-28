// src/utils/screenshotService.js
import puppeteer from './puppeteerInstance.js'; // ✅ era: import puppeteer from 'puppeteer'

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

function makeBrowserGuard() {
  let _browser = null;
  let _closed = false;
  return {
    set(b) { _browser = b; _closed = false; },
    async close() {
      if (_closed || !_browser) return;
      _closed = true;
      await _browser.close().catch(() => { });
      _browser = null;
    },
    get alive() { return !!_browser && !_closed; },
  };
}

export async function takeScreenshot(url, options = {}) {
  const {
    userAgent = DEFAULT_UA,
    width = 1280,
    height = 720,
    deviceScaleFactor = 2,
    quality = 90,
    timeout = 15_000,
    waitUntil = 'domcontentloaded',
    waitAfterLoad = 0,
    clip = null,
  } = options;

  const guard = makeBrowserGuard();

  const killTimer = setTimeout(() => {
    if (guard.alive) {
      console.warn('[Screenshot] ⏱ Kill timer — forçando close()');
      guard.close();
    }
  }, timeout + 3_000);

  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',        // ✅ sem --single-process
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

    guard.set(browser);

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      // ✅ Screenshot não precisa de fontes externas, media ou websockets
      // 'image' e 'stylesheet' são mantidos para renderização fiel
      if (['media', 'font', 'websocket'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await page.setViewport({ width, height, deviceScaleFactor });

    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn(`[Screenshot] ⚠️ goto timeout (${timeout}ms) — screenshot do estado atual`);
      } else {
        throw err;
      }
    }

    if (waitAfterLoad > 0) {
      await new Promise(r => setTimeout(r, waitAfterLoad));
    }

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality,
      encoding: 'base64',
      ...(clip && { clip }),
    });

    return `data:image/jpeg;base64,${screenshot}`;

  } finally {
    clearTimeout(killTimer); // ✅ sempre cancela antes de fechar
    await guard.close();     // ✅ idempotente
  }
}
