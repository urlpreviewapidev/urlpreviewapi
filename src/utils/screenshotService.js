import puppeteer from 'puppeteer';
import { glob } from 'glob';

async function getChromePath() {
  const matches = await glob(
    '/opt/render/.cache/puppeteer/chrome/**/chrome'
  );
  return matches[0] ?? null;
}

export async function takeScreenshot(url) {
  const executablePath = await getChromePath();

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    const screenshot = await page.screenshot({
      type: 'jpeg',
      quality: 80,
      encoding: 'base64',
    });

    return `data:image/jpeg;base64,${screenshot}`;
  } finally {
    await browser.close();
  }
}
