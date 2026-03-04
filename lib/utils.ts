export function firstNameFromFullName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] || 'Performer';
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeAssignmentRef(ref: string): string {
  return ref.trim().toUpperCase();
}

export function sanitizeReplacementChars(value: string): string {
  return value
    .replace(/\uFFFD/g, "'")
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€\x9d|â€/g, '"')
    .replace(/â€“|â€”/g, '-')
    .replace(/â€¦/g, '...')
    .trim();
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return headers.get('x-nf-client-connection-ip') || 'unknown';
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeValue = (value: unknown): string => {
    const str = `${value ?? ''}`;
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeValue(row[h])).join(','));
  }
  return lines.join('\n');
}

export function parseCsv(input: string): { rows: string[][]; errors: string[] } {
  const lines = input
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return { rows: [], errors: ['CSV is empty.'] };

  const rows: string[][] = [];
  const errors: string[] = [];

  function parseLine(line: string): string[] {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
        continue;
      }

      cur += ch;
    }

    cols.push(cur.trim());
    return cols;
  }

  lines.forEach((line, idx) => {
    const cols = parseLine(line);
    if (!cols.length) {
      errors.push(`Row ${idx + 1}: empty row`);
      return;
    }
    rows.push(cols);
  });

  return { rows, errors };
}
