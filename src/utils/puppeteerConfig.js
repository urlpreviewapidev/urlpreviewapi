// src/utils/puppeteerConfig.js
import os from 'os';
import fs from 'fs';

// Candidatos em ordem de prioridade
const CACHE_CANDIDATES = [
  process.env.PUPPETEER_CACHE_DIR,
  '/opt/render/project/.cache/puppeteer',   // ← dentro do projeto, persiste!
  '/opt/render/.cache/puppeteer',
  `${os.homedir()}/.cache/puppeteer`,
];

// Usa o primeiro que já existe no disco, ou o primeiro definido
export const PUPPETEER_CACHE_DIR =
  CACHE_CANDIDATES.find(p => p && fs.existsSync(p)) ||
  process.env.PUPPETEER_CACHE_DIR ||
  `${os.homedir()}/.cache/puppeteer`;

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
