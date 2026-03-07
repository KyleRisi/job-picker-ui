import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { previewWordpressImport } from '@/lib/blog/import-wordpress';

export async function POST(req: Request) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return badRequest('Upload a WordPress XML file.');
    const xml = await file.text();
    const preview = await previewWordpressImport(xml);
    return ok(preview);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to preview import file.'), 500);
  }
}
