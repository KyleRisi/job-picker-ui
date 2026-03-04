import { env } from './env';

const LOCALHOST_URL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;
const DEFAULT_PRODUCTION_URL = 'https://jobpicker.thecompendiumpodcast.com';

function normalizeUrl(input: string): string {
  const value = `${input || ''}`.trim();
  if (!value) return '';
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

export function getPublicSiteUrl(): string {
  const configured = normalizeUrl(env.appBaseUrl);
  if (process.env.NODE_ENV === 'production') {
    if (!configured || LOCALHOST_URL_RE.test(configured)) return DEFAULT_PRODUCTION_URL;
    return configured;
  }
  return configured || 'http://localhost:3000';
}
