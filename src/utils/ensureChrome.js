// src/utils/ensureChrome.js
import fs from 'fs';
import { execSync } from 'child_process';
import { glob } from 'glob';
import { PUPPETEER_CACHE_DIR, CHROME_GLOB, pickChromeBinary } from './puppeteerConfig.js';

async function findChrome() {
  // 1. Env var explícita
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    console.info(`[Chrome] ✅ Encontrado via env: ${envPath}`);
    return envPath;
  }

  // 2. Glob no cache dir
  const matches = await glob(CHROME_GLOB);
  const picked = pickChromeBinary(matches);
  if (picked && fs.existsSync(picked)) {
    console.info(`[Chrome] ✅ Encontrado via glob: ${picked}`);
    return picked;
  }

  return null;
}

export async function ensureChrome() {
  let chromePath = await findChrome();
  if (chromePath) return chromePath;

  console.info(`[Chrome] ⬇️  Binário ausente — baixando agora em: ${PUPPETEER_CACHE_DIR}`);

  try {
    execSync('npx puppeteer browsers install chrome', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PUPPETEER_CACHE_DIR,
        PUPPETEER_SKIP_DOWNLOAD: '',   // ← garante que NÃO pula o download
      },
    });
  } catch (err) {
    throw new Error(`[Chrome] Falha ao baixar: ${err.message}`);
  }

  chromePath = await findChrome();
  if (!chromePath) {
    throw new Error(`[Chrome] Download concluído mas binário não encontrado. CHROME_GLOB=${CHROME_GLOB}`);
  }

  console.info(`[Chrome] ✅ Instalado em: ${chromePath}`);
  return chromePath;
}
