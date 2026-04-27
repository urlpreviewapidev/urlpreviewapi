import { glob } from 'glob';

async function getChromePath() {
  const matches = await glob(
    '/opt/render/.cache/puppeteer/chrome/**/chrome'
  );
  return matches[0] ?? null;
}

// No launch do puppeteer:
const executablePath = await getChromePath();

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
});
