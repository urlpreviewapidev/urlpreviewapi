// src/utils/browserScraper.js
import puppeteer from 'puppeteer';
import { getChromePath } from './chromePath.js';

const DEFAULT_UA =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * Abre um browser headless e extrai meta tags da página.
 * Opcionalmente tira um screenshot da página.
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
  // const executablePath = await getChromePath();

  // if (executablePath === null) {
  //   throw new Error('Chrome não encontrado no cache do Puppeteer');
  // }

  const {
    userAgent = DEFAULT_UA,
    timeout = 15000,
    waitUntil = 'networkidle2',
    takeScreenshot: shouldScreenshot = false,
  } = options;

  let browser;
  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',      // ← crítico no Render (pouca /dev/shm)
        '--disable-gpu',
        '--no-zygote',                  // ← evita crash em containers
        '--single-process',             // ← fallback se --no-zygote falhar
      ],
    });


    const page = await browser.newPage();
    await page.setUserAgent(userAgent);
    await page.goto(url, { waitUntil, timeout });

    // ── Extração de meta tags ────────────────────────────────────────────
    // Separado do return para permitir o screenshot após o evaluate
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

    // ── Screenshot opcional ──────────────────────────────────────────────
    // Só executa se explicitamente solicitado e não há imagem OG disponível
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
        // não propaga — screenshot é melhor esforço
      }
    }

    return meta;

  } finally {
    await browser?.close();
  }
}
