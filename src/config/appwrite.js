// src/config/appwrite.js
import { Client, Databases, Storage, ID, Query } from 'node-appwrite';

// ✅ Todas as 6 variáveis obrigatórias validadas juntas — sem fallback silencioso
const REQUIRED_ENV = [
  'APPWRITE_ENDPOINT',
  'APPWRITE_PROJECT_ID',
  'APPWRITE_API_KEY',
  'APPWRITE_DATABASE_ID',
  'APPWRITE_COLLECTION_ID',
  'APPWRITE_BUCKET_ID',
];

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  throw new Error(
    `Variáveis de ambiente do Appwrite ausentes: ${missing.join(', ')}`
  );
}

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

// ✅ Sem ?? fallback — se não estiver no env, o erro acima já lançou
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID;
export const COLLECTION_ID = process.env.APPWRITE_COLLECTION_ID;
export const BUCKET_ID = process.env.APPWRITE_BUCKET_ID;

export const databases = new Databases(client);
export const storage = new Storage(client);

export { ID, Query };
export default client;
