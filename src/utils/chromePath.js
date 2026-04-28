// src/utils/chromePath.js
import { glob } from 'glob';
import { CHROME_GLOB, pickChromeBinary } from './puppeteerConfig.js';

/**
 * Retorna o caminho do binário do Chrome no cache do Puppeteer.
 *
 * Retorna null em dois casos:
 *   - NODE_ENV !== 'production' (Puppeteer usa seu próprio bundled Chrome)
 *   - binário não encontrado no cache
 *
 * NUNCA retorna undefined — assim os callers podem checar === null com segurança.
 *
 * @returns {Promise<string|null>}
 */
export async function getChromePath() {
  // Em dev o Puppeteer resolve o Chrome internamente — não força o cache
  if (process.env.NODE_ENV !== 'production') return null;

  const matches = await glob(CHROME_GLOB);
  return pickChromeBinary(matches);
}
