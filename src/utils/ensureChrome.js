// src/utils/ensureChrome.js
import fs from 'fs';
import puppeteer from 'puppeteer';
import { PUPPETEER_CACHE_DIR, CHROME_GLOB, pickChromeBinary } from './puppeteerConfig.js';
import { glob } from 'glob';

async function findChrome() {
  // 1. Variável de ambiente explícita
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath && fs.existsSync(envPath)) {
    console.info(`[Chrome] Encontrado via PUPPETEER_EXECUTABLE_PATH: ${envPath}`);
    return envPath;
  }

  // 2. puppeteer.executablePath()
  try {
    const defaultPath = puppeteer.executablePath();
    if (fs.existsSync(defaultPath)) {
      console.info(`[Chrome] Encontrado via puppeteer.executablePath(): ${defaultPath}`);
      return defaultPath;
    }
  } catch (_) { }

  // 3. CHROME_GLOB (fallback original)
  const matches = await glob(CHROME_GLOB);
  const picked = pickChromeBinary(matches);
  if (picked) {
    console.info(`[Chrome] Encontrado via CHROME_GLOB: ${picked}`);
    return picked;
  }

  return null;
}

export async function ensureChrome() {
  const chromePath = await findChrome();
  if (chromePath) return chromePath;

  throw new Error(
    `[Chrome] Binário não encontrado. ` +
    `PUPPETEER_EXECUTABLE_PATH=${process.env.PUPPETEER_EXECUTABLE_PATH} | ` +
    `CHROME_GLOB=${CHROME_GLOB}`
  );
}
