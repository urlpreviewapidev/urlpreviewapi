import puppeteer from 'puppeteer';

export async function getBrowser() {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

export async function scrapeWithBrowser(url) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    );

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });

    const data = await page.evaluate(() => {
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

    return data;
  } finally {
    await browser?.close();
  }
}
