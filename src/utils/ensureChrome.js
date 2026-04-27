import { glob } from 'glob';

async function findChrome() {
  const matches = await glob(
    '/opt/render/.cache/puppeteer/chrome/linux-*/chrome-linux64/chrome'
  );
  return matches.find(p => !p.includes('sandbox') && !p.includes('wrapper')) ?? null;
}

export async function ensureChrome() {
  const chromePath = await findChrome();

  if (chromePath) {
    console.log('[Chrome] Encontrado em:', chromePath);
    return chromePath;
  }

  console.log('[Chrome] Não encontrado!');
  return null;
}
