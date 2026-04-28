// src/resolvers/instagram.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const IG_ICON = 'https://www.google.com/s2/favicons?domain=www.instagram.com&sz=64';

const SCRAPER_UAS = [
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
];

// ✅ Títulos inúteis que o Instagram retorna para bots — descartados
const USELESS_TITLES = new Set([
  'www.instagram.com',
  'instagram.com',
  'instagram',
  'log into facebook',
  'facebook',
  'log in or sign up to view',
]);

function parseInstagramUrl(url) {
  try {
    const { pathname } = new URL(url);
    const postMatch = pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (postMatch) return { subtype: 'post', username: null, postId: postMatch[2], isProfile: false };
    const profileMatch = pathname.match(/^\/?@?([\w.]+)\/?$/);
    if (profileMatch && profileMatch[1] !== 'p' && profileMatch[1] !== 'reel') {
      return { subtype: 'profile', username: profileMatch[1], postId: null, isProfile: true };
    }
    return { subtype: 'generic', username: null, postId: null, isProfile: false };
  } catch {
    return { subtype: 'generic', username: null, postId: null, isProfile: false };
  }
}

async function resolveViaOembed(url) {
  const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&access_token=${process.env.FB_ACCESS_TOKEN}`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });
  return {
    title: data.title || null,
    image: data.thumbnail_url || null,
    authorName: data.author_name || null,
  };
}

function decodeHTMLEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// ✅ Retorna null se o título for inútil (hostname, login wall, etc.)
function sanitizeTitle(title) {
  if (!title) return null;
  const cleaned = decodeHTMLEntities(title).trim();
  if (USELESS_TITLES.has(cleaned.toLowerCase())) return null;
  // Rejeita títulos que são apenas uma URL/domínio
  if (/^[\w.-]+\.(com|net|org|io|co)$/i.test(cleaned)) return null;
  return cleaned;
}

async function resolveViaHttpOg(url) {
  for (const ua of SCRAPER_UAS) {
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

      const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1]
        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1]
        || null;

      const cleanTitle = sanitizeTitle(ogTitle);

      if (ogImage || cleanTitle) {
        return {
          title: cleanTitle,
          description: ogDesc ? decodeHTMLEntities(ogDesc) : null,
          image: ogImage || null,
        };
      }
    } catch {
      // tenta próximo UA
    }
  }
  return {};
}

export async function resolveInstagram(url) {
  const { subtype, username, postId, isProfile } = parseInstagramUrl(url);

  let title = null;
  let description = null;
  let image = null;
  let resolvedUsername = username;

  // ── 1. oEmbed (só posts com token) ────────────────────────────────────────
  if (subtype === 'post' && process.env.FB_ACCESS_TOKEN) {
    try {
      const oembed = await resolveViaOembed(url);
      title = oembed.title;
      image = oembed.image;
      resolvedUsername = oembed.authorName || username;
    } catch (err) {
      console.warn('[Instagram] oEmbed falhou:', err.message);
    }
  }

  // ── 2. HTTP + UA social ───────────────────────────────────────────────────
  if (!title || !image) {
    try {
      const og = await resolveViaHttpOg(url);
      // ✅ sanitizeTitle já foi aplicado dentro do resolveViaHttpOg
      title = title || og.title || null;
      description = description || og.description || null;
      image = image || og.image || null;
    } catch (err) {
      console.warn('[Instagram] HTTP OG falhou:', err.message);
    }
  }

  // ── 3. Browser scraping ───────────────────────────────────────────────────
  if (!title || !image) {
    try {
      const browser = await scrapeWithBrowser(url, { takeScreenshot: !image });
      const browserTitle = sanitizeTitle(browser.title);
      title = title || browserTitle || null;
      description = description || browser.description?.slice(0, 400) || null;
      image = image || browser.screenshot || (browser.image?.startsWith('http') ? browser.image : null);
    } catch (err) {
      console.warn('[Instagram] Browser scraping falhou:', err.message);
    }
  }

  // ── 4. Screenshot direto ───────────────────────────────────────────────────
  if (!image) {
    image = await takeScreenshot(url, {
      waitUntil: 'networkidle2',
      timeout: 15_000,
      waitAfterLoad: 2_000,
    }).catch(() => null);
  }

  // ── Fallback de título ─────────────────────────────────────────────────────
  if (!title) {
    if (isProfile && resolvedUsername) title = `@${resolvedUsername} no Instagram`;
    else if (subtype === 'post') title = 'Post no Instagram';
    else title = 'Instagram';
  }

  return {
    type: 'instagram',
    title,
    description,
    image,
    icon: IG_ICON,
    url,
    extra: {
      siteName: 'Instagram',
      subtype,
      username: resolvedUsername,
      postId,
      isProfile,
    },
  };
}
