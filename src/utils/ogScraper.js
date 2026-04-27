import ogs from 'open-graph-scraper';

export async function tryOpenGraph(url) {
  try {
    const { result } = await ogs({
      url,
      timeout: 10000,
      fetchOptions: {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; URLPreviewBot/1.0)' },
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
