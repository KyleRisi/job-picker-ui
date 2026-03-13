alter function public.set_updated_at()
set search_path = public, pg_temp;

alter function public.set_blog_post_search_document()
set search_path = public, pg_temp;