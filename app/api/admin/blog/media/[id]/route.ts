import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { deleteMediaAssetById, getMediaAssetById, getMediaAssetUsage, updateMediaAsset } from '@/lib/blog/data';
import { deleteBlogMediaFromStorage } from '@/lib/blog/storage';
import { isUuid } from '@/lib/blog/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid media asset id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const asset = await getMediaAssetById(params.id);
    if (!asset) return badRequest('Media asset not found.', 404);
    return ok(asset);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load media asset.'), 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid media asset id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getMediaAssetById(params.id);
    if (!existing) return badRequest('Media asset not found.', 404);
    const payload = await req.json();
    const asset = await updateMediaAsset(params.id, payload);
    return ok(asset);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to update media asset.'), 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid media asset id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const forceDelete = ['1', 'true', 'yes'].includes((req.nextUrl.searchParams.get('force') || '').toLowerCase());
    const usage = await getMediaAssetUsage(params.id);
    if (!usage) return badRequest('Media asset not found.', 404);
    if (!usage.canDelete && !forceDelete) {
      return badRequest('Media asset is still in use and cannot be deleted.', 409);
    }

    const deleted = await deleteMediaAssetById(params.id);
    if (!deleted) return badRequest('Media asset not found.', 404);
    await deleteBlogMediaFromStorage(deleted.storage_path);

    return ok({ id: deleted.id, deleted: true });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to delete media asset.'), 500);
  }
}
