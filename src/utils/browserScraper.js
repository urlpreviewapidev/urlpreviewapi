// src/utils/browserScraper.js
import puppeteer from './puppeteerInstance.js';

// ✅ UA de browser real — Googlebot era bloqueado por Instagram/TikTok/LinkedIn
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
      await _browser.close().catch(() => {});
      _browser = null;
    },
    get alive() { return !!_browser && !_closed; },
  };
}

export async function scrapeWithBrowser(url, options = {}) {
  const {
    userAgent = DEFAULT_UA,
    timeout = 15_000,
    waitUntil = 'domcontentloaded',
    takeScreenshot: shouldScreenshot = false,
  } = options;

  const guard = makeBrowserGuard();

  const killTimer = setTimeout(() => {
    if (guard.alive) {
      console.warn('[browserScraper] ⏱ Kill timer — forçando close()');
      guard.close();
    }
  }, timeout + 5_000);

  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
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
      if (['media', 'font', 'websocket'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    });

    // ✅ Stealth já cobre webdriver, mas headers extras ajudam contra fingerprint
    await page.evaluateOnNewDocument(() => {
      // Remove propriedades que denunciam automação
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
      delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    });

    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn(`[browserScraper] ⚠️ goto timeout (${timeout}ms) — extraindo do estado atual`);
      } else {
        throw err;
      }
    }

    const meta = await page.evaluate(() => {
      const getMeta = (selectors) => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          const val = el?.getAttribute('content') || el?.getAttribute('href');
          if (val) return val;
        }
        return null;
      };
      return {
        title:
          getMeta(['meta[property="og:title"]', 'meta[name="twitter:title"]']) ||
          document.title || null,
        description:
          getMeta([
            'meta[property="og:description"]',
            'meta[name="twitter:description"]',
            'meta[name="description"]',
          ]) || null,
        image:
          getMeta([
            'meta[property="og:image"]',
            'meta[name="twitter:image"]',
            'meta[name="twitter:image:src"]',
          ]) || null,
        favicon:
          getMeta([
            'link[rel="apple-touch-icon"]',
            'link[rel="icon"][type="image/png"]',
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
          ]) || null,
        siteName: getMeta(['meta[property="og:site_name"]']) || null,
        locale: getMeta(['meta[property="og:locale"]']) || null,
        canonicalUrl:
          getMeta(['link[rel="canonical"]']) ||
          getMeta(['meta[property="og:url"]']) || null,
      };
    });

    if (shouldScreenshot && !meta.image) {
      try {
        const raw = await page.screenshot({ type: 'jpeg', quality: 85, encoding: 'base64' });
        meta.screenshot = `data:image/jpeg;base64,${raw}`;
      } catch (err) {
        console.warn('[browserScraper] Screenshot falhou:', err.message);
      }
    }

    return meta;

  } finally {
    clearTimeout(killTimer);
    await guard.close();
  }
}
