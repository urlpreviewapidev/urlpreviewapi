// src/resolvers/tiktok.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';
import { decodeHTMLEntities } from '../utils/decodeEntities.js';

const TIKTOK_ICON = 'https://www.tiktok.com/favicon.ico';
const RESOLVE_TIMEOUT_MS = 25_000;

const USELESS_TITLES = new Set([
  'tiktok',
  'www.tiktok.com',
  'tiktok - make your day',
  'log in | tiktok',
  'log in or sign up for tiktok',
]);

function parseTiktokUrl(url) {
  try {
    const { pathname } = new URL(url);
    const videoMatch = pathname.match(/\/@([\w.]+)\/video\/(\d+)/);
    if (videoMatch) return { subtype: 'video', username: videoMatch[1], videoId: videoMatch[2] };
    const profileMatch = pathname.match(/\/@([\w.]+)/);
    if (profileMatch) return { subtype: 'profile', username: profileMatch[1], videoId: null };
    return { subtype: 'generic', username: null, videoId: null };
  } catch {
    return { subtype: 'generic', username: null, videoId: null };
  }
}

function sanitizeTitle(title) {
  if (!title) return null;
  const cleaned = decodeHTMLEntities(title.trim());
  if (USELESS_TITLES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

async function resolveViaOembed(url, signal) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(oembedUrl, {
    timeout: 8_000,
    signal,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  });
  return {
    title: data.title || null,
    image: data.thumbnail_url || null,
    authorName: data.author_name || null,
  };
}

async function resolveViaHttpOg(url) {
  const UAS = [
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Twitterbot/1.0',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ];

  for (const ua of UAS) {
    try {
      const { data: html } = await axios.get(url, {
        timeout: 8_000,
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        maxContentLength: 2 * 1024 * 1024,
      });

      const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
        || null;

      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1]
        || null;

      const cleanTitle = sanitizeTitle(ogTitle);

      // ✅ Decodifica &amp; e outros entities na URL da imagem
      const cleanImage = ogImage ? decodeHTMLEntities(ogImage) : null;

      if (cleanImage || cleanTitle) {
        return { title: cleanTitle, image: cleanImage };
      }
    } catch {
      // tenta próximo UA
    }
  }
  return {};
}

function createAbortableTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout (${ms}ms)`)), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function _resolveTiktok(url, signal) {
  const { subtype, username, videoId } = parseTiktokUrl(url);

  let title = null;
  let description = null;
  let image = null;
  let authorName = username ?? null;

  if (subtype === 'video') {
    // 1. oEmbed
    try {
      const oembed = await resolveViaOembed(url, signal);
      title = sanitizeTitle(oembed.title);
      image = oembed.image ?? null;
      authorName = oembed.authorName ?? username ?? null;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) throw err;
      console.warn('[TikTok] oEmbed falhou:', err.message);
    }

    // 2. Fallback browser
    if (!title || !image) {
      try {
        const browser = await scrapeWithBrowser(url);
        title = title || sanitizeTitle(browser.title) || null;
        description = description || browser.description?.slice(0, 400) || null;
        if (!image && browser.image?.startsWith('http')) image = browser.image;
      } catch (err) {
        if (signal?.aborted) throw err;
        console.warn('[TikTok] Browser scraping falhou:', err.message);
      }
    }

    // 3. Screenshot
    if (!image) {
      image = await takeScreenshot(url, {
        waitUntil: 'domcontentloaded',
        timeout: 8_000,
      }).catch(() => null);
    }

  } else if (subtype === 'profile') {
    // 1. HTTP OG
    try {
      const og = await resolveViaHttpOg(url);
      title = sanitizeTitle(og.title) || null;
      image = og.image || null;
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn('[TikTok] HTTP OG falhou:', err.message);
    }

    // 2. oEmbed não-oficial
    if (!image) {
      try {
        const oembed = await resolveViaOembed(url, signal);
        title = title || sanitizeTitle(oembed.title) || null;
        image = image || oembed.image || null;
        authorName = oembed.authorName ?? username ?? null;
      } catch (err) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
      }
    }

    // 3. Screenshot
    if (!image) {
      image = await takeScreenshot(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
        waitAfterLoad: 1_500,
      }).catch(() => null);
    }
  }

  if (!title) title = username ? `@${username} no TikTok` : 'TikTok';

  return {
    type: 'tiktok',
    title,
    description,
    image,
    icon: TIKTOK_ICON,
    url,
    extra: {
      siteName: 'TikTok',
      subtype,
      username: username ?? null,
      videoId: videoId ?? null,
      authorName: authorName ?? null,
    },
  };
}

export async function resolveTiktok(url) {
  const { signal, clear } = createAbortableTimeout(RESOLVE_TIMEOUT_MS);
  try {
    const result = await _resolveTiktok(url, signal);
    clear();
    return result;
  } catch (err) {
    clear();
    console.warn('[TikTok] Resolver expirou ou falhou:', err.message);
    const { subtype, username, videoId } = parseTiktokUrl(url);
    return {
      type: 'tiktok',
      title: username ? `@${username} no TikTok` : 'TikTok',
      description: null,
      image: null,
      icon: TIKTOK_ICON,
      url,
      extra: {
        siteName: 'TikTok',
        subtype,
        username: username ?? null,
        videoId: videoId ?? null,
        authorName: username ?? null,
      },
    };
  }
}
