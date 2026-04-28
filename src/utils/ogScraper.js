// src/utils/ogScraper.js
import ogs from 'open-graph-scraper';

const TIMEOUT_MS = 10_000;

export async function tryOpenGraph(url) {
  try {
    // ✅ ogs v6+: timeout via AbortSignal dentro de fetchOptions
    const { result } = await ogs({
      url,
      fetchOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URLPreviewBot/1.0)' },
        signal: AbortSignal.timeout(TIMEOUT_MS), // ✅ era: timeout: 10000 no root (ignorado)
      },
    });

    return {
      title: result.ogTitle || result.twitterTitle || null,
      description: result.ogDescription || result.twitterDescription || null,
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || null,
      favicon: result.favicon || null,
      siteName: result.ogSiteName || null,
      locale: result.ogLocale || null,
      canonicalUrl: result.ogUrl || null,
    };
  } catch {
    return {};
  }
}
