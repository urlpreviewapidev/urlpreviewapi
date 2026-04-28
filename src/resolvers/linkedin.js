// src/resolvers/linkedin.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const LINKEDIN_ICON = 'https://static.licdn.com/aero-v1/sc/h/al2o9zrvru7bnqekz8apd224h';

function parseLinkedinUrl(url) {
  try {
    const { pathname } = new URL(url);
    if (/\/in\//.test(pathname)) return { subtype: 'profile' };
    if (/\/company\//.test(pathname)) return { subtype: 'company' };
    if (/\/jobs\//.test(pathname)) return { subtype: 'job' };
    if (/\/posts\/|\/feed\/update\//.test(pathname)) return { subtype: 'post' };
    if (/\/learning\//.test(pathname)) return { subtype: 'course' };
    return { subtype: 'generic' };
  } catch {
    return { subtype: 'generic' };
  }
}

async function resolveViaOembed(url) {
  const oembedUrl = `https://www.linkedin.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });

  return {
    title: data.title || null,
    description: null,
    image: data.thumbnail_url || null,
    icon: LINKEDIN_ICON,
  };
}

export async function resolveLinkedin(url) {
  const { subtype } = parseLinkedinUrl(url);

  let oembed = {};
  try {
    oembed = await resolveViaOembed(url);
  } catch {
    // LinkedIn restringe oEmbed para muitos tipos — tudo bem
  }

  let browser = {};
  const needsBrowser = !oembed.title || !oembed.image;
  if (needsBrowser) {
    browser = await scrapeWithBrowser(url, {
      takeScreenshot: !oembed.image,
    }).catch(() => ({}));
  }

  const title = oembed.title || browser.title || null;
  const description = browser.description?.slice(0, 400) || null;
  const image =
    oembed.image ||
    browser.screenshot ||
    (browser.image?.startsWith('http') ? browser.image : null) ||
    (await takeScreenshot(url).catch(() => null));

  if (!title) throw new Error('Não foi possível extrair metadados do LinkedIn.');

  return {
    type: 'linkedin',
    title,
    description,
    image,
    icon: LINKEDIN_ICON,
    url,
    extra: {
      siteName: 'LinkedIn',
      subtype, // 'profile' | 'company' | 'job' | 'post' | 'course' | 'generic'
    },
  };
}
