// src/debug.js
import axios from 'axios';
import * as cheerio from 'cheerio';

// ✅ Bloqueia IPs privados / loopback / metadata cloud — previne SSRF
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,        // AWS/GCP/Azure metadata
  /^fc00:/i,            // IPv6 privado
  /^fe80:/i,            // IPv6 link-local
  /^::1$/,              // IPv6 loopback
  /\.internal$/i,
  /\.local$/i,
];

function isBlockedHost(hostname) {
  return BLOCKED_PATTERNS.some(pattern => pattern.test(hostname));
}

export async function debugUrl(url) {
  // ✅ Valida host antes de fazer qualquer requisição
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('URL malformada');
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`Host bloqueado por política de segurança: ${parsed.hostname}`);
  }

  const { data: html } = await axios.get(url, {
    timeout: 10_000,
    maxContentLength: 5 * 1024 * 1024,  // ✅ máx 5MB — era ilimitado
    maxBodyLength: 5 * 1024 * 1024,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  const $ = cheerio.load(html);

  const allMeta = [];
  $('meta').each((_, el) => {
    const name = $(el).attr('name');
    const property = $(el).attr('property');
    const content = $(el).attr('content');
    if ((name || property) && content) allMeta.push({ name: name || property, content });
  });

  const allLinks = [];
  $('link').each((_, el) => {
    const rel = $(el).attr('rel');
    const href = $(el).attr('href');
    if (rel && href) allLinks.push({ rel, href });
  });

  const allImages = [];
  $('img').each((_, el) => {
    allImages.push({
      src: $(el).attr('src') || null,
      width: $(el).attr('width') || null,
      height: $(el).attr('height') || null,
      alt: $(el).attr('alt') || null,
    });
  });

  return {
    title: $('title').first().text().trim(),
    h1: $('h1').first().text().trim(),
    metaTags: allMeta,
    linkTags: allLinks,
    images: allImages.slice(0, 20),
    htmlSnippet: html.slice(0, 2000),
  };
}
