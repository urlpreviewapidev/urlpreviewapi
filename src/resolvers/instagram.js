// src/resolvers/instagram.js
import axios from 'axios';
import { getFaviconUrl } from '../utils/detectSource.js';
import { scrapeWithBrowser } from '../utils/browserScraper.js';

const IG_ICON = 'https://www.google.com/s2/favicons?domain=www.instagram.com&sz=64';

function parseInstagramUrl(url) {
  try {
    const { pathname } = new URL(url);

    // /p/CODE ou /reel/CODE
    const postMatch = pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    if (postMatch) return { subtype: 'post', username: null, postId: postMatch[2], isProfile: false };

    // /@username ou /username
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

export async function resolveInstagram(url) {
  const { subtype, username, postId, isProfile } = parseInstagramUrl(url);

  let title = null;
  let description = null;
  let image = null;
  let resolvedUsername = username;

  // oEmbed só funciona para posts/reels públicos com token do Facebook
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

  // Browser scraping como complemento
  if (!title || !image) {
    try {
      const browser = await scrapeWithBrowser(url, { takeScreenshot: !image });
      title = title || browser.title || null;
      description = browser.description?.slice(0, 400) || null;
      image = image || browser.screenshot || (browser.image?.startsWith('http') ? browser.image : null);
    } catch (err) {
      console.warn('[Instagram] Browser scraping falhou:', err.message);
    }
  }

  // Fallback de título por tipo
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
