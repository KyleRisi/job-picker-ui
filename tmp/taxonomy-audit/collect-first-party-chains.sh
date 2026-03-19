#!/usr/bin/env bash
set -euo pipefail

OUT_JSON="tmp/taxonomy-audit/first-party-chains.json"
OUT_CSV="tmp/taxonomy-audit/first-party-chains.csv"
URLS_FILE="tmp/taxonomy-audit/chain-urls.txt"

mkdir -p tmp/taxonomy-audit

cat > "$URLS_FILE" <<'EOF'
http://thecompendiumpodcast.com/
https://thecompendiumpodcast.com/
http://www.thecompendiumpodcast.com/
https://www.thecompendiumpodcast.com/
https://www.thecompendiumpodcast.com/episode/west-memphis-three-paradise-lost-justice-lost-innocence-lost
https://www.thecompendiumpodcast.com/episodes/episode-150-chowchilla-bus-kidnapping-the-day-a-school-bus-vanished
https://www.thecompendiumpodcast.com/podcast/the-compendium-of-fascinating-things/episode/chowchilla-bus-kidnapping-the-day-a-school-bus-vanished
https://www.thecompendiumpodcast.com/blog/jennifer-fairgate
https://www.thecompendiumpodcast.com/blog/emanuela-orlandi
https://www.thecompendiumpodcast.com/blog/topic/murders
https://www.thecompendiumpodcast.com/blog/series/british-cases
https://www.thecompendiumpodcast.com/blog/series/survival-stories
https://www.thecompendiumpodcast.com/events
https://www.thecompendiumpodcast.com/cases
https://www.thecompendiumpodcast.com/people
https://www.thecompendiumpodcast.com/series
https://www.thecompendiumpodcast.com/themes/scandals
https://www.thecompendiumpodcast.com/blog/topic/scandals
https://www.thecompendiumpodcast.com/blog/series/emanuela-orlandi
https://www.thecompendiumpodcast.com/themes/murders
https://www.thecompendiumpodcast.com/collections/frauds-hoaxes-cons
EOF

json_escape() {
  local s="$1"
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  printf '%s' "$s"
}

trace_one() {
  local requested="$1"
  local current="$requested"
  local hop_count=0
  local last_status=0
  local chain_parts=()

  while true; do
    local headers
    headers=$(curl -sS -I --max-redirs 0 --connect-timeout 12 --max-time 20 "$current" || true)

    local status
    status=$(printf '%s\n' "$headers" | awk 'toupper($1) ~ /^HTTP\// {code=$2} END{if(code=="") code=0; print code}')
    last_status="$status"

    local location
    location=$(printf '%s\n' "$headers" | awk 'toupper($1)=="LOCATION:" {sub(/\r$/, "", $2); print $2; exit}')

    chain_parts+=("${status} ${current}")

    if [[ -z "${location:-}" ]]; then
      break
    fi

    if [[ "$location" =~ ^https?:// ]]; then
      current="$location"
    else
      local origin
      origin=$(printf '%s' "$current" | sed -E 's#(https?://[^/]+).*#\1#')
      if [[ "$location" == /* ]]; then
        current="${origin}${location}"
      else
        current="${origin}/${location}"
      fi
    fi

    hop_count=$((hop_count + 1))
    if [[ $hop_count -ge 12 ]]; then
      chain_parts+=("MAX_HOPS_REACHED ${current}")
      break
    fi
  done

  local full_chain
  full_chain=$(IFS=' | '; printf '%s' "${chain_parts[*]}")

  printf '{"requested_url":"%s","full_chain":"%s","final_url":"%s","final_status":%s,"hop_count":%s}\n' \
    "$(json_escape "$requested")" \
    "$(json_escape "$full_chain")" \
    "$(json_escape "$current")" \
    "$last_status" \
    "$hop_count"
}

TMP_JSONL="tmp/taxonomy-audit/first-party-chains.jsonl"
: > "$TMP_JSONL"

while IFS= read -r url; do
  [[ -z "$url" ]] && continue
  trace_one "$url" >> "$TMP_JSONL"
done < "$URLS_FILE"

node - <<'NODE'
const fs = require('fs');
const jsonlPath = 'tmp/taxonomy-audit/first-party-chains.jsonl';
const outJson = 'tmp/taxonomy-audit/first-party-chains.json';
const outCsv = 'tmp/taxonomy-audit/first-party-chains.csv';
const rows = fs.readFileSync(jsonlPath, 'utf8').trim().split(/\n+/).filter(Boolean).map((line) => JSON.parse(line));
fs.writeFileSync(outJson, JSON.stringify(rows, null, 2));
const header = ['requested_url','full_chain','final_url','final_status','hop_count'];
const esc = (v) => {
  const s = `${v ?? ''}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = [header.join(',')].concat(rows.map((r) => header.map((k) => esc(r[k])).join(','))).join('\n') + '\n';
fs.writeFileSync(outCsv, csv);
console.log(`chain_rows=${rows.length}`);
NODE
