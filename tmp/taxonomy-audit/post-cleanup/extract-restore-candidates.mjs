import fs from 'node:fs';

const INPUT = 'tmp/taxonomy-audit/post-cleanup/deleted-source-chain-checks-2026-03-18T17-06-10Z.csv';
const OUTPUT = 'tmp/taxonomy-audit/post-cleanup/immediate-restore-candidates-2026-03-18T17-06-10Z.csv';

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const header = lines.shift().split(',');
  const rows = lines.map((line) => {
    const cols = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          q = !q;
        }
      } else if (ch === ',' && !q) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });
    return row;
  });
  return { header, rows };
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = `${v ?? ''}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => esc(row[h])).join(','));
  return `${lines.join('\n')}\n`;
}

const { rows } = parseCsv(fs.readFileSync(INPUT, 'utf8'));
const restore = rows.filter((r) => r.result === 'broken' && r.expected_targets);

const headers = ['source_path', 'expected_targets', 'full_chain', 'final_url', 'final_status', 'result'];
fs.writeFileSync(OUTPUT, toCsv(restore, headers));

console.log(JSON.stringify({
  output: OUTPUT,
  restore_candidate_count: restore.length
}, null, 2));
