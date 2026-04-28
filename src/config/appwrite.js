// src/config/appwrite.js
import { Client, Databases, Storage, ID, Query } from 'node-appwrite';

const endpoint  = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey    = process.env.APPWRITE_API_KEY;

// Falha com mensagem clara em vez de erro genérico do SDK
if (!endpoint || !projectId || !apiKey) {
  throw new Error(
    'Variáveis de ambiente do Appwrite ausentes: ' +
    ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY']
      .filter(k => !process.env[k])
      .join(', ')
  );
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

// ── Constantes de IDs ────────────────────────────────────────────────────────
export const DATABASE_ID   = process.env.APPWRITE_DATABASE_ID   ?? 'url_previews';
export const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID ?? 'previews';
export const BUCKET_ID     = process.env.APPWRITE_BUCKET_ID     ?? 'preview_images';

// ── Serviços ─────────────────────────────────────────────────────────────────
export const databases = new Databases(client);
export const storage   = new Storage(client);

// ── Re-exports do SDK ────────────────────────────────────────────────────────
export { ID, Query };

export default client;
