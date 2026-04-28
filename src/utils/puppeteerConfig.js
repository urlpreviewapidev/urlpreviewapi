// src/utils/puppeteerConfig.js
import os from 'os';

export const PUPPETEER_CACHE_DIR =
  process.env.PUPPETEER_CACHE_DIR ||
  (process.env.RENDER
    ? '/opt/render/.cache/puppeteer'
    : `${os.homedir()}/.cache/puppeteer`);

export const CHROME_GLOB =
  `${PUPPETEER_CACHE_DIR}/chrome/linux-*/chrome-linux64/chrome`;

/**
 * Filtra os binários encontrados pelo glob, excluindo wrappers e sandboxes.
 * @param {string[]} matches
 * @returns {string|null}
 */
export function pickChromeBinary(matches) {
  return (
    matches.find(p => !p.includes('sandbox') && !p.includes('wrapper')) ?? null
  );
}
