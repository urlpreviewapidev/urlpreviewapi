import puppeteer from 'puppeteer';
import { glob } from 'glob';

async function getChromePath() {
  // Pattern exato baseado no debug-chrome
  const matches = await glob(
    '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
  );

  const chromePath = matches.find(p => !p.includes('sandbox') && !p.includes('wrapper'));
  // console.log('[Chrome] Path encontrado:', chromePath ?? 'NENHUM');
  return chromePath ?? null;
}

export async function takeScreenshot(url) {
  const executablePath = await getChromePath();

  if (!executablePath) {
    throw new Error('Chrome não encontrado em /opt/render/.cache/puppeteer');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    // // Reduzir viewport
    // await page.setViewport({ width: 800, height: 450 });

    // // Ou reduzir qualidade
    // const screenshot = await page.screenshot({
    //   type: 'jpeg',
    //   quality: 60, // era 80
    //   encoding: 'base64',
    // });

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
