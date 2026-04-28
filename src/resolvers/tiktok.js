// src/resolvers/tiktok.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const TIKTOK_ICON = 'https://www.tiktok.com/favicon.ico';
const RESOLVE_TIMEOUT_MS = 12_000;

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

async function resolveViaOembed(url) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(oembedUrl, {
    timeout: 8000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
  });
  return {
    title: data.title || null,
    image: data.thumbnail_url || null,
    authorName: data.author_name || null,
  };
}

function withTimeout(promise, ms, label) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function _resolveTiktok(url) {
  const { subtype, username, videoId } = parseTiktokUrl(url);

  // ✅ Todas as variáveis inicializadas com null
  let title = null;
  let description = null;
  let image = null;
  let authorName = username ?? null;

  if (subtype === 'video') {
    // 1. oEmbed
    try {
      const oembed = await resolveViaOembed(url);
      title = oembed.title ?? null;
      image = oembed.image ?? null;
      authorName = oembed.authorName ?? username ?? null;
    } catch (err) {
      console.warn('[TikTok] oEmbed falhou:', err.message);
    }

    // 2. Fallback browser
    if (!title || !image) {
      try {
        const browser = await withTimeout(
          scrapeWithBrowser(url),
          10_000,
          'scrapeWithBrowser TikTok video'
        );
        title = title || browser.title || null;
        description = browser.description?.slice(0, 400) || null;

        if (!image) {
          image = browser.image?.startsWith('http') ? browser.image : null;
        }
        if (!image) {
          image = await withTimeout(
            takeScreenshot(url, { waitUntil: 'domcontentloaded', timeout: 10_000 }),
            10_000,
            'takeScreenshot TikTok video'
          ).catch(() => null);
        }
      } catch (err) {
        console.warn('[TikTok] Browser scraping falhou:', err.message);
      }
    }

  } else if (subtype === 'profile') {
    // Perfis não têm oEmbed — screenshot direto
    try {
      image = await withTimeout(
        takeScreenshot(url, { waitUntil: 'domcontentloaded', timeout: 10_000, waitAfterLoad: 1500 }),
        12_000,
        'takeScreenshot TikTok profile'
      );
    } catch (err) {
      console.warn('[TikTok] Screenshot de perfil falhou:', err.message);
      image = null; // ✅ garante que image é null, nunca undefined
    }

    title = username ? `@${username} no TikTok` : 'TikTok';
    description = null;
    authorName = username ?? null;
  }

  // Fallback final
  if (!title) title = username ? `@${username} no TikTok` : 'TikTok';

  return {
    type: 'tiktok',
    title,
    description,   // ✅ sempre string | null
    image,         // ✅ sempre string | null — nunca undefined
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
  try {
    return await withTimeout(_resolveTiktok(url), RESOLVE_TIMEOUT_MS, 'resolveTiktok global');
  } catch (err) {
    console.warn('[TikTok] Resolver expirou ou falhou:', err.message);
    const { subtype, username, videoId } = parseTiktokUrl(url);
    return {
      type: 'tiktok',
      title: username ? `@${username} no TikTok` : 'TikTok',
      description: null,
      image: null, // ✅ null explícito
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
