// src/resolvers/linkedin.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';
import { decodeHTMLEntities } from '../utils/decodeEntities.js'; // ✅ usa utilitário compartilhado

const LINKEDIN_ICON = 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7bnqekz8apd224h';

const SCRAPER_UAS = [
  'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
];

const LINKEDIN_SUBTYPES = {
  '/in/': 'profile',
  '/company/': 'company',
  '/jobs/': 'job',
  '/posts/': 'post',
  '/feed/update/': 'post',
  '/learning/': 'course',
  '/school/': 'school',
  '/groups/': 'group',
};

function parseLinkedinUrl(url) {
  try {
    const { pathname } = new URL(url);
    for (const [pattern, subtype] of Object.entries(LINKEDIN_SUBTYPES)) {
      if (pathname.includes(pattern)) {
        const after = pathname.split(pattern)[1] ?? '';
        const rawSlug = after.split('/').filter(Boolean)[0] ?? '';
        const slug = rawSlug.replace(/-\d{6,}$/, '').replace(/-/g, ' ').trim();
        return { subtype, slug };
      }
    }
    return { subtype: 'generic', slug: null };
  } catch {
    return { subtype: 'generic', slug: null };
  }
}

function getFallbackTitle(subtype, slug) {
  const subtypeTitles = {
    profile: 'Perfil no LinkedIn',
    company: 'Empresa no LinkedIn',
    job: 'Vaga no LinkedIn',
    post: 'Post no LinkedIn',
    course: 'Curso no LinkedIn',
    school: 'Escola no LinkedIn',
    group: 'Grupo no LinkedIn',
    generic: 'LinkedIn',
  };
  const label = subtypeTitles[subtype] ?? 'LinkedIn';
  if (slug && slug.length > 2) {
    const readable = slug.replace(/\b\w/g, c => c.toUpperCase());
    return `${readable} — ${label}`;
  }
  return label;
}

function cleanLinkedinTitle(title) {
  if (!title) return null;
  return title.replace(/\s+\d{6,}\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
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

      if (ogImage || ogTitle) {
        return {
          title:       ogTitle ? decodeHTMLEntities(ogTitle) : null,
          description: ogDesc  ? decodeHTMLEntities(ogDesc)  : null,
          image:       ogImage ? decodeHTMLEntities(ogImage) : null, // ✅ fix &amp; na URL
        };
      }
    } catch {
      // tenta próximo UA
    }
  }
  return {};
}

async function resolveViaOembed(url) {
  const oembedUrl = `https://www.linkedin.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });
  return {
    title: data.title || null,
    image: data.thumbnail_url ? decodeHTMLEntities(data.thumbnail_url) : null, // ✅ fix oEmbed também
  };
}

export async function resolveLinkedin(url) {
  const { subtype, slug } = parseLinkedinUrl(url);

  let title = null;
  let description = null;
  let image = null;

  // ── 1. oEmbed ─────────────────────────────────────────────────────────────
  try {
    const oembed = await resolveViaOembed(url);
    title = oembed.title;
    image = oembed.image;
  } catch {
    // esperado para perfis/empresas
  }

  // ── 2. HTTP + UA social ───────────────────────────────────────────────────
  if (!title || !image) {
    try {
      const og = await resolveViaHttpOg(url);
      title = title || og.title       || null;
      description = description || og.description || null;
      image = image || og.image       || null;
    } catch (err) {
      console.warn('[LinkedIn] HTTP OG falhou:', err.message);
    }
  }

  // ── 3. Browser scraping ───────────────────────────────────────────────────
  if (!title || !image) {
    try {
      const browser = await scrapeWithBrowser(url);
      title = title || browser.title || null;
      description = description || browser.description?.slice(0, 400) || null;
      if (!image && browser.image?.startsWith('http')) image = browser.image;
    } catch {
      // bloqueado — esperado
    }
  }

  // ── 4. Screenshot ─────────────────────────────────────────────────────────
  if (!image) {
    image = await takeScreenshot(url, {
      waitUntil: 'networkidle2',
      timeout: 15_000,
      waitAfterLoad: 2_000,
    }).catch(() => null);
  }

  // ── Limpa título e aplica fallback ────────────────────────────────────────
  title = cleanLinkedinTitle(title) || getFallbackTitle(subtype, slug);

  return {
    type: 'linkedin',
    title,
    description,
    image,
    icon: LINKEDIN_ICON,
    url,
    extra: {
      siteName: 'LinkedIn',
      subtype,
    },
  };
}
