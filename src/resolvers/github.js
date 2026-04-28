// src/resolvers/github.js
import axios from 'axios';
import { scrapeWithBrowser } from '../utils/browserScraper.js';
import { takeScreenshot } from '../utils/screenshotService.js';

const GITHUB_ICON = 'https://github.githubassets.com/favicons/favicon.svg';

// ✅ Função lazy — lê o token no momento da chamada, não no import
function getGithubHeaders() {
  const headers = { 'User-Agent': 'url-preview-api' };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function getOgImage(owner, repo = null) {
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
  const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: getGithubHeaders(), // ✅ lê token no momento da chamada
    timeout: 8000,
  });

  return {
    type: 'github',
    title: data.full_name || `${owner}/${repo}`,
    description: data.description?.slice(0, 400) || null,
    image: getOgImage(owner, repo),
    icon: GITHUB_ICON,
    url: data.html_url || url,
    extra: {
      siteName: 'GitHub',
      owner: data.owner?.login || owner,
      repo: data.name || repo,
      stars: data.stargazers_count,
      forks: data.forks_count,
      watchers: data.watchers_count,
      language: data.language || null,
      topics: data.topics?.slice(0, 8) || [],
      isPrivate: data.private,
      isFork: data.fork,
      openIssues: data.open_issues_count,
      license: data.license?.spdx_id || null,
      defaultBranch: data.default_branch || null,
      pushedAt: data.pushed_at || null,
      createdAt: data.created_at || null,
    },
  };
}

async function resolveProfile(owner, url) {
  const { data } = await axios.get(`https://api.github.com/users/${owner}`, {
    headers: getGithubHeaders(), // ✅ lê token no momento da chamada
    timeout: 8000,
  });

  return {
    type: 'github',
    title: data.name || data.login || owner,
    description: data.bio?.slice(0, 400) || null,
    image: getOgImage(owner),
    icon: GITHUB_ICON,
    url: data.html_url || url,
    extra: {
      siteName: 'GitHub',
      username: data.login,
      avatarUrl: data.avatar_url || null,
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
      title: browser.title || `${owner}${repo ? `/${repo}` : ''} — GitHub`,
      description: browser.description?.slice(0, 400) || null,
      image: browser.screenshot || getOgImage(owner, repo ?? undefined),
      icon: GITHUB_ICON,
      url,
      extra: { siteName: 'GitHub' },
    };
  }
}
