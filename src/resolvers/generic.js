import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { tryOpenGraph } from '../utils/ogScraper.js';
import { getFaviconUrl } from '../utils/detectSource.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

  // Já é URL absoluta
  if (favicon.startsWith('http')) return favicon;

  // Path relativo → converte para absoluto usando a origem da URL
  try {
    const origin = new URL(pageUrl).origin;
    return new URL(favicon, origin).href;
  } catch {
    return getFaviconUrl(pageUrl);
  }
}

export async function resolveGeneric(url, type = 'generic') {
  const [ogResult, browserResult] = await Promise.allSettled([
    tryOpenGraph(url),
    scrapeWithBrowser(url),
  ]);

  const ogData = ogResult.status === 'fulfilled' ? ogResult.value : {};
  const browserData = browserResult.status === 'fulfilled' ? browserResult.value : {};

  if (!ogData.title && !browserData.title) {
    throw new Error('Não foi possível extrair metadados da URL.');
  }

  const merged = merge(browserData, ogData);

  // Resolve imagem: OG image → screenshot como fallback
  let image = merged.image || null;

  if (image) {
    image = image.startsWith('http') ? image : `${BASE_URL}${image}`;
  } else {
    // Nenhuma OG image encontrada — tira screenshot
    try {
      const screenshotPath = await takeScreenshot(url);
      image = `${BASE_URL}${screenshotPath}`;
    } catch (err) {
      console.warn('[Screenshot] Falhou:', err.message);
      image = null;
    }
  }

  return {
    type,
    title: merged.title,
    description: merged.description?.slice(0, 400) || null,
    image,
    icon: resolveIcon(merged.favicon, url),
    url: merged.canonicalUrl || url,
    extra: {
      siteName: merged.siteName,
      locale: merged.locale,
    },
  };
}

// http://localhost:3000/preview?url=https://uai-346a1a.netlify.app/
