import { unstable_noStore as noStore } from 'next/cache';
import { listMediaAssets } from '@/lib/blog/data';
import { WorkspaceMediaManager } from '@/components/workspace/workspace-media-manager';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceMediaPage() {
  noStore();

  let items: Awaited<ReturnType<typeof listMediaAssets>> = [];
  let loadError = '';

  try {
    items = await listMediaAssets();
  } catch (error) {
    loadError = 'Could not load media assets right now.';
    console.error('Workspace media failed to load:', error);
  }

  return (
    <section className="space-y-4">
      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceMediaManager initialItems={items} />
    </section>
  );
}
