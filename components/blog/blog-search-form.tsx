export function BlogSearchForm({ defaultValue = '', action = '/blog/search' }: { defaultValue?: string; action?: string }) {
  return (
    <form action={action} className="flex flex-wrap gap-3">
      <input className="input w-full max-w-lg" type="search" name="q" placeholder="Search the blog" defaultValue={defaultValue} aria-label="Search the blog" />
      <button className="btn-primary" type="submit">Search</button>
    </form>
  );
}
