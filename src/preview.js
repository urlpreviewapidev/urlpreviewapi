import { detectSource, SOURCES } from './utils/detectSource.js';
import { resolveYoutube } from './resolvers/youtube.js';
import { resolveInstagram } from './resolvers/instagram.js';
import { resolveGeneric } from './resolvers/generic.js';

/**
 * Retorna o preview de qualquer URL
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function getPreview(url) {
  const source = detectSource(url);

  switch (source) {
    case SOURCES.YOUTUBE:
      return resolveYoutube(url);

    case SOURCES.INSTAGRAM:
      return resolveInstagram(url);

    case SOURCES.FACEBOOK:
    case SOURCES.TWITTER:
    case SOURCES.TIKTOK:
    case SOURCES.LINKEDIN:
    case SOURCES.GITHUB:
    case SOURCES.SPOTIFY:
      return resolveGeneric(url, source);

    default:
      return resolveGeneric(url, SOURCES.GENERIC);
  }
}
