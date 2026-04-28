// src/utils/normalizeUrl.js
import { detectSource, extractYoutubeVideoId, SOURCES } from './detectSource.js';

export function normalizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') throw new Error('URL inválida');

  // Garante protocolo
  const withProtocol = /^https?:\/\//i.test(rawUrl.trim())
    ? rawUrl.trim()
    : `https://${rawUrl.trim()}`;

  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`URL malformada: ${rawUrl}`);
  }

  // ✅ Remove hash em todos os casos (nunca faz parte da identidade do recurso)
  url.hash = '';

  function stripAllParams() {
    for (const key of [...url.searchParams.keys()]) url.searchParams.delete(key);
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  function stripTracking() {
    const TRACKING = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_eid', 'ref', 'source', '_ga', 'igshid', 'si',
    ];
    TRACKING.forEach(p => url.searchParams.delete(p));
    return url.toString().replace(/\/+$/, '');
  }

  const source = detectSource(withProtocol);

  switch (source) {

    case SOURCES.YOUTUBE: {
      const videoId = extractYoutubeVideoId(withProtocol);
      if (videoId) return `https://www.youtube.com/watch?v=${videoId}`;
      // Shorts, playlists
      const clean = new URL('https://www.youtube.com');
      clean.pathname = url.pathname;
      if (url.searchParams.has('list'))
        clean.searchParams.set('list', url.searchParams.get('list'));
      return clean.toString();
    }

    case SOURCES.INSTAGRAM:
    case SOURCES.TIKTOK: {
      // ✅ Remove TODO query param — perfis/vídeos se identificam só pelo pathname
      return stripAllParams();
    }

    case SOURCES.LINKEDIN: {
      // ✅ Remove query params de tracking, preserva pathname
      return stripAllParams();
    }

    case SOURCES.GITHUB: {
      return stripAllParams();
    }

    case SOURCES.TWITTER: {
      for (const key of [...url.searchParams.keys()]) {
        if (key !== 'lang') url.searchParams.delete(key);
      }
      return url.toString().replace(/\/+$/, '');
    }

    case SOURCES.SPOTIFY: {
      return stripAllParams();
    }

    default: {
      return stripTracking();
    }
  }
}
