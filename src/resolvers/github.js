// src/resolvers/github.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const GITHUB_ICON = 'https://github.githubassets.com/favicons/favicon.svg';
const GITHUB_HEADERS = { 'User-Agent': 'url-preview-api' };

if (process.env.GITHUB_TOKEN) {
  GITHUB_HEADERS['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
}

// ── OG image pública do GitHub (sem Puppeteer) ────────────────────────────
function getOgImage(owner, repo = null) {
  // https://opengraph.githubassets.com/<hash>/<owner>/<repo>
  // O hash não importa — qualquer valor funciona para exibição
  if (repo) return `https://opengraph.githubassets.com/1/${owner}/${repo}`;
  return `https://avatars.githubusercontent.com/${owner}?s=400`;
}

function parseGithubUrl(url) {
  try {
    const { pathname } = new URL(url);
    const parts = pathname.replace(/^\//, '').split('/').filter(Boolean);
    return {
      owner: parts[0] || null,
      repo: parts[1] || null,
      section: parts[2] || null,
    };
  } catch {
    return { owner: null, repo: null, section: null };
  }
}

async function resolveRepo(owner, repo, url) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const { data } = await axios.get(apiUrl, {
    headers: GITHUB_HEADERS,
    timeout: 8000,
  });

  return {
    type: 'github',
    title: data.full_name,
    description: data.description?.slice(0, 400) || null,
    image: getOgImage(owner, repo),   // ✅ OG image estável, sem Puppeteer
    icon: GITHUB_ICON,
    url: data.html_url,
    extra: {
      siteName: 'GitHub',
      owner: data.owner?.login,
      repo: data.name,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      language: data.language,
      topics: data.topics?.slice(0, 8) || [],
      isPrivate: data.private,
      isFork: data.fork,
      openIssues: data.open_issues_count,
      license: data.license?.spdx_id || null,
      defaultBranch: data.default_branch,
      pushedAt: data.pushed_at,
      createdAt: data.created_at,
    },
  };
}

async function resolveProfile(owner, url) {
  const apiUrl = `https://api.github.com/users/${owner}`;
  const { data } = await axios.get(apiUrl, {
    headers: GITHUB_HEADERS,
    timeout: 8000,
  });

  return {
    type: 'github',
    title: data.name || data.login,
    description: data.bio?.slice(0, 400) || null,
    image: getOgImage(owner),   // ✅ avatar via githubusercontent
    icon: GITHUB_ICON,
    url: data.html_url,
    extra: {
      siteName: 'GitHub',
      username: data.login,
      avatarUrl: data.avatar_url,
      company: data.company || null,
      location: data.location || null,
      blog: data.blog || null,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
      type: data.type,
    },
  };
}

export async function resolveGithub(url) {
  const { owner, repo } = parseGithubUrl(url);

  if (!owner) {
    return {
      type: 'github',
      title: 'GitHub',
      description: 'Where the world builds software.',
      image: await takeScreenshot(url).catch(() => null),
      icon: GITHUB_ICON,
      url,
      extra: { siteName: 'GitHub' },
    };
  }

  try {
    if (repo) return await resolveRepo(owner, repo, url);
    return await resolveProfile(owner, url);
  } catch (err) {
    console.warn('[GitHub] API falhou, usando browser:', err.message);
    const browser = await scrapeWithBrowser(url, { takeScreenshot: true }).catch(() => ({}));
    return {
      type: 'github',
      title: browser.title || `${owner}${repo ? `/${repo}` : ''} - GitHub`,
      description: browser.description?.slice(0, 400) || null,
      image: browser.screenshot || getOgImage(owner, repo),  // ✅ fallback OG
      icon: GITHUB_ICON,
      url,
      extra: { siteName: 'GitHub' },
    };
  }
}
