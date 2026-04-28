// src/resolvers/youtube.js
import axios from 'axios';
import { extractYoutubeVideoId, getFaviconUrl, parseISODuration } from '../utils/detectSource.js';

async function resolveYoutubeOembed(url) {
  const videoId = extractYoutubeVideoId(url);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });

  return {
    type: 'youtube',
    title: data.title || null,
    description: null,
    image: data.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
    icon: getFaviconUrl(url),
    url,
    extra: {
      siteName: 'YouTube',
      videoId,
      channel: data.author_name || null,
      channelUrl: data.author_url || null,
      duration: null,
    },
  };
}

export async function resolveYoutube(url) {
  const videoId = extractYoutubeVideoId(url);
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || !videoId) {
    return resolveYoutubeOembed(url);
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
    const { data } = await axios.get(apiUrl, { timeout: 8000 });

    if (!data.items?.length) return resolveYoutubeOembed(url);

    const item = data.items[0];
    const snippet = item.snippet;
    const details = item.contentDetails;

    return {
      type: 'youtube',
      title: snippet.title || null,
      description: snippet.description?.slice(0, 300) || null, // ✅ era `videoData` — ReferenceError
      image:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
      icon: getFaviconUrl(url),
      url,
      extra: {
        siteName: 'YouTube',
        videoId,
        channel: snippet.channelTitle || null,
        channelId: snippet.channelId || null,
        duration: parseISODuration(details.duration),
        publishedAt: snippet.publishedAt || null,
        tags: snippet.tags?.slice(0, 5) || [],
      },
    };
  } catch {
    return resolveYoutubeOembed(url);
  }
}
