import axios from 'axios';
import { extractYoutubeVideoId, getFaviconUrl, parseISODuration } from '../utils/detectSource.js';

async function resolveYoutubeOembed(url) {
  const videoId = extractYoutubeVideoId(url);
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });

  return {
    type: 'youtube',
    title: data.title,
    description: null,
    image: data.thumbnail_url || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null),
    icon: getFaviconUrl(url),
    url,
    extra: {
      videoId,
      channel: data.author_name,
      channelUrl: data.author_url,
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
      title: snippet.title,
      description: videoData.description?.slice(0, 300) || null,
      image:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        null,
      icon: getFaviconUrl(url),
      url,
      extra: {
        siteName: 'YouTube', // ← adiciona hardcoded
        videoId,
        channel: snippet.channelTitle,
        channelId: snippet.channelId,
        duration: parseISODuration(details.duration),
        publishedAt: snippet.publishedAt,
        tags: snippet.tags?.slice(0, 5) || [],
      },
    };
  } catch {
    return resolveYoutubeOembed(url);
  }
}
