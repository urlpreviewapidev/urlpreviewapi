import { execSync } from 'child_process';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const CHROME_GLOB = '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome';

async function findChrome() {
  const matches = await glob(CHROME_GLOB);
  return matches.find(p => !p.includes('sandbox') && !p.includes('wrapper')) ?? null;
}

export async function ensureChrome() {
  let chromePath = await findChrome();

  if (chromePath) {
    console.log('[Chrome] Encontrado em:', chromePath);
    return chromePath;
  }

  console.log('[Chrome] Não encontrado. Baixando agora...');
  try {
    execSync('node node_modules/puppeteer/install.mjs', {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer',
      },
    });
  } catch (err) {
    console.error('[Chrome] Falha ao instalar:', err.message);
    throw err;
  }

  chromePath = await findChrome();
  if (!chromePath) throw new Error('[Chrome] Instalado mas binário não encontrado!');

  console.log('[Chrome] Pronto em:', chromePath);
  return chromePath;
}
