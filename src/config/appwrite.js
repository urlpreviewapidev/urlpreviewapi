import { Client, Databases, Storage, ID, Query } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

export const databases = new Databases(client);
export const storage = new Storage(client);
export { ID, Query };

export const DATABASE_ID = 'uai_db';
export const COLLECTION_ID = 'url_previews';
export const BUCKET_ID = 'preview_screenshots';
