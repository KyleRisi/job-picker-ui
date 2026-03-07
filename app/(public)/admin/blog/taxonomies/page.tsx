import { AdminTaxonomiesManager } from '@/components/blog/admin-taxonomies-manager';
import { listBlogTaxonomies } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

export default async function AdminBlogTaxonomiesPage() {
  const taxonomies = await listBlogTaxonomies();
  return (
    <AdminTaxonomiesManager
      initialData={{
        categories: taxonomies.categories,
        tags: taxonomies.tags,
        series: taxonomies.series,
        topic_clusters: taxonomies.topicClusters,
        post_labels: taxonomies.labels,
        blog_authors: taxonomies.authors
      }}
    />
  );
}
