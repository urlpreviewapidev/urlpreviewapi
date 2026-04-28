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

app.get('/debug-safe', async (req, res) => {
  const { execSync } = await import('child_process');
  const fs = await import('fs');
  const results = {};

  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  // 1. Arquivo existe e permissões
  try {
    const stat = fs.statSync(chromePath);
    results.exists = true;
    results.mode = stat.mode.toString(8);
    results.size_mb = (stat.size / 1024 / 1024).toFixed(2) + ' MB';
  } catch (e) {
    results.exists = false;
    results.stat_error = e.message;
  }

  // 2. ldd — verifica dependências faltando (não executa o Chrome)
  try {
    results.ldd = execSync(`ldd "${chromePath}" 2>&1 | grep "not found"`, {
      timeout: 5000,
    }).toString().trim() || 'all libs found ✅';
  } catch (e) {
    results.ldd = e.stdout?.toString() || 'all libs found ✅';
  }

  // 3. Memória disponível
  try {
    results.memory = execSync('free -m', { timeout: 3000 }).toString().trim();
  } catch (e) {
    results.memory_error = e.message;
  }

  // 4. Espaço em disco
  try {
    results.disk = execSync('df -h /opt/render', { timeout: 3000 }).toString().trim();
  } catch (e) {
    results.disk_error = e.message;
  }

  res.json(results);
});

app.get('/debug-launch', async (req, res) => {
  // Responde em no máximo 30s
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

// rota temporária de diagnóstico
app.get('/debug-chrome-exec', async (req, res) => {
  const chromePath = '/opt/render/.cache/puppeteer/chrome/linux-147.0.7727.57/chrome-linux64/chrome';
  const results = {};

  // 1. Arquivo existe?
  results.exists = fs.existsSync(chromePath);

  // 2. Permissões
  try {
    const stat = fs.statSync(chromePath);
    results.mode = stat.mode.toString(8);
    results.size = stat.size;
  } catch (e) {
    results.stat_error = e.message;
  }

  // 3. Tenta executar --version
  try {
    const version = execSync(`"${chromePath}" --version`, {
      timeout: 5000,
      env: { ...process.env, DISPLAY: '' }
    }).toString().trim();
    results.version = version;
  } catch (e) {
    results.exec_error = e.message;
    results.exec_stderr = e.stderr?.toString();
  }

  // 4. Tenta puppeteer.launch()
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
        '--single-process',             // ← usa 1 processo só, economiza RAM
        '--memory-pressure-off',
        '--max_old_space_size=256',     // ← limita heap do V8 do Chrome
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--no-first-run',
        '--disable-translate',
      ],
    });
    results.launch = 'success';
    await browser.close();
  } catch (e) {
    results.launch_error = e.message;
  }

  res.json(results);
});


// rota temporária de diagnóstico — remover após resolver
app.get('/debug-chrome', async (req, res) => {
  const { execSync } = await import('child_process');

  const results = {};

  // Tenta localizar o chrome
  try { results.which_chrome = execSync('which chromium-browser || which chromium || which google-chrome || which chrome || echo "not found"').toString().trim(); } catch (e) { results.which_chrome = e.message; }

  // Lista o cache do puppeteer
  try { results.puppeteer_cache = execSync('find /opt/render/.cache/puppeteer -name "chrome" -o -name "chromium" 2>/dev/null | head -20').toString().trim(); } catch (e) { results.puppeteer_cache = e.message; }

  // Verifica variáveis de ambiente relevantes
  results.env = {
    PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR,
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH,
    PUPPETEER_SKIP_DOWNLOAD: process.env.PUPPETEER_SKIP_DOWNLOAD,
  };

  // executablePath do puppeteer
  try {
    const puppeteer = await import('puppeteer');
    results.puppeteer_executablePath = puppeteer.default.executablePath();
  } catch (e) { results.puppeteer_executablePath = e.message; }

  res.json(results);
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
    .then((executablePath) => {
      chromeReady = true;
      // ← salva o path para usar no puppeteer.launch()
      process.env.PUPPETEER_EXECUTABLE_PATH = executablePath;
      console.info('[Chrome] ✅ Pronto:', executablePath);
    })
    .catch((err) => {
      chromeError = err.message;
      console.error('[Chrome] ❌ Falha:', err.message);
    });
});

