import { InputFile } from 'node-appwrite/file';
import { databases, storage, ID, Query, DATABASE_ID, COLLECTION_ID, BUCKET_ID } from '../config/appwrite.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildDocument(data) {
  const doc = {
    url: data.url ?? null,
    type: data.type ?? 'generic',
    title: data.title ?? null,
    description: data.description ?? null,
    icon: data.icon ?? null,
    site_name: data.extra?.siteName ?? null,
    locale: data.extra?.locale ?? null,
    canonical_url: data.url ?? null,
    image_file_id: null,
    image_url: null,

    // YouTube
    yt_video_id: data.extra?.videoId ?? null,
    yt_channel: data.extra?.channel ?? null,
    yt_channel_id: data.extra?.channelId ?? null,
    yt_duration: data.extra?.duration ?? null,
    yt_published: data.extra?.publishedAt ?? null,
    yt_tags: data.extra?.tags ?? [],

    // Instagram
    ig_username: data.extra?.username ?? null,
    ig_post_id: data.extra?.postId ?? null,
    ig_is_profile: data.extra?.isProfile ?? null,   // ✅ lê de data.extra

    // LinkedIn
    li_subtype: data.extra?.subtype ?? null,

    // TikTok
    tt_username: data.extra?.username ?? null,
    tt_video_id: data.extra?.videoId ?? null,
    tt_author_name: data.extra?.authorName ?? null,
    tt_subtype: data.extra?.subtype ?? null,

    // GitHub
    gh_owner: data.extra?.owner ?? null,
    gh_repo: data.extra?.repo ?? null,
    gh_stars: data.extra?.stars ?? null,       // ✅ lê de data.extra
    gh_language: data.extra?.language ?? null,
    gh_topics: data.extra?.topics ?? [],
    gh_is_fork: data.extra?.isFork ?? null,       // ✅ lê de data.extra
    gh_license: data.extra?.license ?? null,
  };

  // Remove null e arrays vazios — preserva false e 0
  return Object.fromEntries(
    Object.entries(doc).filter(([_k, v]) => {
      if (v === null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    })
  );
}

function formatDocument(doc) {
  const result = {
    id: doc.$id,
    url: doc.url,
    type: doc.type,
    title: doc.title,
    description: doc.description ?? null,
    image_url: doc.image_url ?? null,
    icon: doc.icon ?? null,
    site_name: doc.site_name ?? null,
    locale: doc.locale ?? null,
    canonical_url: doc.canonical_url ?? null,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
    extra: {
      // YouTube
      ...(doc.yt_video_id && { videoId: doc.yt_video_id }),
      ...(doc.yt_channel && { channel: doc.yt_channel }),
      ...(doc.yt_channel_id && { channelId: doc.yt_channel_id }),
      ...(doc.yt_duration && { duration: doc.yt_duration }),
      ...(doc.yt_published && { publishedAt: doc.yt_published }),
      ...(doc.yt_tags?.length && { tags: doc.yt_tags }),

      // Instagram
      ...(doc.ig_username && { username: doc.ig_username }),
      ...(doc.ig_post_id && { postId: doc.ig_post_id }),
      ...(doc.ig_is_profile != null && { isProfile: doc.ig_is_profile }), // ✅ != null preserva false

      // LinkedIn
      ...(doc.li_subtype && { subtype: doc.li_subtype }),

      // TikTok
      ...(doc.tt_username && { username: doc.tt_username }),
      ...(doc.tt_video_id && { videoId: doc.tt_video_id }),
      ...(doc.tt_author_name && { authorName: doc.tt_author_name }),
      ...(doc.tt_subtype && { subtype: doc.tt_subtype }),

      // GitHub
      ...(doc.gh_owner && { owner: doc.gh_owner }),
      ...(doc.gh_repo && { repo: doc.gh_repo }),
      ...(doc.gh_stars != null && { stars: doc.gh_stars }),    // ✅ != null preserva 0
      ...(doc.gh_language && { language: doc.gh_language }),
      ...(doc.gh_topics?.length && { topics: doc.gh_topics }),
      ...(doc.gh_is_fork != null && { isFork: doc.gh_is_fork }), // ✅ != null preserva false
      ...(doc.gh_license && { license: doc.gh_license }),
    },
  };

  // ✅ Remove chaves com valor null/undefined do extra
  result.extra = Object.fromEntries(
    Object.entries(result.extra).filter(([_k, v]) => v != null)
  );

  // Remove o extra do response se estiver vazio
  if (Object.keys(result.extra).length === 0) {
    delete result.extra;
  }

  return result;
}

// ─── Funções públicas ────────────────────────────────────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export async function findByUrl(url) {
  const result = await databases.listDocuments(DATABASE_ID, COLLECTION_ID,
    [Query.equal('url', url), Query.limit(1)]
  );

  if (!result.total) return null;

  const doc = result.documents[0];
  const age = Date.now() - new Date(doc.$createdAt).getTime();

  if (age > CACHE_TTL_MS) {
    console.log(`[Cache] Expirado → ${url}`);
    return null;
  }

  return formatDocument(doc);
}

export async function uploadImage(imageData, label = 'preview') {
  if (!imageData) return { fileId: null, imageUrl: null };

  try {
    let file;
    const fileId = ID.unique();
    const fileName = `${label}_${Date.now()}.jpg`;

    if (imageData.startsWith('data:')) {
      const base64 = imageData.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');
      file = InputFile.fromBuffer(buffer, fileName);
    } else {
      const response = await fetch(imageData);
      if (!response.ok) throw new Error(`Falha ao baixar imagem: ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      file = InputFile.fromBuffer(buffer, fileName);
    }

    await storage.createFile(BUCKET_ID, fileId, file);

    const imageUrl = `https://fra.cloud.appwrite.io/v1/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=69eff748001aaaf154f5`;
    return { fileId, imageUrl };
  } catch (err) {
    console.error('[uploadImage] Erro ao salvar imagem:', err.message);
    return { fileId: null, imageUrl: null };
  }
}

export async function createPreview(scraperData, imageData) {
  const { fileId, imageUrl } = await uploadImage(
    imageData,
    scraperData.url?.replace(/[^a-z0-9]/gi, '_').slice(0, 40) ?? 'preview'
  );

  const doc = buildDocument(scraperData);

  if (fileId) doc.image_file_id = fileId;
  if (imageUrl) doc.image_url = imageUrl;

  const created = await databases.createDocument(
    DATABASE_ID,
    COLLECTION_ID,
    ID.unique(),
    doc
  );

  return formatDocument(created);
}
