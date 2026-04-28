// src/preview.js
import { detectSource, SOURCES } from './utils/detectSource.js';
import { normalizeUrl } from './utils/normalizeUrl.js';
import { resolveYoutube } from './resolvers/youtube.js';
import { resolveInstagram } from './resolvers/instagram.js';
import { resolveLinkedin } from './resolvers/linkedin.js';
import { resolveTiktok } from './resolvers/tiktok.js';
import { resolveGithub } from './resolvers/github.js';
import { resolveGeneric } from './resolvers/generic.js';
import { findByUrl, createPreview } from './services/previewService.js';

async function scrape(normalizedUrl) {
  const source = detectSource(normalizedUrl);

  switch (source) {
    case SOURCES.YOUTUBE:
      return resolveYoutube(normalizedUrl);
    case SOURCES.INSTAGRAM:
      return resolveInstagram(normalizedUrl);
    case SOURCES.LINKEDIN:
      return resolveLinkedin(normalizedUrl);
    case SOURCES.TIKTOK:
      return resolveTiktok(normalizedUrl);
    case SOURCES.GITHUB:
      return resolveGithub(normalizedUrl);
    default:
      return resolveGeneric(normalizedUrl, source);
  }
}

export async function getPreview(rawUrl) {
  const url = normalizeUrl(rawUrl);
  console.log(`[Preview] URL normalizada: ${url}`);

  const cached = await findByUrl(url);
  if (cached) {
    console.log(`[Preview] Cache hit → ${url}`);
    return { ...cached, cached: true };
  }

  console.log(`[Preview] Scraping → ${url}`);
  const scraped = await scrape(url);

  scraped.url = url;

  const saved = await createPreview(scraped, scraped.image ?? null);

  return { ...saved, cached: false };
}
