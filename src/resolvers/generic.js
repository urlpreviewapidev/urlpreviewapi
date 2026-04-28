// src/resolvers/generic.js
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { tryOpenGraph } from '../utils/ogScraper.js';
import { getFaviconUrl } from '../utils/detectSource.js';
import { takeScreenshot } from '../utils/screenshotService.js';

function merge(primary, fallback) {
  return {
    title: primary.title || fallback.title || null,
    description: primary.description || fallback.description || null,
    image: primary.image || fallback.image || null,
    favicon: primary.favicon || fallback.favicon || null,
    siteName: primary.siteName || fallback.siteName || null,
    locale: primary.locale || fallback.locale || null,
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

function resolveImage(rawImage, pageUrl, screenshotData) {
  if (!rawImage) return screenshotData || null;
  if (rawImage.startsWith('http')) return rawImage;
  try {
    return new URL(rawImage, new URL(pageUrl).origin).href;
  } catch {
    return screenshotData || null;
  }
}

// src/resolvers/generic.js
export async function resolveGeneric(url, type = 'generic') {
  const ogData = await tryOpenGraph(url).catch(() => ({}));

  let screenshotData = null;
  let browserData = {};

  const needsBrowser = !ogData.title || !ogData.image;

  if (needsBrowser) {
    browserData = await scrapeWithBrowser(url, {
      takeScreenshot: true, // ✅ sempre tira screenshot dentro do browser (já carregado)
    }).catch(() => ({}));

    if (browserData.screenshot) {
      screenshotData = browserData.screenshot;
      delete browserData.screenshot;
    }
  }

  const merged = merge(ogData, browserData);
  const title = merged.title || new URL(url).hostname;
  let image = resolveImage(merged.image, url, screenshotData);

  // ✅ Fallback só se browser não rodou (tinha title E image na OG mas image era inválida)
  if (!image && !needsBrowser) {
    image = await takeScreenshot(url).catch(() => null);
  }

  return {
    type,
    title,
    description: merged.description || null,
    image,
    icon: resolveIcon(merged.favicon, url),
    url: merged.canonicalUrl || url,
    extra: {
      siteName: merged.siteName || null,
      locale: merged.locale || null,
    },
  };
}
