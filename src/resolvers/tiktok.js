// src/resolvers/tiktok.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const TIKTOK_ICON = 'https://www.tiktok.com/favicon.ico';
const RESOLVE_TIMEOUT_MS = 25_000; // ✅ aumentado para cobrir pior caso real (8+10+3s de overhead)

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

async function resolveViaOembed(url, signal) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(oembedUrl, {
    timeout: 8_000,
    signal, // ✅ AbortSignal propagado — cancela se o global expirar
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  });
  return {
    title: data.title || null,
    image: data.thumbnail_url || null,
    authorName: data.author_name || null,
  };
}

// ✅ withTimeout agora propaga AbortController para cancelar promises internas
function createAbortableTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Timeout (${ms}ms)`)), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

async function _resolveTiktok(url, signal) {
  const { subtype, username, videoId } = parseTiktokUrl(url);

  let title = null;
  let description = null;
  let image = null;
  let authorName = username ?? null;

  if (subtype === 'video') {
    // ── 1. oEmbed ──────────────────────────────────────────────────────────
    try {
      const oembed = await resolveViaOembed(url, signal); // ✅ sinal propagado
      title = oembed.title ?? null;
      image = oembed.image ?? null;
      authorName = oembed.authorName ?? username ?? null;
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) throw err; // ✅ propaga abort
      console.warn('[TikTok] oEmbed falhou:', err.message);
    }

    // ── 2. Fallback browser ────────────────────────────────────────────────
    if (!title || !image) {
      try {
        const browser = await scrapeWithBrowser(url);
        title = title || browser.title || null;
        description = description || browser.description?.slice(0, 400) || null;
        if (!image && browser.image?.startsWith('http')) image = browser.image;
      } catch (err) {
        if (signal?.aborted) throw err;
        console.warn('[TikTok] Browser scraping falhou:', err.message);
      }
    }

    // ── 3. Screenshot (último recurso) ────────────────────────────────────
    if (!image) {
      image = await takeScreenshot(url, {
        waitUntil: 'domcontentloaded',
        timeout: 8_000,             // ✅ reduzido de 10_000 — soma controlada
      }).catch(() => null);
    }

  } else if (subtype === 'profile') {
    try {
      image = await takeScreenshot(url, {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
        waitAfterLoad: 1_500,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      console.warn('[TikTok] Screenshot de perfil falhou:', err.message);
      image = null;
    }

    title = username ? `@${username} no TikTok` : 'TikTok';
    authorName = username ?? null;
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
    clear(); // ✅ limpa o timer se terminou antes do timeout
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
