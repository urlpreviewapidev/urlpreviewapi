// src/utils/ensureChrome.js
import { execSync } from 'child_process';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { PUPPETEER_CACHE_DIR, CHROME_GLOB, pickChromeBinary } from './puppeteerConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

async function findChrome() {
  const matches = await glob(CHROME_GLOB);
  return pickChromeBinary(matches);
}

/**
 * Garante que o Chrome está disponível no cache do Puppeteer.
 * Se não encontrar, executa o script de instalação do Puppeteer.
 *
 * @returns {Promise<string>} caminho absoluto do binário
 */
export async function ensureChrome() {
  let chromePath = await findChrome();
  if (chromePath) return chromePath;

  console.log('[Chrome] Binário não encontrado — iniciando instalação...');

  try {
    execSync('node node_modules/puppeteer/install.mjs', {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR,   // ← usa a constante centralizada
      },
    });
  } catch (err) {
    console.error('[Chrome] Falha ao instalar:', err.message);
    throw err;
  }

  chromePath = await findChrome();
  if (!chromePath) {
    throw new Error('[Chrome] Instalado mas binário não encontrado — verifique o CHROME_GLOB.');
  }

  return chromePath;
}
