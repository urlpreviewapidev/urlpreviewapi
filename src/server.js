// src/server.js
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPreview } from './preview.js';
import { debugUrl } from './debug.js';
import { ensureChrome } from './utils/ensureChrome.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares globais ─────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Rate limiters ───────────────────────────────────────────────────────────

const previewLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

// /debug abre browser headless — limitar agressivamente
const debugLimiter = rateLimit({
  windowMs: 60 * 1_000,
  max: 5,
  message: { error: 'Limite de requisições de debug atingido.' },
});

// ─── Validação de URL ────────────────────────────────────────────────────────

function isValidUrl(str) {
  try {
    const { protocol } = new URL(str);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Estado do Chrome ────────────────────────────────────────────────────────

let chromeReady = false;
let chromeError = null;

function requireChrome(req, res, next) {
  if (chromeError) return res.status(503).json({ error: 'Chrome falhou ao inicializar.', detail: chromeError });
  if (!chromeReady) return res.status(503).json({ error: 'Chrome ainda inicializando. Tente em alguns segundos.' });
  next();
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', chromeReady });
});

// Expõe informações de infraestrutura — disponível apenas fora de produção
app.get('/debug-chrome', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  next();
}, async (_req, res) => {
  const { glob } = await import('glob');
  const { execSync } = await import('child_process');
  const { CHROME_GLOB, PUPPETEER_CACHE_DIR } = await import('./utils/puppeteerConfig.js');

  let findResult = '';
  let whichResult = '';
  let globResult = [];

  try {
    findResult = execSync(
      `find ${PUPPETEER_CACHE_DIR} -name "chrome" -type f 2>/dev/null || echo "nada"`
    ).toString().trim();
  } catch (e) { findResult = e.message; }

  try {
    whichResult = execSync(
      'which chromium-browser || which chromium || which google-chrome || echo "nenhum no PATH"'
    ).toString().trim();
  } catch (e) { whichResult = e.message; }

  try {
    globResult = await glob(CHROME_GLOB);
  } catch (e) { globResult = [e.message]; }

  res.json({ findResult, whichResult, globResult, chromeReady, chromeError });
});

// Helper compartilhado entre GET e POST
async function handlePreview(url, res) {
  if (!url) return res.status(400).json({ error: 'URL é obrigatória.' });
  if (!isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' });

  try {
    const preview = await getPreview(url);
    return res.json({ success: true, data: preview });
  } catch (err) {
    console.error(`[Preview Error] ${url}:`, err.message);
    return res.status(500).json({ error: 'Não foi possível gerar o preview.', detail: err.message });
  }
}

app.get('/preview', previewLimiter, requireChrome, (req, res) => handlePreview(req.query.url, res));
app.post('/preview', previewLimiter, requireChrome, (req, res) => handlePreview(req.body.url, res));

app.get('/debug', debugLimiter, requireChrome, async (req, res) => {
  const { url } = req.query;
  if (!url || !isValidUrl(url)) return res.status(400).json({ error: 'URL inválida.' });

  try {
    const info = await debugUrl(url);
    return res.json(info);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.info(`🚀 URL Preview API rodando em http://localhost:${PORT}`);

  ensureChrome()
    .then(() => {
      chromeReady = true;
      console.info('[Chrome] Pronto.');
    })
    .catch((err) => {
      chromeError = err.message;
      console.error('[Chrome] Falha na inicialização:', err.message);
    });
});
