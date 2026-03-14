import json, csv

# Load existing reviews
with open('lib/reviews-data.json') as f:
    existing = json.load(f)

# Build lookup sets from existing reviews
existing_authors = {r['author'].lower() for r in existing}
existing_titles = {r['title'].lower() for r in existing}
existing_pairs = {(r['author'].lower(), r['title'].lower()) for r in existing}

# Also load raw scrape for full author list
with open('apple-reviews.json') as f:
    raw = json.load(f)['reviews']
raw_authors = {r['author'].lower() for r in raw}
raw_titles = {r['title'].lower() for r in raw}

# Read CSV
with open('/Users/kyle/Downloads/Untitled spreadsheet - Sheet2.csv', newline='') as f:
    reader = csv.DictReader(f)
    csv_reviews = list(reader)

print(f"== Existing JSON: {len(existing)} reviews ==")
print(f"== Raw Apple scrape: {len(raw)} reviews ==")
print(f"== CSV total: {len(csv_reviews)} reviews ==")
print()

apple_missing = []
website_reviews = []
apple_matched = []
apple_username_changed = []

for row in csv_reviews:
    platform = row['Platform'].strip()
    author = row['Reviewer'].strip()
    title = row['Title'].strip()
    rating = int(row['Rating '].strip())

    if platform == 'Website':
        website_reviews.append(row)
        continue

    # Apple Podcast review - check if in JSON
    author_lower = author.lower()
    title_lower = title.lower()

    # Exact match by author
    if author_lower in existing_authors:
        if (author_lower, title_lower) in existing_pairs:
            apple_matched.append(f"  EXACT: {author} - {title}")
        else:
            apple_missing.append(dict(row))
            apple_missing[-1]['_reason'] = 'Author in JSON but different title (2nd review?)'
        continue

    # Title match (username changed)
    if title_lower in existing_titles:
        apple_username_changed.append(f"  {author} -> (title '{title}' exists under different author)")
        continue

    # Check raw scrape too
    if author_lower in raw_authors:
        apple_matched.append(f"  RAW MATCH (filtered <4*): {author} - {title} [{rating}*]")
        continue

    # Genuinely not found
    apple_missing.append(dict(row))
    apple_missing[-1]['_reason'] = 'Not found in JSON or raw scrape'

print(f"== APPLE: Matched (already in JSON): {len(apple_matched)} ==")
print()
print(f"== APPLE: Username changed (same title exists): {len(apple_username_changed)} ==")
for u in apple_username_changed:
    print(u)
print()
print(f"== APPLE: Missing from JSON: {len(apple_missing)} ==")
for r in apple_missing:
    reason = r.get('_reason', '')
    print(f"  [{r['Rating '].strip()}*] {r['Reviewer'].strip()} - {r['Title'].strip()} ({r['Date'].strip()}) -- {reason}")
print()
print(f"== WEBSITE: All new (none in JSON): {len(website_reviews)} ==")
for r in website_reviews:
    print(f"  [{r['Rating '].strip()}*] {r['Reviewer'].strip()} - {r['Title'].strip()} ({r['Date'].strip()})")
