import axios from 'axios';
import { getFaviconUrl } from '../utils/detectSource.js';

export async function resolveInstagram(url) {
  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(url)}&format=json`;
    const { data } = await axios.get(oembedUrl, { timeout: 8000 });

    return {
      type: 'instagram',
      title: data.title || data.author_name || 'Post no Instagram',
      description: null,
      image: data.thumbnail_url || null,
      icon: getFaviconUrl(url),
      url,
      extra: {
        author: data.author_name,
        authorUrl: data.author_url,
      },
    };
  } catch {
    return {
      type: 'instagram',
      title: 'Post no Instagram',
      description: 'Visualize este post no Instagram.',
      image: null,
      icon: getFaviconUrl(url),
      url,
      extra: {},
    };
  }
}
