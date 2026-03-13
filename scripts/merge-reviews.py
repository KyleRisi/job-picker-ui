#!/usr/bin/env python3
"""
Merge new reviews from CSV into reviews-data.json.
Fixes Mac Roman encoding issues and deduplicates against existing data.
"""

import json, csv, re, hashlib


def fix_text(text):
    """Fix UTF-8 text that was decoded as Mac Roman then re-encoded as UTF-8."""
    if not text or all(ord(c) < 128 for c in text):
        return text
    try:
        return text.encode('mac_roman').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError) as e:
        # Fallback: process segments between ASCII boundaries
        result = []
        buf = []

        def flush():
            if not buf:
                return
            chunk = ''.join(buf)
            try:
                result.append(chunk.encode('mac_roman').decode('utf-8'))
            except:
                # Try smaller sub-chunks
                i = 0
                while i < len(chunk):
                    found = False
                    for end in range(min(i + 8, len(chunk)), i, -1):
                        sub = chunk[i:end]
                        try:
                            result.append(sub.encode('mac_roman').decode('utf-8'))
                            i = end
                            found = True
                            break
                        except:
                            continue
                    if not found:
                        result.append(chunk[i])
                        i += 1
            buf.clear()

        for c in text:
            if ord(c) < 128:
                flush()
                result.append(c)
            else:
                buf.append(c)
        flush()
        return ''.join(result)


def parse_date(date_str):
    """Parse DD/MM/YYYY to YYYY-MM-DD."""
    parts = date_str.strip().split('/')
    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"


def normalize(text):
    """Normalize text for comparison: lowercase, strip whitespace, remove non-alnum."""
    return re.sub(r'[^a-z0-9]', '', text.lower().strip())


def body_fingerprint(body):
    """Get first ~50 alnum chars of body for matching."""
    return normalize(body)[:50]


# ── Load existing reviews ──
with open('lib/reviews-data.json') as f:
    existing = json.load(f)

print(f"Existing reviews: {len(existing)}")

# Build lookup by (author_norm, body_fingerprint)
existing_fingerprints = set()
existing_author_titles = set()
for r in existing:
    fp = body_fingerprint(r['body'])
    existing_fingerprints.add((normalize(r['author']), fp))
    existing_author_titles.add((normalize(r['author']), normalize(r['title'])))

# ── Load raw Apple scrape for country info ──
with open('apple-reviews.json') as f:
    raw_scrape = json.load(f)['reviews']
raw_by_author = {}
for r in raw_scrape:
    author_norm = normalize(r['author'])
    if author_norm not in raw_by_author:
        raw_by_author[author_norm] = []
    raw_by_author[author_norm].append(r)

# ── Read new CSV ──
with open('/Users/kyle/Downloads/Reviews - Sheet1.csv', newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    csv_reviews = list(reader)

print(f"CSV reviews: {len(csv_reviews)}")

# ── Process CSV reviews ──
new_reviews = []
skipped = []
web_counter = 1
apple_counter = 1

for row in csv_reviews:
    platform_raw = row['Platform'].strip()
    is_apple = 'Apple' in platform_raw
    platform = 'apple' if is_apple else 'website'

    date = parse_date(row['Date'])
    author = fix_text(row['Reviewer'].strip())
    title = fix_text(row['Title'].strip())
    body = fix_text(row['Review'].strip())

    # Normalize newlines (CSV sometimes has " \n " for line breaks)
    body = re.sub(r' ?\n ?', '\n', body)
    # Remove leading/trailing whitespace from each line
    body = '\n'.join(line.strip() for line in body.split('\n'))
    # Collapse 3+ consecutive newlines to 2
    body = re.sub(r'\n{3,}', '\n\n', body)

    author_norm = normalize(author)
    fp = body_fingerprint(body)
    title_norm = normalize(title)

    # ── Dedup: skip if body matches existing ──
    if (author_norm, fp) in existing_fingerprints:
        skipped.append(f"BODY MATCH: {author} – {title}")
        continue

    # ── Dedup: skip if author+title matches existing ──
    if (author_norm, title_norm) in existing_author_titles:
        skipped.append(f"TITLE MATCH: {author} – {title}")
        continue

    # ── Skip: PodcastListener-2020 (3 stars) ──
    if 'podcastlistener' in author_norm:
        skipped.append(f"LOW RATING: {author} – {title}")
        continue

    # ── Skip: Pmelodyy 15/07/2025 duplicate (unedited version of 26/08 review) ──
    if author_norm == 'pmelodyy' and date == '2025-07-15':
        skipped.append(f"DUPLICATE: {author} – {title} ({date})")
        continue

    # ── Determine country ──
    country = ''
    if is_apple:
        # Check raw scrape for country
        if author_norm in raw_by_author:
            country = raw_by_author[author_norm][0].get('countryName', '')
        # Fallback: infer from review text
        if not country:
            body_lower = body.lower()
            if 'canadian' in body_lower or 'canada' in body_lower:
                country = 'Canada'
            elif 'california' in body_lower or 'brooklyn' in body_lower or 'nyc' in body_lower:
                country = 'United States'
            elif 'aussie' in body_lower or 'australia' in body_lower:
                country = 'Australia'

    # ── Generate ID ──
    if is_apple:
        review_id = f"apple-{apple_counter}"
        apple_counter += 1
    else:
        review_id = f"web-{web_counter}"
        web_counter += 1

    new_reviews.append({
        'id': review_id,
        'title': title,
        'body': body,
        'rating': 5,
        'author': author,
        'country': country,
        'platform': platform,
        'date': date,
    })

# ── Add platform field to existing reviews ──
for r in existing:
    r['platform'] = 'apple'

# ── Combine and sort by date descending ──
all_reviews = existing + new_reviews
all_reviews.sort(key=lambda r: r['date'], reverse=True)

# ── Write output ──
with open('lib/reviews-data.json', 'w', encoding='utf-8') as f:
    json.dump(all_reviews, f, indent=2, ensure_ascii=False)

print(f"\nNew reviews added: {len(new_reviews)}")
print(f"Total reviews: {len(all_reviews)}")

print("\n── NEW REVIEWS ──")
for r in new_reviews:
    emoji_check = '✓' if all(ord(c) < 128 or ord(c) > 255 for c in r['body']) else '⚠ ENCODING?'
    print(f"  [{r['platform']:7s}] {r['author'][:25]:25s} – {r['title'][:40]:40s} ({r['date']}) {emoji_check}")
    # Show first 80 chars of body for verification
    preview = r['body'][:80].replace('\n', ' ')
    print(f"           {preview}...")

print(f"\n── SKIPPED ({len(skipped)}) ──")
for s in skipped:
    print(f"  {s}")

# ── Verify encoding quality ──
print("\n── ENCODING CHECK ──")
problems = []
for r in all_reviews:
    for field in ['title', 'body', 'author']:
        text = r[field]
        # Check for known garbled patterns
        if re.search(r'‚Ä|√©|√≠|√∫|√±|√≥|√≤|üò|ü©|üô|ü§|ü•|ü´|üë', text):
            problems.append(f"  {r['author']} – {field}: ...{text[:60]}...")
            break
if problems:
    print(f"⚠ {len(problems)} reviews may still have encoding issues:")
    for p in problems[:10]:
        print(p)
else:
    print("✓ No garbled encoding patterns detected in any review!")
