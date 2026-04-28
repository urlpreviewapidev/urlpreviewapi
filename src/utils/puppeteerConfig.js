// src/utils/puppeteerConfig.js
import os from 'os';

export const PUPPETEER_CACHE_DIR =
  process.env.PUPPETEER_CACHE_DIR ?? `/opt/render/.cache/puppeteer`;

export const CHROME_GLOB =
  `${PUPPETEER_CACHE_DIR}/chrome/linux-*/chrome-linux64/chrome`;

export function pickChromeBinary(matches) {
  return (
    matches.find(p => !p.includes('sandbox') && !p.includes('wrapper')) ?? null
  );
}
