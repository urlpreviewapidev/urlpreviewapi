import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { tryOpenGraph } from '../utils/ogScraper.js';
import { getFaviconUrl } from '../utils/detectSource.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function merge(primary, fallback) {
  return {
    title:        primary.title        || fallback.title        || null,
    description:  primary.description  || fallback.description  || null,
    image:        primary.image        || fallback.image        || null,
    favicon:      primary.favicon      || fallback.favicon      || null,
    siteName:     primary.siteName     || fallback.siteName     || null,
    locale:       primary.locale       || fallback.locale       || null,
    canonicalUrl: primary.canonicalUrl || fallback.canonicalUrl || null,
  };
}

function resolveIcon(favicon, pageUrl) {
  if (!favicon) return getFaviconUrl(pageUrl);
  if (favicon.startsWith('http')) return favicon;
  try {
    const origin = new URL(pageUrl).origin;
    return new URL(favicon, origin).href;
  } catch {
    return getFaviconUrl(pageUrl);
  }
}

export async function resolveGeneric(url, type = 'generic') {
  const ogData = await tryOpenGraph(url).catch(() => ({}));

  let screenshotData = null;
  let browserData = {};

  if (!ogData.title || !ogData.image) {
    const needsScreenshot = !ogData.image;
    browserData = await scrapeWithBrowser(url, { takeScreenshot: needsScreenshot });

    if (browserData.screenshot) {
      screenshotData = browserData.screenshot;
      delete browserData.screenshot;
    }
  }

  if (!ogData.title && !browserData.title) {
    throw new Error('Não foi possível extrair metadados da URL.');
  }

  const merged = merge(browserData, ogData);

  let image = merged.image
    ? (merged.image.startsWith('http') ? merged.image : `${BASE_URL}${merged.image}`)
    : screenshotData;

  if (!image) {
    try {
      image = await takeScreenshot(url);
    } catch (err) {
      console.error('[Screenshot] Falhou:', err.message);
      image = null;
    }
  }

  return {
    type,
    title: merged.title,
    description: merged.description,   // ✅ vem do merge (og / browser) — sem getMeta/document
    image,
    icon: resolveIcon(merged.favicon, url),
    url: merged.canonicalUrl || url,
    extra: {
      siteName: merged.siteName,
      locale: merged.locale,
    },
  };
}
