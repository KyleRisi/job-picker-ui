import rawPolicy from './taxonomy-route-policy.json';
import { normalizePath } from '@/lib/redirects';

export type TaxonomyRouteAction = 'live_indexable' | 'live_noindex' | 'redirect_301' | 'gone_410';

export type TaxonomyRoutePolicyEntry = {
  route: string;
  action: TaxonomyRouteAction;
  status_code: 200 | 301 | 410;
  previous_behavior: string;
  new_behavior: string;
  redirect_destination: string | null;
  rationale: string;
};

const APPROVED_TOPIC_SLUGS = Object.freeze([...rawPolicy.approved_topics]);
const APPROVED_COLLECTION_SLUGS = Object.freeze([...rawPolicy.approved_collections]);
const POLICY_ENTRIES: ReadonlyArray<TaxonomyRoutePolicyEntry> = Object.freeze(
  (rawPolicy.routes as TaxonomyRoutePolicyEntry[]).map((entry) => ({
    ...entry,
    route: normalizePath(entry.route),
    redirect_destination: entry.redirect_destination ? normalizePath(entry.redirect_destination) : null
  }))
);

const POLICY_BY_ROUTE = new Map<string, TaxonomyRoutePolicyEntry>();
for (const entry of POLICY_ENTRIES) {
  if (POLICY_BY_ROUTE.has(entry.route)) {
    throw new Error(`Duplicate taxonomy route policy entry for "${entry.route}".`);
  }
  if (entry.action === 'redirect_301') {
    if (!entry.redirect_destination) {
      throw new Error(`Route policy "${entry.route}" is redirect_301 but has no destination.`);
    }
    if (entry.status_code !== 301) {
      throw new Error(`Route policy "${entry.route}" must use status_code 301 for redirect_301 action.`);
    }
  }
  if (entry.action === 'gone_410') {
    if (entry.redirect_destination) {
      throw new Error(`Route policy "${entry.route}" is gone_410 and cannot define redirect_destination.`);
    }
    if (entry.status_code !== 410) {
      throw new Error(`Route policy "${entry.route}" must use status_code 410 for gone_410 action.`);
    }
  }
  if ((entry.action === 'live_indexable' || entry.action === 'live_noindex') && entry.status_code !== 200) {
    throw new Error(`Route policy "${entry.route}" must use status_code 200 for live actions.`);
  }
  POLICY_BY_ROUTE.set(entry.route, entry);
}

function assertNoInternalRedirectChains() {
  const redirectEntries = POLICY_ENTRIES.filter((entry) => entry.action === 'redirect_301');
  const redirectByRoute = new Map(redirectEntries.map((entry) => [entry.route, entry]));

  for (const entry of redirectEntries) {
    let current = entry.redirect_destination || '';
    const seen = new Set<string>([entry.route]);

    while (current && redirectByRoute.has(current)) {
      if (seen.has(current)) {
        throw new Error(`Taxonomy route policy contains redirect loop at "${entry.route}".`);
      }
      const next = redirectByRoute.get(current);
      if (!next?.redirect_destination) {
        throw new Error(`Taxonomy route policy contains invalid redirect chain target at "${current}".`);
      }
      seen.add(current);
      current = next.redirect_destination;
    }

    const terminal = current;
    if (!terminal) {
      throw new Error(`Taxonomy route policy has empty terminal destination for "${entry.route}".`);
    }
    if (terminal !== entry.redirect_destination) {
      throw new Error(
        `Taxonomy route policy chain detected for "${entry.route}" -> "${entry.redirect_destination}" -> "${terminal}". ` +
        'Rewrite source to direct terminal destination.'
      );
    }

    const terminalPolicy = POLICY_BY_ROUTE.get(terminal);
    if (terminalPolicy?.action === 'gone_410') {
      throw new Error(`Taxonomy route policy maps "${entry.route}" to gone_410 destination "${terminal}".`);
    }
  }
}

assertNoInternalRedirectChains();

export function getApprovedTopicSlugs() {
  return APPROVED_TOPIC_SLUGS;
}

export function getApprovedCollectionSlugs() {
  return APPROVED_COLLECTION_SLUGS;
}

export function isApprovedTopicSlug(slug: string) {
  return APPROVED_TOPIC_SLUGS.includes(normalizePath(`/topics/${slug}`).slice('/topics/'.length));
}

export function isApprovedCollectionSlug(slug: string) {
  return APPROVED_COLLECTION_SLUGS.includes(normalizePath(`/collections/${slug}`).slice('/collections/'.length));
}

export function getTaxonomyRoutePolicy(routePath: string): TaxonomyRoutePolicyEntry | null {
  return POLICY_BY_ROUTE.get(normalizePath(routePath)) || null;
}

export function getAllTaxonomyRoutePolicies() {
  return POLICY_ENTRIES;
}

export function resolveTaxonomyPublicPath(input: {
  termType: string;
  slug: string;
  entitySubtype: string | null;
}): string | null {
  const slug = normalizePath(`/${input.slug}`).slice(1);
  if (!slug) return null;

  if (input.termType === 'topic') {
    return APPROVED_TOPIC_SLUGS.includes(slug) ? `/topics/${slug}` : null;
  }

  if (input.termType === 'collection') {
    return APPROVED_COLLECTION_SLUGS.includes(slug) ? `/collections/${slug}` : null;
  }

  return null;
}

export function isTaxonomyActive(input: { isActive: boolean | null | undefined }) {
  return input.isActive === true;
}

export function isTaxonomyPublicDisplayable(input: {
  isActive: boolean | null | undefined;
  termType: string;
  slug: string;
  entitySubtype: string | null;
  path: string | null;
}) {
  if (!isTaxonomyActive({ isActive: input.isActive })) return false;
  const resolved = resolveTaxonomyPublicPath({
    termType: input.termType,
    slug: input.slug,
    entitySubtype: input.entitySubtype
  });
  if (!resolved || !input.path) return false;
  return normalizePath(resolved) === normalizePath(input.path);
}
