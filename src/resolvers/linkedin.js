// src/resolvers/linkedin.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const LINKEDIN_ICON = 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7bnqekz8apd224h';

const LINKEDIN_SUBTYPES = {
  '/in/':                    'profile',
  '/company/':               'company',
  '/jobs/':                  'job',
  '/posts/':                 'post',
  '/feed/update/':           'post',
  '/learning/':              'course',
  '/school/':                'school',
  '/groups/':                'group',
};

function parseLinkedinUrl(url) {
  try {
    const { pathname } = new URL(url);
    for (const [pattern, subtype] of Object.entries(LINKEDIN_SUBTYPES)) {
      if (pathname.includes(pattern)) return { subtype };
    }
    return { subtype: 'generic' };
  } catch {
    return { subtype: 'generic' };
  }
}

// Títulos amigáveis por subtype quando nada puder ser extraído
function getFallbackTitle(subtype, url) {
  const subtypeTitles = {
    profile:  'Perfil no LinkedIn',
    company:  'Empresa no LinkedIn',
    job:      'Vaga no LinkedIn',
    post:     'Post no LinkedIn',
    course:   'Curso no LinkedIn',
    school:   'Escola no LinkedIn',
    group:    'Grupo no LinkedIn',
    generic:  'LinkedIn',
  };

  // Tenta extrair slug da URL para título mais descritivo
  try {
    const { pathname } = new URL(url);
    const slug = pathname.split('/').filter(Boolean).pop();
    if (slug && slug.length > 2) {
      const readable = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `${readable} — ${subtypeTitles[subtype] ?? 'LinkedIn'}`;
    }
  } catch { /* ignora */ }

  return subtypeTitles[subtype] ?? 'LinkedIn';
}

async function resolveViaOembed(url) {
  const oembedUrl = `https://www.linkedin.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });
  return {
    title:       data.title         || null,
    description: null,
    image:       data.thumbnail_url || null,
  };
}

export async function resolveLinkedin(url) {
  const { subtype } = parseLinkedinUrl(url);

  let title       = null;
  let description = null;
  let image       = null;

  // 1ª tentativa: oEmbed (funciona para posts e alguns conteúdos públicos)
  try {
    const oembed = await resolveViaOembed(url);
    title = oembed.title;
    image = oembed.image;
  } catch {
    // LinkedIn bloqueia oEmbed para perfis e empresas — esperado
  }

  // 2ª tentativa: browser scraping
  if (!title || !image) {
    try {
      const browser = await scrapeWithBrowser(url, { takeScreenshot: !image });
      title       = title       || browser.title                              || null;
      description = description || browser.description?.slice(0, 400)        || null;
      image       = image
        || browser.screenshot
        || (browser.image?.startsWith('http') ? browser.image : null)
        || null;
    } catch {
      // LinkedIn bloqueia Puppeteer também — esperado
    }
  }

  // 3ª tentativa: screenshot simples
  if (!image) {
    image = await takeScreenshot(url).catch(() => null);
  }

  // ✅ Fallback gracioso — nunca lança erro, sempre retorna algo útil
  if (!title) {
    title = getFallbackTitle(subtype, url);
  }

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
