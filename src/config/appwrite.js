// src/config/appwrite.js
import { Client, Databases } from 'node-appwrite';

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

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

export const databases = new Databases(client);
export default client;
