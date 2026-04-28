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

// ✅ In-process lock: evita scraping duplicado para a mesma URL simultânea
// Map<url, Promise> — requisições concorrentes aguardam a mesma Promise
const inflightMap = new Map();

async function scrape(normalizedUrl, source) {
  switch (source) {
    case SOURCES.YOUTUBE: return resolveYoutube(normalizedUrl);
    case SOURCES.INSTAGRAM: return resolveInstagram(normalizedUrl);
    case SOURCES.LINKEDIN: return resolveLinkedin(normalizedUrl);
    case SOURCES.TIKTOK: return resolveTiktok(normalizedUrl);
    case SOURCES.GITHUB: return resolveGithub(normalizedUrl);
    default: return resolveGeneric(normalizedUrl, source);
  }
}

async function scrapeAndSave(url, source) {
  const scraped = await scrape(url, source);
  scraped.url = url;

  // Garante que type bate com o source detectado apenas quando o resolver
  // retornou 'generic' para uma fonte específica (fallback interno)
  if (!scraped.type || (scraped.type === 'generic' && source !== SOURCES.GENERIC)) {
    scraped.type = source;
  }

  return createPreview(scraped, scraped.image ?? null);
}

export async function getPreview(rawUrl) {
  const url = normalizeUrl(rawUrl);
  console.log(`[Preview] URL normalizada: ${url}`);

  // ── 1. Cache hit ─────────────────────────────────────────────────────────
  const cached = await findByUrl(url);
  if (cached) {
    console.log(`[Preview] Cache hit → ${url}`);
    return { ...cached, cached: true };
  }

  // ── 2. Já existe uma requisição em voo para esta URL? ────────────────────
  if (inflightMap.has(url)) {
    console.log(`[Preview] Aguardando requisição em voo → ${url}`);
    // ✅ Segunda requisição aguarda a mesma Promise — zero scraping duplicado
    const saved = await inflightMap.get(url);
    return { ...saved, cached: true };
  }

  // ── 3. Inicia scraping e registra no map ─────────────────────────────────
  const source = detectSource(url);
  console.log(`[Preview] Scraping → ${url} (source: ${source})`);

  const promise = scrapeAndSave(url, source).finally(() => {
    // ✅ Remove do map quando termina (sucesso ou erro)
    inflightMap.delete(url);
  });

  inflightMap.set(url, promise);

  const saved = await promise;
  return { ...saved, cached: false };
}
