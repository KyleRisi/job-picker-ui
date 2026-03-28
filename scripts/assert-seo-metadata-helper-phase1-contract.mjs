#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import path from 'node:path';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function toAbsoluteCanonical(canonicalValue, siteUrl) {
  return new URL(canonicalValue, siteUrl).toString();
}

const helperPath = path.resolve(process.cwd(), 'lib/seo-metadata/core.ts');
const { buildCanonicalAndSocialMetadataFromContext } = await import(pathToFileURL(helperPath).toString());

const siteUrl = 'https://www.thecompendiumpodcast.com';
const fallbackCanonicalResolver = ({ fallbackPath, siteUrl: resolverSiteUrl }) => {
  const absolute = new URL(fallbackPath, resolverSiteUrl).toString();
  return { metadataCanonical: fallbackPath, absoluteCanonicalUrl: absolute };
};

{
  const result = buildCanonicalAndSocialMetadataFromContext({
    params: {
      title: 'Episode Social Title',
      description: 'Episode social description',
      canonicalCandidate: '/episodes/test-episode',
      fallbackPath: '/episodes/test-episode',
      openGraphType: 'article',
      imageUrl: 'https://cdn.example.com/episode-cover.jpg'
    },
    siteUrl,
    resolveCanonical: ({ candidateCanonical, fallbackPath, siteUrl: resolverSiteUrl }) => {
      const chosen = candidateCanonical || fallbackPath;
      const absolute = new URL(chosen, resolverSiteUrl).toString();
      return { metadataCanonical: chosen, absoluteCanonicalUrl: absolute };
    }
  });

  assert(Boolean(result.alternates?.canonical), 'case 1 missing canonical');
  assert(Boolean(result.openGraph?.url), 'case 1 missing og:url');
  assert(Boolean(result.openGraph?.title), 'case 1 missing og:title');
  assert(Boolean(result.openGraph?.type), 'case 1 missing og:type');
  assert(Boolean(result.openGraph?.images?.[0]?.url), 'case 1 missing og:image');

  const canonicalAbsolute = toAbsoluteCanonical(`${result.alternates?.canonical || ''}`, siteUrl);
  assert(canonicalAbsolute === `${result.openGraph?.url || ''}`, 'case 1 canonical and og:url are not aligned');
}

{
  const result = buildCanonicalAndSocialMetadataFromContext({
    params: {
      title: 'Fallback Image Test',
      description: 'No page image should use fallback',
      canonicalCandidate: '/topics/fallback-check',
      fallbackPath: '/topics/fallback-check',
      openGraphType: 'website'
    },
    siteUrl,
    resolveCanonical: fallbackCanonicalResolver
  });

  const ogImage = `${result.openGraph?.images?.[0]?.url || ''}`;
  assert(ogImage === 'https://www.thecompendiumpodcast.com/The%20Compendium%20Main.jpg', 'case 2 fallback OG image URL is incorrect');
  assert(ogImage.includes('%20'), 'case 2 fallback OG image should be URL-encoded');
}

{
  const title = 'Highly Specific Page Title';
  const description = 'Highly specific page description';
  const result = buildCanonicalAndSocialMetadataFromContext({
    params: {
      title,
      description,
      canonicalCandidate: '/blog/specific',
      fallbackPath: '/blog/specific',
      openGraphType: 'article'
    },
    siteUrl,
    resolveCanonical: fallbackCanonicalResolver
  });

  assert(`${result.openGraph?.title || ''}` === title, 'case 3 helper replaced page-specific OG title');
  assert(`${result.openGraph?.description || ''}` === description, 'case 3 helper replaced page-specific OG description');
  assert(`${result.twitter?.title || ''}` === title, 'case 3 helper replaced page-specific Twitter title');
  assert(`${result.twitter?.description || ''}` === description, 'case 3 helper replaced page-specific Twitter description');
}

{
  const externalCanonical = 'https://external.example.com/article';
  const disallowed = buildCanonicalAndSocialMetadataFromContext({
    params: {
      title: 'Off-domain disallowed',
      canonicalCandidate: externalCanonical,
      fallbackPath: '/blog/fallback',
      openGraphType: 'article'
    },
    siteUrl,
    resolveCanonical: fallbackCanonicalResolver
  });

  assert(`${disallowed.alternates?.canonical || ''}` === '/blog/fallback', 'case 4 disallowed off-domain canonical should fall back');
  assert(`${disallowed.openGraph?.url || ''}` === 'https://www.thecompendiumpodcast.com/blog/fallback', 'case 4 disallowed off-domain og:url should fall back');

  const allowed = buildCanonicalAndSocialMetadataFromContext({
    params: {
      title: 'Off-domain allowed',
      canonicalCandidate: externalCanonical,
      fallbackPath: '/blog/fallback',
      openGraphType: 'article',
      allowOffDomainCanonical: true
    },
    siteUrl,
    resolveCanonical: fallbackCanonicalResolver
  });

  assert(`${allowed.alternates?.canonical || ''}` === externalCanonical, 'case 4 allowed off-domain canonical should be preserved');
  assert(`${allowed.openGraph?.url || ''}` === externalCanonical, 'case 4 allowed off-domain og:url should be preserved');
}

console.log('PASS: seo-metadata Phase 1 contract checks succeeded.');

