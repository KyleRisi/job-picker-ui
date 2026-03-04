/**
 * Scrape Apple Podcast reviews for The Compendium across all country storefronts.
 *
 * Usage:
 *   npx tsx scripts/scrape-apple-reviews.ts
 *
 * Output:
 *   writes reviews to scripts/apple-reviews.json
 */

const PODCAST_ID = '1676817109';
const MAX_PAGES = 10; // Apple allows up to 10 pages per storefront
const DELAY_MS = 300; // polite delay between requests

// All Apple Podcasts storefront country codes
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
  'uy', 'uz', 've', 'vg', 'vn', 'ye', 'za', 'zw',
];

interface AppleReview {
  id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
  countryName: string;
  date: string;
  voteSum: number;
  voteCount: number;
}

// Map of common country codes to display names
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
  st: 'São Tomé and Príncipe', sv: 'El Salvador', sz: 'Eswatini',
  tc: 'Turks and Caicos Islands', td: 'Chad', th: 'Thailand', tj: 'Tajikistan',
  tm: 'Turkmenistan', tn: 'Tunisia', tr: 'Turkey', tt: 'Trinidad and Tobago', tw: 'Taiwan',
  tz: 'Tanzania', ua: 'Ukraine', ug: 'Uganda', us: 'United States', uy: 'Uruguay',
  uz: 'Uzbekistan', ve: 'Venezuela', vg: 'British Virgin Islands', vn: 'Vietnam',
  ye: 'Yemen', za: 'South Africa', zw: 'Zimbabwe',
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchReviewsPage(country: string, page: number): Promise<AppleReview[]> {
  const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${PODCAST_ID}/sortBy=mostRecent/json`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const entries = data?.feed?.entry;
    if (!entries || !Array.isArray(entries)) return [];

    return entries
      .filter((entry: any) => entry?.['im:rating']?.label) // skip the metadata entry
      .map((entry: any) => ({
        id: entry.id?.label ?? '',
        title: entry.title?.label ?? '',
        body: entry.content?.label ?? '',
        rating: parseInt(entry['im:rating']?.label ?? '0', 10),
        author: entry.author?.name?.label ?? 'Anonymous',
        country: country.toUpperCase(),
        countryName: COUNTRY_NAMES[country] ?? country.toUpperCase(),
        date: entry.updated?.label ?? '',
        voteSum: parseInt(entry['im:voteSum']?.label ?? '0', 10),
        voteCount: parseInt(entry['im:voteCount']?.label ?? '0', 10),
      }));
  } catch {
    return [];
  }
}

async function scrapeCountry(country: string): Promise<AppleReview[]> {
  const allReviews: AppleReview[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const reviews = await fetchReviewsPage(country, page);
    if (reviews.length === 0) break;
    allReviews.push(...reviews);
    await sleep(DELAY_MS);
  }

  return allReviews;
}

async function main() {
  console.log(`\n🎪 Scraping Apple Podcast reviews for podcast ID ${PODCAST_ID}`);
  console.log(`   Checking ${COUNTRY_CODES.length} country storefronts...\n`);

  const allReviews: AppleReview[] = [];
  const seenIds = new Set<string>();
  let countriesWithReviews = 0;

  for (const country of COUNTRY_CODES) {
    const reviews = await scrapeCountry(country);

    // Deduplicate (some reviews appear in multiple storefronts)
    const newReviews = reviews.filter((r) => {
      if (seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    });

    if (newReviews.length > 0) {
      countriesWithReviews++;
      console.log(`  ✅ ${COUNTRY_NAMES[country] ?? country} — ${newReviews.length} review(s)`);
      allReviews.push(...newReviews);
    } else {
      process.stdout.write(`  · ${country.toUpperCase()} `);
    }
  }

  // Sort by date descending
  allReviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const avgRating = allReviews.length > 0
    ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1)
    : '0';

  console.log(`\n\n📊 Results:`);
  console.log(`   Total unique reviews: ${allReviews.length}`);
  console.log(`   Countries with reviews: ${countriesWithReviews}`);
  console.log(`   Average rating: ${avgRating}/5`);
  console.log(`   5★: ${allReviews.filter((r) => r.rating === 5).length}`);
  console.log(`   4★: ${allReviews.filter((r) => r.rating === 4).length}`);
  console.log(`   3★: ${allReviews.filter((r) => r.rating === 3).length}`);
  console.log(`   2★: ${allReviews.filter((r) => r.rating === 2).length}`);
  console.log(`   1★: ${allReviews.filter((r) => r.rating === 1).length}`);

  // Write to file
  const fs = await import('fs');
  const path = await import('path');
  const outPath = path.join(import.meta.dirname ?? '.', 'apple-reviews.json');
  fs.writeFileSync(outPath, JSON.stringify({ scrapedAt: new Date().toISOString(), totalReviews: allReviews.length, averageRating: parseFloat(avgRating), reviews: allReviews }, null, 2));
  console.log(`\n   💾 Saved to ${outPath}\n`);
}

main().catch(console.error);
