// src/resolvers/tiktok.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const TIKTOK_ICON = 'https://www.tiktok.com/favicon.ico';

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

async function resolveProfileFallback(url, username) {
  // Tenta screenshot direto sem browser scraping (TikTok bloqueia scraping de perfil)
  // src/resolvers/tiktok.js
  image = await takeScreenshot(url, {
    waitUntil: 'domcontentloaded',
    timeout: 10_000,
    waitAfterLoad: 1_500, // aguarda 1.5s para JS renderizar
  }).catch(() => null);


  return {
    title: `@${username} no TikTok`,
    description: null,
    image,
    authorName: username,
  };
}

export async function resolveTiktok(url) {
  const { subtype, username, videoId } = parseTiktokUrl(url);

  let title = null;
  let description = null;
  let image = null;
  let authorName = username;

  if (subtype === 'video') {
    // oEmbed funciona para vídeos
    try {
      const oembed = await resolveViaOembed(url);
      title = oembed.title;
      image = oembed.image;
      authorName = oembed.authorName || username;
    } catch (err) {
      console.warn('[TikTok] oEmbed falhou:', err.message);
    }

    // Trecho em resolveTiktok() — subtype === 'video'
    if (!title || !image) {
      try {
        const browser = await scrapeWithBrowser(url);
        title = title || browser.title || null;
        description = browser.description?.slice(0, 400) || null;

        if (!image) {
          // screenshot agora é responsabilidade explícita do screenshotService
          image = browser.image?.startsWith('http') ? browser.image : null;
          if (!image) {
            image = await takeScreenshot(url).catch(() => null);
          }
        }
      } catch (err) {
        console.warn('[TikTok] Browser scraping falhou:', err.message);
      }
    }
  } else if (subtype === 'profile') {
    // Perfis não têm oEmbed — usa screenshot direto
    const fallback = await resolveProfileFallback(url, username);
    title = fallback.title;
    description = fallback.description;
    image = fallback.image;
    authorName = fallback.authorName;
  }

  // Fallback final
  if (!title) {
    title = username ? `@${username} no TikTok` : 'TikTok';
  }

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
      username,
      videoId,
      authorName,
    },
  };
}
