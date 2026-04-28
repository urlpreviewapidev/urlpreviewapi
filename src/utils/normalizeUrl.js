// src/utils/normalizeUrl.js
import { detectSource, extractYoutubeVideoId, SOURCES } from './detectSource.js';

/**
 * Normaliza a URL removendo query params desnecessários,
 * garantindo que a mesma página não seja tratada como URLs distintas.
 */
export function normalizeUrl(rawUrl) {
  function cleanUrl(url, keepParams = []) {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (!keepParams.includes(key)) u.searchParams.delete(key);
    }
    // Remove `?` se não sobrou nenhum param
    return u.searchParams.size === 0
      ? `${u.origin}${u.pathname}${u.hash}`
      : u.toString();
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL inválida');
  }

  const source = detectSource(rawUrl);

  switch (source) {
    case SOURCES.YOUTUBE: {
      // Mantém apenas o param `v` para vídeos normais
      const videoId = extractYoutubeVideoId(rawUrl);

      // youtu.be/VIDEO_ID → normaliza para youtube.com/watch?v=
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }

      // Shorts, playlists, etc → mantém pathname + apenas params essenciais
      const clean = new URL('https://www.youtube.com');
      clean.pathname = url.pathname;
      if (url.searchParams.has('list')) clean.searchParams.set('list', url.searchParams.get('list'));
      return clean.toString();
    }

    case SOURCES.INSTAGRAM: {
      // Remove query params e trailing slash
      const clean = `${url.origin}${url.pathname}`.replace(/\/$/, '');
      return clean;
    }

    case SOURCES.TWITTER: return cleanUrl(rawUrl, ['lang']);

    case SOURCES.SPOTIFY: return cleanUrl(rawUrl, []);

    default: {
      // Remove params de tracking comuns (utm_*, fbclid, gclid, ref, etc)
      const TRACKING_PARAMS = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'mc_eid', 'ref', 'source', '_ga',
      ];
      const clean = new URL(rawUrl);
      for (const param of TRACKING_PARAMS) clean.searchParams.delete(param);
      return clean.toString();
    }
  }
}
