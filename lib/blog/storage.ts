import { createHash, randomUUID } from 'node:crypto';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { createMediaAsset } from './data';

function getBucket() {
  return env.blogMediaBucket || 'blog-media';
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset';
}

async function ensureMediaBucket() {
  const supabase = createSupabaseAdminClient();
  const bucket = getBucket();

  const existing = await supabase.storage.getBucket(bucket);
  if (!existing.error) {
    if (existing.data && !existing.data.public) {
      const update = await supabase.storage.updateBucket(bucket, { public: true });
      if (update.error) throw update.error;
    }
    return;
  }

  const message = `${existing.error.message || ''}`.toLowerCase();
  const status = (existing.error as { statusCode?: number; status?: number }).statusCode
    ?? (existing.error as { statusCode?: number; status?: number }).status
    ?? 0;
  const looksMissing = status === 404 || message.includes('not found') || message.includes('bucket');
  if (!looksMissing) {
    throw existing.error;
  }

  const created = await supabase.storage.createBucket(bucket, { public: true });
  if (created.error && !/already exists/i.test(created.error.message || '')) {
    throw created.error;
  }
}

export async function uploadBlogMediaFromBuffer(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  altTextDefault?: string;
  captionDefault?: string;
  creditSource?: string;
}) {
  await ensureMediaBucket();
  const supabase = createSupabaseAdminClient();
  const extension = params.fileName.includes('.') ? params.fileName.split('.').pop() : 'bin';
  const digest = createHash('sha1').update(params.buffer).digest('hex').slice(0, 12);
  const storagePath = `uploads/${new Date().toISOString().slice(0, 10)}/${digest}-${randomUUID()}.${extension}`;
  let upload = await supabase.storage.from(getBucket()).upload(storagePath, params.buffer, {
    contentType: params.mimeType,
    upsert: false
  });
  if (upload.error && /bucket not found/i.test(upload.error.message || '')) {
    await ensureMediaBucket();
    upload = await supabase.storage.from(getBucket()).upload(storagePath, params.buffer, {
      contentType: params.mimeType,
      upsert: false
    });
  }
  if (upload.error) throw upload.error;

  return createMediaAsset({
    storagePath,
    mimeType: params.mimeType,
    altTextDefault: params.altTextDefault,
    captionDefault: params.captionDefault,
    creditSource: params.creditSource
  });
}

export async function uploadRemoteImageToBlogStorage(url: string, options?: {
  fileName?: string;
  altTextDefault?: string;
  captionDefault?: string;
  creditSource?: string;
}) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote asset: ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const fallbackName = sanitizeFileName(options?.fileName || url.split('/').pop() || 'asset');
  return uploadBlogMediaFromBuffer({
    buffer: Buffer.from(arrayBuffer),
    mimeType: contentType,
    fileName: fallbackName,
    altTextDefault: options?.altTextDefault,
    captionDefault: options?.captionDefault,
    creditSource: options?.creditSource
  });
}

export async function deleteBlogMediaFromStorage(storagePath: string) {
  if (!storagePath) return;
  const supabase = createSupabaseAdminClient();
  const result = await supabase.storage.from(getBucket()).remove([storagePath]);
  if (result.error) {
    const message = `${result.error.message || ''}`.toLowerCase();
    const isNotFound = message.includes('not found') || message.includes('no such') || message.includes('does not exist');
    if (!isNotFound) {
      throw result.error;
    }
  }
}
