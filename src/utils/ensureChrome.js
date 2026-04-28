// src/utils/ensureChrome.js
import fs from 'fs';
import { spawn } from 'child_process';   // ✅ async, não bloqueia event loop
import { glob } from 'glob';
import { PUPPETEER_CACHE_DIR, CHROME_GLOB, pickChromeBinary } from './puppeteerConfig.js';

async function findChrome() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    console.info(`[Chrome] ✅ Encontrado via env: ${envPath}`);
    return envPath;
  }

  const matches = await glob(CHROME_GLOB);
  const picked = pickChromeBinary(matches);
  if (picked && fs.existsSync(picked)) {
    console.info(`[Chrome] ✅ Encontrado via glob: ${picked}`);
    return picked;
  }

  return null;
}

// ✅ Substitui execSync por spawn — não bloqueia o event loop durante download
function installChrome(cacheDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['puppeteer', 'browsers', 'install', 'chrome'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: cacheDir,
          PUPPETEER_SKIP_DOWNLOAD: '',
        },
      }
    );

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`[Chrome] npx puppeteer browsers install saiu com código ${code}`));
    });

    child.on('error', (err) => {
      reject(new Error(`[Chrome] Falha ao executar instalação: ${err.message}`));
    });
  });
}

export async function ensureChrome() {
  let chromePath = await findChrome();
  if (chromePath) return chromePath;

  console.info(`[Chrome] ⬇️  Binário ausente — baixando em: ${PUPPETEER_CACHE_DIR}`);

  await installChrome(PUPPETEER_CACHE_DIR); // ✅ await async, event loop livre

  chromePath = await findChrome();
  if (!chromePath) {
    throw new Error(
      `[Chrome] Download concluído mas binário não encontrado. CHROME_GLOB=${CHROME_GLOB}`
    );
  }

  console.info(`[Chrome] ✅ Instalado em: ${chromePath}`);
  return chromePath;
}
