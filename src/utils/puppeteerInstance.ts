// src/utils/puppeteerInstance.js
// ✅ Ponto único de importação do puppeteer — garante que stealth é aplicado em todos
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

export default puppeteer;
