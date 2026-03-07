import { AdminMediaLibrary } from '@/components/blog/admin-media-library';
import { listMediaAssets } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

export default async function AdminBlogMediaPage() {
  const items = await listMediaAssets();
  return <AdminMediaLibrary initialItems={items} />;
}
