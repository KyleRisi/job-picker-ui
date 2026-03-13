export type BreadcrumbItem = {
  name: string;
  href?: string | null;
};

export function breadcrumbsToJsonLd(items: BreadcrumbItem[], siteUrl: string) {
  const base = new URL(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const href = item.href || '/';
      const url = href.startsWith('http://') || href.startsWith('https://') ? href : new URL(href, base).toString();
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: url
      };
    })
  };
}
