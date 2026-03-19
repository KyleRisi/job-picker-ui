import { z } from 'zod';

export const REDIRECT_STATUS_CODES = [301, 302, 307, 308, 410] as const;
export const REDIRECT_MATCH_TYPES = ['exact', 'prefix'] as const;

export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number];
export type RedirectMatchType = (typeof REDIRECT_MATCH_TYPES)[number];

export type RedirectRow = {
  id: string;
  source_path: string;
  target_url: string | null;
  status_code: RedirectStatusCode;
  match_type: RedirectMatchType;
  is_active: boolean;
  priority: number;
  notes: string;
  created_at: string;
  updated_at: string;
};

const statusCodeSchema = z.union([
  z.literal(301),
  z.literal(302),
  z.literal(307),
  z.literal(308),
  z.literal(410)
]);

const matchTypeSchema = z.union([z.literal('exact'), z.literal('prefix')]);

function looksLikeExternalUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function normalizePath(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '/';

  let value = raw;
  if (looksLikeExternalUrl(value)) {
    try {
      value = new URL(value).pathname || '/';
    } catch {
      return '/';
    }
  }

  if (!value.startsWith('/')) value = `/${value}`;

  const [pathOnly] = value.split('?');
  const compact = pathOnly.replace(/\/+/g, '/');
  if (compact === '/') return '/';

  return compact.replace(/\/+$/, '').toLowerCase() || '/';
}

export function isSafeTargetUrl(input: string): boolean {
  const target = (input || '').trim();
  if (!target) return false;

  if (target.startsWith('/')) return true;

  try {
    const url = new URL(target);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export const redirectInputSchema = z.object({
  source_path: z.string().min(1),
  target_url: z.string().optional().nullable().default(''),
  status_code: statusCodeSchema.default(301),
  match_type: matchTypeSchema.default('exact'),
  is_active: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(100000).default(100),
  notes: z.string().max(500).optional().default('')
});

export function normalizeRedirectInput(input: z.input<typeof redirectInputSchema>) {
  const parsed = redirectInputSchema.parse(input);
  const source_path = normalizePath(parsed.source_path);
  const target_url = `${parsed.target_url || ''}`.trim();

  if (parsed.status_code !== 410 && !isSafeTargetUrl(target_url)) {
    throw new Error('Target URL must be an internal path or an http/https URL.');
  }
  if (parsed.status_code === 410 && target_url && !isSafeTargetUrl(target_url)) {
    throw new Error('Target URL must be an internal path or an http/https URL when provided.');
  }

  return {
    source_path,
    target_url: target_url || null,
    status_code: parsed.status_code,
    match_type: parsed.match_type,
    is_active: parsed.is_active,
    priority: parsed.priority,
    notes: parsed.notes.trim()
  };
}

export function buildRedirectLocation(params: {
  requestUrl: URL;
  requestPath: string;
  sourcePath: string;
  targetUrl: string;
  matchType: RedirectMatchType;
  preserveQuery?: boolean;
}): string {
  const { requestUrl, requestPath, sourcePath, targetUrl, matchType, preserveQuery = true } = params;
  const base = new URL(requestUrl.origin);
  const destination = targetUrl.startsWith('/') ? new URL(targetUrl, base) : new URL(targetUrl);

  if (matchType === 'prefix') {
    const normalizedRequestPath = normalizePath(requestPath);
    const suffix = normalizedRequestPath === sourcePath
      ? ''
      : normalizedRequestPath.startsWith(`${sourcePath}/`)
        ? normalizedRequestPath.slice(sourcePath.length)
        : '';

    if (suffix) {
      const nextPath = destination.pathname === '/'
        ? suffix
        : `${destination.pathname.replace(/\/$/, '')}${suffix}`;
      destination.pathname = nextPath;
    }
  }

  if (preserveQuery && requestUrl.search) {
    const sourceParams = requestUrl.searchParams;
    sourceParams.forEach((value, key) => {
      if (!destination.searchParams.has(key)) {
        destination.searchParams.append(key, value);
      }
    });
  }

  return destination.toString();
}

export function shouldSkipRedirectLookup(pathname: string): boolean {
  if (!pathname.startsWith('/')) return true;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/episodes/') ||
    pathname.startsWith('/blog/')
  ) {
    return true;
  }

  if (
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json'
  ) {
    return true;
  }

  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function csvEscape(value: string): string {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function parseRedirectCsv(csvText: string) {
  const rows = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!rows.length) return [];

  const header = parseCsvLine(rows[0]).map((value) => value.toLowerCase());
  const getIndex = (name: string) => header.indexOf(name);

  const sourceIdx = getIndex('source_path');
  const targetIdx = getIndex('target_url');
  const codeIdx = getIndex('status_code');
  const typeIdx = getIndex('match_type');
  const activeIdx = getIndex('is_active');
  const priorityIdx = getIndex('priority');
  const notesIdx = getIndex('notes');

  if (sourceIdx < 0 || targetIdx < 0) {
    throw new Error('CSV must include source_path and target_url headers.');
  }

  const parsedRows = rows.slice(1).map((line, index) => {
    const cols = parseCsvLine(line);
    const statusValue = Number.parseInt(cols[codeIdx] || '301', 10);
    const status_code = REDIRECT_STATUS_CODES.includes(statusValue as RedirectStatusCode)
      ? (statusValue as RedirectStatusCode)
      : 301;

    const matchValue = (cols[typeIdx] || 'exact').toLowerCase();
    const match_type = REDIRECT_MATCH_TYPES.includes(matchValue as RedirectMatchType)
      ? (matchValue as RedirectMatchType)
      : 'exact';

    const activeRaw = (cols[activeIdx] || 'true').toLowerCase();
    const is_active = activeRaw !== '0' && activeRaw !== 'false' && activeRaw !== 'no';

    const priorityValue = Number.parseInt(cols[priorityIdx] || '100', 10);
    const priority = Number.isFinite(priorityValue) ? Math.max(0, priorityValue) : 100;

    try {
      return normalizeRedirectInput({
        source_path: cols[sourceIdx] || '',
        target_url: cols[targetIdx] || '',
        status_code,
        match_type,
        is_active,
        priority,
        notes: cols[notesIdx] || ''
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid row.';
      throw new Error(`CSV row ${index + 2}: ${message}`);
    }
  });

  return parsedRows;
}

export function toRedirectCsv(rows: RedirectRow[]): string {
  const header = ['source_path', 'target_url', 'status_code', 'match_type', 'is_active', 'priority', 'notes'];
  const lines = rows.map((row) => [
    row.source_path,
    row.target_url || '',
    `${row.status_code}`,
    row.match_type,
    row.is_active ? 'true' : 'false',
    `${row.priority}`,
    row.notes || ''
  ].map((value) => csvEscape(value)).join(','));

  return `${header.join(',')}\n${lines.join('\n')}`;
}
