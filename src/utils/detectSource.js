export const SOURCES = {
  YOUTUBE: 'youtube',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  TWITTER: 'twitter',
  TIKTOK: 'tiktok',
  LINKEDIN: 'linkedin',
  GITHUB: 'github',
  SPOTIFY: 'spotify',
  GENERIC: 'generic',
};

const SOURCE_PATTERNS = [
  { type: SOURCES.YOUTUBE, regex: /(?:youtube\.com|youtu\.be)/i },
  { type: SOURCES.INSTAGRAM, regex: /instagram\.com/i },
  { type: SOURCES.FACEBOOK, regex: /(?:facebook\.com|fb\.com|fb\.watch)/i },
  { type: SOURCES.TWITTER, regex: /(?:twitter\.com|x\.com)/i },
  { type: SOURCES.TIKTOK, regex: /tiktok\.com/i },
  { type: SOURCES.LINKEDIN, regex: /linkedin\.com/i },
  { type: SOURCES.GITHUB, regex: /github\.com/i },
  { type: SOURCES.SPOTIFY, regex: /open\.spotify\.com/i },
];

export function detectSource(url) {
  for (const { type, regex } of SOURCE_PATTERNS) {
    if (regex.test(url)) return type;
  }
  return SOURCES.GENERIC;
}

export function extractYoutubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function getFaviconUrl(url) {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return null;
  }
}

export function parseISODuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
