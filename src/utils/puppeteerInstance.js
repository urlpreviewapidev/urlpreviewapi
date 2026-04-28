// src/utils/puppeteerInstance.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// ✅ Registra o plugin stealth uma única vez (idempotente)
puppeteer.use(StealthPlugin());

export default puppeteer;
