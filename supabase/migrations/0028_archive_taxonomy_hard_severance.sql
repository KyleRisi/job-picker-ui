create table if not exists taxonomy_archive_hard_severance_runs (
  id bigserial primary key,
  migration_name text not null,
  blog_join_rows_removed int not null default 0,
  discovery_join_rows_removed int not null default 0,
  primary_categories_cleared int not null default 0,
  skipped_or_rejected_rows jsonb not null default '[]'::jsonb,
  executed_at timestamptz not null default now()
);

do $$
declare
  blog_removed int := 0;
  discovery_removed int := 0;
  primary_cleared int := 0;
  skipped jsonb := '[]'::jsonb;
  affected int := 0;
begin
  if to_regclass('public.blog_post_categories') is not null and to_regclass('public.categories') is not null then
    delete from blog_post_categories link
    using categories term
    where link.category_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    blog_removed := blog_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_category_join_or_term_table'));
  end if;

  if to_regclass('public.blog_post_tags') is not null and to_regclass('public.tags') is not null then
    delete from blog_post_tags link
    using tags term
    where link.tag_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    blog_removed := blog_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_tag_join_or_term_table'));
  end if;

  if to_regclass('public.blog_post_series') is not null and to_regclass('public.series') is not null then
    delete from blog_post_series link
    using series term
    where link.series_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    blog_removed := blog_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_series_join_or_term_table'));
  end if;

  if to_regclass('public.blog_post_topic_clusters') is not null and to_regclass('public.topic_clusters') is not null then
    delete from blog_post_topic_clusters link
    using topic_clusters term
    where link.topic_cluster_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    blog_removed := blog_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_topic_cluster_join_or_term_table'));
  end if;

  if to_regclass('public.blog_posts') is not null and to_regclass('public.categories') is not null then
    update blog_posts post
    set primary_category_id = null
    from categories term
    where post.primary_category_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    primary_cleared := primary_cleared + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_posts_or_categories_table_for_primary_clear'));
  end if;

  if to_regclass('public.blog_post_discovery_terms') is not null and to_regclass('public.discovery_terms') is not null then
    delete from blog_post_discovery_terms link
    using discovery_terms term
    where link.term_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    discovery_removed := discovery_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_blog_discovery_join_or_term_table'));
  end if;

  if to_regclass('public.episode_discovery_terms') is not null and to_regclass('public.discovery_terms') is not null then
    delete from episode_discovery_terms link
    using discovery_terms term
    where link.term_id = term.id
      and coalesce(term.is_active, true) = false;
    get diagnostics affected = row_count;
    discovery_removed := discovery_removed + affected;
  else
    skipped := skipped || jsonb_build_array(jsonb_build_object('reason', 'missing_episode_discovery_join_or_term_table'));
  end if;

  if to_regclass('public.blog_posts') is not null and to_regclass('public.blog_authors') is not null then
    select count(*)
      into affected
    from blog_posts post
    join blog_authors author on author.id = post.author_id
    where coalesce(author.is_active, true) = false
      and post.deleted_at is null;
    if affected > 0 then
      skipped := skipped || jsonb_build_array(jsonb_build_object(
        'reason', 'archived_authors_still_assigned_requires_merge',
        'count', affected
      ));
    end if;
  end if;

  insert into taxonomy_archive_hard_severance_runs (
    migration_name,
    blog_join_rows_removed,
    discovery_join_rows_removed,
    primary_categories_cleared,
    skipped_or_rejected_rows
  ) values (
    '0028_archive_taxonomy_hard_severance.sql',
    blog_removed,
    discovery_removed,
    primary_cleared,
    skipped
  );
end $$;

select
  blog_join_rows_removed,
  discovery_join_rows_removed,
  primary_categories_cleared,
  skipped_or_rejected_rows
from taxonomy_archive_hard_severance_runs
order by id desc
limit 1;
