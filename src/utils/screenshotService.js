// src/utils/screenshotService.js
import puppeteer from 'puppeteer';
import { getChromePath } from './chromePath.js';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

/**
 * @param {string} url
 * @param {object} options
 * @param {string}  [options.userAgent]        - User-Agent customizado
 * @param {number}  [options.width=1280]        - Largura do viewport
 * @param {number}  [options.height=720]        - Altura do viewport
 * @param {number}  [options.deviceScaleFactor=2]
 * @param {number}  [options.quality=90]        - Qualidade JPEG (1–100)
 * @param {number}  [options.timeout=20000]     - Timeout de navegação (ms)
 * @param {'networkidle2'|'networkidle0'|'domcontentloaded'|'load'} [options.waitUntil]
 * @param {number}  [options.waitAfterLoad=0]   - ms extras após o waitUntil
 * @param {{ x, y, width, height }|null} [options.clip] - Recorte da imagem
 * @returns {Promise<string>} data URI base64
 */
export async function takeScreenshot(url, options = {}) {
  // const executablePath = await getChromePath();

  // if (!executablePath) {
  //   throw new Error('Chrome não encontrado — verifique getChromePath()');
  // }

  const {
    userAgent = DEFAULT_UA,
    width = 1280,
    height = 720,
    deviceScaleFactor = 2,
    quality = 90,
    timeout = 20000,
    waitUntil = 'networkidle2',
    waitAfterLoad = 0,
    clip = null,
  } = options;

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


  try {
    const page = await browser.newPage();

    // ── Identidade do browser ──────────────────────────────────────────────
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    // Remove o flag "webdriver" do navigator (anti-bot básico)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    // ── Viewport ──────────────────────────────────────────────────────────
    await page.setViewport({ width, height, deviceScaleFactor });

    // ── Navegação ─────────────────────────────────────────────────────────
    await page.goto(url, { waitUntil, timeout });

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
    await browser.close();
  }
}
