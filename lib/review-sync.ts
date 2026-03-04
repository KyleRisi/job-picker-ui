import { createSupabaseAdminClient } from '@/lib/supabase';

const PODCAST_ID = '1676817109';
const MAX_PAGES = 10;
const DELAY_MS = 300;
const CHUNK_SIZE = 200;

const COUNTRY_CODES = [
  'ae', 'ag', 'ai', 'al', 'am', 'ao', 'ar', 'at', 'au', 'az',
  'bb', 'be', 'bf', 'bg', 'bh', 'bj', 'bm', 'bn', 'bo', 'br',
  'bs', 'bt', 'bw', 'by', 'bz', 'ca', 'cg', 'ch', 'cl', 'cm',
  'cn', 'co', 'cr', 'cv', 'cy', 'cz', 'de', 'dk', 'dm', 'do',
  'dz', 'ec', 'ee', 'eg', 'es', 'fi', 'fj', 'fm', 'fr', 'ga',
  'gb', 'gd', 'gh', 'gm', 'gr', 'gt', 'gw', 'gy', 'hk', 'hn',
  'hr', 'hu', 'id', 'ie', 'il', 'in', 'is', 'it', 'jm', 'jo',
  'jp', 'ke', 'kg', 'kh', 'kn', 'kr', 'kw', 'ky', 'kz', 'la',
  'lb', 'lc', 'lk', 'lr', 'lt', 'lu', 'lv', 'md', 'mg', 'mk',
  'ml', 'mn', 'mo', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx',
  'my', 'mz', 'na', 'ne', 'ng', 'ni', 'nl', 'no', 'np', 'nz',
  'om', 'pa', 'pe', 'pg', 'ph', 'pk', 'pl', 'pt', 'pw', 'py',
  'qa', 'ro', 'ru', 'rw', 'sa', 'sb', 'sc', 'se', 'sg', 'si',
  'sk', 'sl', 'sn', 'sr', 'st', 'sv', 'sz', 'tc', 'td', 'th',
  'tj', 'tm', 'tn', 'tr', 'tt', 'tw', 'tz', 'ua', 'ug', 'us',
  'uy', 'uz', 've', 'vg', 'vn', 'ye', 'za', 'zw'
];

const COUNTRY_NAMES: Record<string, string> = {
  ae: 'United Arab Emirates', ag: 'Antigua and Barbuda', ai: 'Anguilla', al: 'Albania',
  am: 'Armenia', ao: 'Angola', ar: 'Argentina', at: 'Austria', au: 'Australia',
  az: 'Azerbaijan', bb: 'Barbados', be: 'Belgium', bf: 'Burkina Faso', bg: 'Bulgaria',
  bh: 'Bahrain', bj: 'Benin', bm: 'Bermuda', bn: 'Brunei', bo: 'Bolivia', br: 'Brazil',
  bs: 'Bahamas', bt: 'Bhutan', bw: 'Botswana', by: 'Belarus', bz: 'Belize', ca: 'Canada',
  cg: 'Congo', ch: 'Switzerland', cl: 'Chile', cm: 'Cameroon', cn: 'China', co: 'Colombia',
  cr: 'Costa Rica', cv: 'Cape Verde', cy: 'Cyprus', cz: 'Czech Republic', de: 'Germany',
  dk: 'Denmark', dm: 'Dominica', do: 'Dominican Republic', dz: 'Algeria', ec: 'Ecuador',
  ee: 'Estonia', eg: 'Egypt', es: 'Spain', fi: 'Finland', fj: 'Fiji',
  fm: 'Micronesia', fr: 'France', ga: 'Gabon', gb: 'United Kingdom', gd: 'Grenada',
  gh: 'Ghana', gm: 'Gambia', gr: 'Greece', gt: 'Guatemala', gw: 'Guinea-Bissau',
  gy: 'Guyana', hk: 'Hong Kong', hn: 'Honduras', hr: 'Croatia', hu: 'Hungary',
  id: 'Indonesia', ie: 'Ireland', il: 'Israel', in: 'India', is: 'Iceland', it: 'Italy',
  jm: 'Jamaica', jo: 'Jordan', jp: 'Japan', ke: 'Kenya', kg: 'Kyrgyzstan', kh: 'Cambodia',
  kn: 'Saint Kitts and Nevis', kr: 'South Korea', kw: 'Kuwait', ky: 'Cayman Islands',
  kz: 'Kazakhstan', la: 'Laos', lb: 'Lebanon', lc: 'Saint Lucia', lk: 'Sri Lanka',
  lr: 'Liberia', lt: 'Lithuania', lu: 'Luxembourg', lv: 'Latvia', md: 'Moldova',
  mg: 'Madagascar', mk: 'North Macedonia', ml: 'Mali', mn: 'Mongolia', mo: 'Macau',
  mr: 'Mauritania', ms: 'Montserrat', mt: 'Malta', mu: 'Mauritius', mv: 'Maldives',
  mw: 'Malawi', mx: 'Mexico', my: 'Malaysia', mz: 'Mozambique', na: 'Namibia',
  ne: 'Niger', ng: 'Nigeria', ni: 'Nicaragua', nl: 'Netherlands', no: 'Norway',
  np: 'Nepal', nz: 'New Zealand', om: 'Oman', pa: 'Panama', pe: 'Peru',
  pg: 'Papua New Guinea', ph: 'Philippines', pk: 'Pakistan', pl: 'Poland', pt: 'Portugal',
  pw: 'Palau', py: 'Paraguay', qa: 'Qatar', ro: 'Romania', ru: 'Russia', rw: 'Rwanda',
  sa: 'Saudi Arabia', sb: 'Solomon Islands', sc: 'Seychelles', se: 'Sweden', sg: 'Singapore',
  si: 'Slovenia', sk: 'Slovakia', sl: 'Sierra Leone', sn: 'Senegal', sr: 'Suriname',
  st: 'Sao Tome and Principe', sv: 'El Salvador', sz: 'Eswatini',
  tc: 'Turks and Caicos Islands', td: 'Chad', th: 'Thailand', tj: 'Tajikistan',
  tm: 'Turkmenistan', tn: 'Tunisia', tr: 'Turkey', tt: 'Trinidad and Tobago', tw: 'Taiwan',
  tz: 'Tanzania', ua: 'Ukraine', ug: 'Uganda', us: 'United States', uy: 'Uruguay',
  uz: 'Uzbekistan', ve: 'Venezuela', vg: 'British Virgin Islands', vn: 'Vietnam',
  ye: 'Yemen', za: 'South Africa', zw: 'Zimbabwe'
};

