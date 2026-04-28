// src/server.js
import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPreview } from './preview.js';
import { debugUrl } from './debug.js';
import { ensureChrome } from './utils/ensureChrome.js';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const previewLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
});

const debugLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Limite de requisições de debug atingido.' },
});

function isValidUrl(str) {
  try {
    const { protocol } = new URL(str);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

let chromeReady = false;
let chromeError = null;

function requireChrome(req, res, next) {
  if (chromeError) return res.status(503).json({ error: 'Chrome falhou ao inicializar.', detail: chromeError });
  if (!chromeReady) return res.status(503).json({ error: 'Chrome ainda inicializando. Tente em alguns segundos.' });
  next();
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', chromeReady, chromeError });
});

// ─── Debug seguro (sem executar Chrome) ──────────────────────────────────────

app.get('/debug-safe', async (req, res) => {
  const { execSync } = await import('child_process');
  const fs = await import('fs');
  const results = {};
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  try {
    const stat = fs.statSync(chromePath);
    results.exists = true;
    results.mode = stat.mode.toString(8);
    results.size_mb = (stat.size / 1024 / 1024).toFixed(2) + ' MB';
  } catch (e) {
    results.exists = false;
    results.stat_error = e.message;
  }

  try {
    results.ldd = execSync(`ldd "${chromePath}" 2>&1 | grep "not found"`, { timeout: 5000 })
      .toString().trim() || 'all libs found ✅';
  } catch (e) {
    results.ldd = e.stdout?.toString() || 'all libs found ✅';
  }

  try {
    results.memory = execSync('free -m', { timeout: 3000 }).toString().trim();
  } catch (e) {
    results.memory_error = e.message;
  }

  results.chromePath = chromePath;
  results.chromeReady = chromeReady;
  results.chromeError = chromeError;

  res.json(results);
});

// ─── Debug launch ─────────────────────────────────────────────────────────────

app.get('/debug-launch', async (req, res) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) res.status(504).json({ error: 'timeout após 30s' });
  }, 30000);

  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });

    const version = await browser.version();
    await browser.close();
    clearTimeout(timer);
    res.json({ success: true, version });
  } catch (err) {
    clearTimeout(timer);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 5),
    });
  }
});

// ─── Preview ──────────────────────────────────────────────────────────────────

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

// ─── Startup ──────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.info(`🚀 URL Preview API rodando em http://localhost:${PORT}`);

  ensureChrome()
    .then((executablePath) => {
      chromeReady = true;
      process.env.PUPPETEER_EXECUTABLE_PATH = executablePath;
      console.info('[Chrome] ✅ Pronto:', executablePath);
    })
    .catch((err) => {
      chromeError = err.message;
      console.error('[Chrome] ❌ Falha:', err.message);
    });
});
