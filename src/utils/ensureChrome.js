import { execSync } from 'child_process';
import fs from 'fs';
import { glob } from 'glob';

export async function ensureChrome() {
  const matches = await glob(
    '/opt/render/.cache/puppeteer/chrome/**/chrome'
  );

  if (matches.length > 0 && fs.existsSync(matches[0])) {
    console.log('[Chrome] Encontrado em:', matches[0]);
    return matches[0];
  }

  console.log('[Chrome] Não encontrado. Instalando via Puppeteer...');

  try {
    execSync('node node_modules/puppeteer/install.mjs', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer',
      },
    });
    console.log('[Chrome] Instalado com sucesso!');
  } catch (err) {
    console.error('[Chrome] Falhou ao instalar:', err.message);
  }

  const afterInstall = await glob(
    '/opt/render/.cache/puppeteer/chrome/**/chrome'
  );

  return afterInstall[0] ?? null;
}