type AppleReview = {
  id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  countryName: string;
  date: string;
};

type ReviewInsertRow = {
  external_id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
  source: 'apple';
  status: 'visible';
  received_at: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAppleReviewsPage(country: string, page: number): Promise<AppleReview[]> {
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${PODCAST_ID}/sortBy=mostRecent/json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store'
    });

    if (!res.ok) return [];

    const data = await res.json();
    const entries = data?.feed?.entry;
    if (!entries || !Array.isArray(entries)) return [];

    return entries
      .filter((entry: any) => entry?.['im:rating']?.label)
      .map((entry: any) => ({
        id: `${entry.id?.label || ''}`.trim(),
        title: `${entry.title?.label || ''}`.trim(),
        body: `${entry.content?.label || ''}`.trim(),
        rating: Number.parseInt(entry['im:rating']?.label || '0', 10),
        author: `${entry.author?.name?.label || 'Anonymous'}`.trim() || 'Anonymous',
        countryName: COUNTRY_NAMES[country] || country.toUpperCase(),
        date: `${entry.updated?.label || ''}`.trim()
      }))
      .filter((row: AppleReview) => Boolean(row.id && row.title && row.body));
  } catch {
    return [];
  }
}

async function scrapeAppleReviews(): Promise<AppleReview[]> {
  const allReviews: AppleReview[] = [];
  const seenIds = new Set<string>();

  for (const country of COUNTRY_CODES) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const pageReviews = await fetchAppleReviewsPage(country, page);
      if (!pageReviews.length) break;

      for (const review of pageReviews) {
        if (seenIds.has(review.id)) continue;
        seenIds.add(review.id);
        allReviews.push(review);
      }

      await sleep(DELAY_MS);
    }
  }

  allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return allReviews;
}

function toInsertRows(rows: AppleReview[]): ReviewInsertRow[] {
  return rows
    .map<ReviewInsertRow>((row) => {
      const parsedDate = new Date(row.date);
      const receivedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
      const clampedRating = Math.min(5, Math.max(1, Math.trunc(row.rating || 5)));

      return {
        external_id: row.id,
        title: row.title,
        body: row.body,
        rating: clampedRating,
        author: row.author || 'Anonymous',
        country: row.countryName,
        source: 'apple',
        status: 'visible',
        received_at: receivedAt
      };
    })
    .filter((row) => Boolean(row.external_id && row.title && row.body));
}

export async function syncReviewsFromSources() {
  const supabase = createSupabaseAdminClient();
  const before = await supabase.from('reviews').select('id', { count: 'exact', head: true });
  if (before.error) throw new Error(before.error.message);

  const appleReviews = await scrapeAppleReviews();
  const insertRows = toInsertRows(appleReviews);

  for (let i = 0; i < insertRows.length; i += CHUNK_SIZE) {
    const chunk = insertRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('reviews')
      .upsert(chunk, { onConflict: 'external_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const after = await supabase.from('reviews').select('id', { count: 'exact', head: true });
  if (after.error) throw new Error(after.error.message);

  const beforeCount = before.count || 0;
  const afterCount = after.count || 0;

  return {
    sources: {
      apple: {
        scraped: appleReviews.length
      }
    },
    processed: insertRows.length,
    inserted: Math.max(0, afterCount - beforeCount),
    total: afterCount
  };
}
