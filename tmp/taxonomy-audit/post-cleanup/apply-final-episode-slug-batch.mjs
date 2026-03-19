import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  const envPath = path.join(WORKDIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

const DECISIONS = [
  {
    source_path: '/episodes/oceangate-titan-disaster-a-billionaires-dive-into-hubris-history-and-horror',
    target_url: '/episodes/oceangate-titan-disaster-a-billionaire-s-dive-into-hubris-history-and-horror',
    status_code: 301
  },
  {
    source_path: '/episodes/patty-hearst-from-kidnapped-heiress-to-americas-most-wanted-fugitive',
    target_url: '/episodes/patty-hearst-from-kidnapped-heiress-to-america-s-most-wanted-fugitive',
    status_code: 301
  },
  {
    source_path: '/episodes/the-acali-experiment-science-sex-and-santiago-genovess-bizarre-human-behaviour-study',
    target_url: '/episodes/the-acali-experiment-science-sex-and-santiago-genoves-s-bizarre-human-behaviour-study',
    status_code: 301
  },
  {
    source_path: '/episodes/the-curse-of-the-cecil-americas-most-dangerous-hotel',
    target_url: '/episodes/the-curse-of-the-cecil-america-s-most-dangerous-hotel',
    status_code: 301
  }
];

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const inserted = [];
  const skippedAlreadySatisfied = [];

  for (const d of DECISIONS) {
    const existingUrl = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,target_url,status_code,match_type,is_active,priority,source_type&source_path=eq.${encodeURIComponent(d.source_path)}&is_active=eq.true`;
    const existingRes = await fetch(existingUrl, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      }
    });
    if (!existingRes.ok) {
      throw new Error(`Failed checking existing rows for ${d.source_path}: ${existingRes.status} ${await existingRes.text()}`);
    }

    const existingRows = await existingRes.json();
    const alreadySatisfied = existingRows.some((row) =>
      Number(row.status_code) === d.status_code &&
      (row.target_url || '') === d.target_url &&
      (row.match_type || 'exact') === 'exact'
    );

    if (alreadySatisfied) {
      skippedAlreadySatisfied.push({
        source_path: d.source_path,
        reason: 'already_has_desired_active_row'
      });
      continue;
    }

    const insertPayload = {
      source_path: d.source_path,
      target_url: d.target_url,
      status_code: d.status_code,
      match_type: 'exact',
      is_active: true,
      priority: 100,
      source_type: 'manual',
      source_ref: null
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/redirects`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify(insertPayload)
    });

    if (!insertRes.ok) {
      throw new Error(`Failed inserting row for ${d.source_path}: ${insertRes.status} ${await insertRes.text()}`);
    }

    const insertedRows = await insertRes.json();
    inserted.push(insertedRows[0]);
  }

  console.log(JSON.stringify({
    requested_decisions: DECISIONS.length,
    inserted_count: inserted.length,
    skipped_already_satisfied_count: skippedAlreadySatisfied.length,
    inserted,
    skipped_already_satisfied: skippedAlreadySatisfied
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
