import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { listMediaAssets } from '@/lib/blog/data';
import { uploadBlogMediaFromBuffer } from '@/lib/blog/storage';

export const dynamic = 'force-dynamic';
const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
}

export async function GET(req: Request) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const usageParam = (searchParams.get('usage') || 'all').toLowerCase();
    const usageFilter = usageParam === 'used' || usageParam === 'unused' ? usageParam : 'all';
    const items = await listMediaAssets(q, usageFilter);
    return ok({ items });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load media.'), 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return badRequest('Upload a file.');
    if (!file.type?.startsWith('image/')) return badRequest('Only image files are supported.');
    if (!file.size) return badRequest('Uploaded file is empty.');
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      return badRequest(`Image is too large (${formatBytes(file.size)}). Maximum upload size is ${formatBytes(MAX_MEDIA_UPLOAD_BYTES)}.`, 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await uploadBlogMediaFromBuffer({
      buffer,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
      altTextDefault: `${formData.get('altTextDefault') || ''}`,
      captionDefault: `${formData.get('captionDefault') || ''}`,
      creditSource: `${formData.get('creditSource') || ''}`
    });
    return ok(asset, 201);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to upload media.'), 500);
  }
}
