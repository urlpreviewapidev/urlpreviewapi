// src/utils/browserScraper.js
import puppeteer from 'puppeteer';

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * Abre um browser headless e extrai meta tags da página.
 *
 * @param {string} url
 * @param {object} [options]
 * @param {string}  [options.userAgent]
 * @param {number}  [options.timeout=15000]
 * @param {'networkidle2'|'networkidle0'|'domcontentloaded'|'load'} [options.waitUntil]
 * @param {boolean} [options.takeScreenshot=false]
 * @returns {Promise<{title, description, image, favicon, siteName, locale, canonicalUrl, screenshot?}>}
 */
export async function scrapeWithBrowser(url, options = {}) {
  const {
    userAgent = DEFAULT_UA,
    timeout = 15_000,
    waitUntil = 'domcontentloaded', // ← era 'networkidle2' — trava em TikTok/Instagram
    takeScreenshot: shouldScreenshot = false,
  } = options;

  let browser = null; // ✅ let aqui, sem redeclarar no try

  const killTimer = setTimeout(async () => {
    if (browser) {
      console.warn('[browserScraper] ⏱ Kill timer ativado — forçando browser.close()');
      await browser.close().catch(() => { });
      browser = null;
    }
  }, timeout + 5_000);

  try {
    // ✅ atribui ao `let` do escopo externo (sem `const` aqui)
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

    // ── Aborta recursos desnecessários ─────────────────────────────────
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
    });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // ── Navegação tolerante a timeout ──────────────────────────────────
    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (err) {
      if (err.name === 'TimeoutError') {
        console.warn(`[browserScraper] ⚠️ goto timeout (${timeout}ms) — extraindo do estado atual`);
      } else {
        throw err;
      }
    }

    // ── Extração de meta tags ──────────────────────────────────────────
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
          document.title ||
          null,
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
          getMeta(['meta[property="og:url"]']) ||
          null,
      };
    });

    // ── Screenshot opcional ────────────────────────────────────────────
    if (shouldScreenshot && !meta.image) {
      try {
        const raw = await page.screenshot({
          type: 'jpeg',
          quality: 85,
          encoding: 'base64',
        });
        meta.screenshot = `data:image/jpeg;base64,${raw}`;
      } catch (err) {
        console.warn('[browserScraper] Screenshot falhou:', err.message);
      }
    }

    return meta;

  } finally {
    clearTimeout(killTimer);
    if (browser) await browser.close().catch(() => { });
  }
}
