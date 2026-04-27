import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

let browserInstance = null;

async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    executablePath: process.env.NODE_ENV === 'production'
      ? '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
      : undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',       // importante no Render free
    ],
  });
}


const SCREENSHOTS_DIR = path.resolve('public/screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export async function takeScreenshot(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 720 });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    const hash = crypto.createHash('md5').update(url).digest('hex');
    const filename = `${hash}.webp`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    await page.screenshot({
      path: filepath,
      type: 'webp',
      quality: 80,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });

    return `/screenshots/${filename}`;
  } finally {
    await page.close();
  }
}
