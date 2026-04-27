import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPreview } from './preview.js';
import { debugUrl } from './debug.js';
import { glob } from 'glob';
import { execSync } from 'child_process';
import { ensureChrome } from './utils/ensureChrome.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});
app.use('/preview', limiter);

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

// Flag global — endpoints aguardam o Chrome estar pronto
let chromeReady = false;
let chromeError = null;

function requireChrome(req, res, next) {
  if (chromeError) return res.status(503).json({ error: 'Chrome falhou ao inicializar.', detail: chromeError });
  if (!chromeReady) return res.status(503).json({ error: 'Chrome ainda inicializando. Tente em alguns segundos.' });
  next();
}

app.get('/debug-chrome', async (req, res) => {
  let findResult = '';
  let whichResult = '';
  let globResult = [];

  try {
    findResult = execSync(
      'find /opt/render/.cache/puppeteer -name "chrome" -type f 2>/dev/null || echo "nada"'
    ).toString().trim();
  } catch (e) { findResult = e.message; }

  try {
    whichResult = execSync('which chromium-browser || which chromium || which google-chrome || echo "nenhum no PATH"').toString().trim();
  } catch (e) { whichResult = e.message; }

  try {
    globResult = await glob('/opt/render/.cache/puppeteer/**/*chrome*');
  } catch (e) { globResult = [e.message]; }

  res.json({ findResult, whichResult, globResult, chromeReady, chromeError, NODE_ENV: process.env.NODE_ENV });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', chromeReady });
});

// Rotas que precisam do Chrome
app.get('/preview', requireChrome, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Parâmetro "url" é obrigatório.' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' });
  try {
    const preview = await getPreview(url);
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error(`[Preview Error] ${url}:`, err.message);
    return res.status(500).json({ error: 'Não foi possível gerar o preview.', detail: err.message });
  }
});

app.post('/preview', requireChrome, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Campo "url" é obrigatório no body.' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' });
  try {
    const preview = await getPreview(url);
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error(`[Preview Error] ${url}:`, err.message);
    return res.status(500).json({ error: 'Não foi possível gerar o preview.', detail: err.message });
  }
});

app.get('/debug', requireChrome, async (req, res) => {
  const { url } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' });
  try {
    const info = await debugUrl(url);
    return res.json(info);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ✅ Sobe porta imediatamente, baixa Chrome em background
app.listen(PORT, () => {
  console.log(`🚀 URL Preview API rodando em http://localhost:${PORT}`);

  ensureChrome()
    .then(() => { chromeReady = true; })
    .catch((err) => { chromeError = err.message; });
});
