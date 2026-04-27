import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CACHE_DIR = '/opt/render/.cache/puppeteer';

function findChromeSync() {
  try {
    // Busca recursiva pelo binário
    const result = execSync(
      `find ${CACHE_DIR} -name "chrome" -type f 2>/dev/null | head -1`
    ).toString().trim();
    return result || null;
  } catch {
    return null;
  }
}

export async function ensureChrome() {
  let chromePath = findChromeSync();

  if (chromePath && fs.existsSync(chromePath)) {
    console.log('[Chrome] Encontrado em:', chromePath);
    return chromePath;
  }

  console.log('[Chrome] Instalando...');
  execSync('node node_modules/puppeteer/install.mjs', {
    stdio: 'inherit',
    env: { ...process.env, PUPPETEER_CACHE_DIR: CACHE_DIR },
  });

  chromePath = findChromeSync();
  console.log('[Chrome] Path após instalação:', chromePath);
  return chromePath;
}
