import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { listMediaAssets } from '@/lib/blog/data';
import { uploadBlogMediaFromBuffer } from '@/lib/blog/storage';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const items = await listMediaAssets(q);
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
