import { requireBlogAdminUser } from '@/lib/blog/auth';
import { BlogAdminFrame } from '@/components/blog-admin-frame';

export default async function AdminBlogLayout({ children }: { children: React.ReactNode }) {
  await requireBlogAdminUser();

  return <BlogAdminFrame>{children}</BlogAdminFrame>;
}
