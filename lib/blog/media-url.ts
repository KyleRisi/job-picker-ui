import { env } from '@/lib/env';

export function getStoragePublicUrl(storagePath: string) {
  const baseUrl = `${env.supabaseUrl || ''}`.replace(/\/+$/, '');
  const bucket = env.blogMediaBucket || 'blog-media';
  return `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath.replace(/^\/+/, '')}`;
}
