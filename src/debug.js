import axios from 'axios';
import * as cheerio from 'cheerio';

export async function debugUrl(url) {
  const { data: html } = await axios.get(url, {
    timeout: 10000,
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
    allImages.push({ src: $(el).attr('src'), width: $(el).attr('width'), height: $(el).attr('height'), alt: $(el).attr('alt') });
  });

  return {
    title: $('title').text().trim(),
    h1: $('h1').first().text().trim(),
    metaTags: allMeta,
    linkTags: allLinks,
    images: allImages.slice(0, 20),
    htmlSnippet: html.slice(0, 2000),
  };
}
