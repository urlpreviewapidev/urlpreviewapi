import puppeteer from 'puppeteer';
import { execSync } from 'child_process';

function getChromePath() {
  try {
    return execSync(
      `find /opt/render/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1`
    ).toString().trim() || null;
  } catch {
    return null;
  }
}

export async function takeScreenshot(url) {
  const executablePath = getChromePath();
  console.log('[Screenshot] Usando Chrome em:', executablePath);

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
