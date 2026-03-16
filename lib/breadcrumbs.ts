export type BreadcrumbItem = {
  name: string;
  href?: string | null;
};

import { toAbsoluteSchemaUrl } from '@/lib/schema-jsonld';

export function breadcrumbsToJsonLd(items: BreadcrumbItem[], siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      const href = item.href || '/';
      const url = toAbsoluteSchemaUrl(href, siteUrl) || toAbsoluteSchemaUrl('/', siteUrl) || siteUrl;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: url
      };
    })
  };
}
