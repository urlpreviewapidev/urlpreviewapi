import { Client, Databases, Storage, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT)
  .setProject(process.env.APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DATABASE_ID = 'uai_db';
const COLLECTION_ID = 'url_previews';
const BUCKET_ID = process.env.APPWRITE_BUCKET_ID || 'preview_screenshots';

const stringAttr = async (key, size = 2048, required = false, def = null, array = false) => {
  try {
    await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, key, size, required, def, array);
    console.log(`  ✅ ${key}`);
  } catch (e) {
    if (e.code === 409) console.log(`  ⏭️  ${key} (já existe)`);
    else throw e;
  }
};

const boolAttr = async (key, required = false, def = null) => {
  try {
    await databases.createBooleanAttribute(DATABASE_ID, COLLECTION_ID, key, required, def);
    console.log(`  ✅ ${key}`);
  } catch (e) {
    if (e.code === 409) console.log(`  ⏭️  ${key} (já existe)`);
    else throw e;
  }
};

const intAttr = async (key, required = false, def = null) => {
  try {
    await databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, key, required, undefined, undefined, def);
    console.log(`  ✅ ${key}`);
  } catch (e) {
    if (e.code === 409) console.log(`  ⏭️  ${key} (já existe)`);
    else throw e;
  }
};

async function setup() {
  console.log('🚀 Iniciando setup do Appwrite...\n');

  console.log(`✅ Usando database: ${DATABASE_ID}`);

  try {
    await databases.createCollection(
      DATABASE_ID,
      COLLECTION_ID,
      'URL Previews',
      [
        Permission.read(Role.any()),
        Permission.create(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]
    );
    console.log('✅ Collection criada\n');
  } catch (e) {
    if (e.code === 409) console.log('⏭️  Collection já existe\n');
    else throw e;
  }

  console.log('📝 Criando atributos...\n');

  console.log('  [Gerais]');
  await stringAttr('url', 1024, true);
  await stringAttr('type', 64);
  await stringAttr('title', 256);
  await stringAttr('description', 1024);
  await stringAttr('image_file_id', 128);
  await stringAttr('image_url', 512);
  await stringAttr('icon', 512);
  await stringAttr('site_name', 128);
  await stringAttr('locale', 32);
  await stringAttr('canonical_url', 512);

  console.log('\n  [YouTube]');
  await stringAttr('yt_video_id', 32);
  await stringAttr('yt_channel', 128);
  await stringAttr('yt_channel_id', 32);
  await stringAttr('yt_duration', 16);
  await stringAttr('yt_published', 32);
  await stringAttr('yt_tags', 128, false, null, true);

  console.log('\n  [Instagram]');
  await stringAttr('ig_username', 128);
  await stringAttr('ig_post_id', 128);
  await boolAttr('ig_is_profile');

  console.log('\n  [LinkedIn]');
  await stringAttr('li_subtype', 20);

  console.log('\n  [TikTok]');
  await stringAttr('tt_username', 100);
  await stringAttr('tt_video_id', 50);
  await stringAttr('tt_author_name', 100);
  await stringAttr('tt_subtype', 20);

  console.log('\n  [GitHub]');
  await stringAttr('gh_owner', 100);
  await stringAttr('gh_repo', 100);
  await intAttr('gh_stars');
  await stringAttr('gh_language', 50);
  await stringAttr('gh_topics', 50, false, null, true);
  await boolAttr('gh_is_fork');
  await stringAttr('gh_license', 50);

  console.log('\n⏳ Aguardando propagação dos atributos (15s)...');
  await new Promise(r => setTimeout(r, 15000));

  try {
    await databases.createIndex(
      DATABASE_ID,
      COLLECTION_ID,
      'idx_url',
      'fulltext',
      ['url'],
      ['ASC']
    );
    console.log('✅ Índice idx_url criado');
  } catch (e) {
    if (e.code === 409) console.log('⏭️  Índice já existe');
    else throw e;
  }

  try {
    await storage.createBucket(
      BUCKET_ID,
      'Preview Screenshots',
      [
        Permission.read(Role.any()),
        Permission.create(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ],
      false,
      true,
      10_000_000,
      ['jpg', 'jpeg', 'png', 'webp']
    );
    console.log('✅ Bucket criado');
  } catch (e) {
    if (e.code === 409) console.log('⏭️  Bucket já existe');
    else throw e;
  }

  console.log('\n🎉 Setup concluído!');
}

setup().catch(console.error);
