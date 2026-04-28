const { join } = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Cache local por usuário, fora do projeto
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || join(os.homedir(), '.cache', 'puppeteer'),
};
