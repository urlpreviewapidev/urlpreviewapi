// src/resolvers/generic.js
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
  if (favicon.startsWith('http')) return favicon;
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

  let image = merged.image || null;

  if (image) {
    image = image.startsWith('http') ? image : `${BASE_URL}${image}`;
  } else {
    // ✅ Corrigido: screenshotDataUrl já é data URI completo
    try {
      // console.log('[Screenshot] Iniciando para:', url);
      const screenshotDataUrl = await takeScreenshot(url);
      // console.log('[Screenshot] Sucesso, tamanho:', screenshotDataUrl.length);
      image = screenshotDataUrl;
    } catch (err) {
      console.error('[Screenshot] Falhou:', err.message, '\nStack:', err.stack);
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
