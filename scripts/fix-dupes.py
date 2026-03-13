#!/usr/bin/env python3
"""Fix duplicate entries from Apple username changes."""
import json

with open('lib/reviews-data.json') as f:
    reviews = json.load(f)

print(f"Before: {len(reviews)} reviews")

# Fix 1: Cowgirl Slim -> Okay Drey (username changed on Apple)
reviews = [r for r in reviews if not (r['author'] == 'Okay Drey' and r['id'].startswith('apple-'))]
for r in reviews:
    if r['author'] == 'Cowgirl Slim':
        r['author'] = 'Okay Drey'
        print("Updated: Cowgirl Slim -> Okay Drey")

# Fix 2: Lomax_7 -> Chrislex7 (username changed on Apple)
reviews = [r for r in reviews if not (r['author'] == 'Chrislex7' and r['id'].startswith('apple-'))]
for r in reviews:
    if r['author'] == 'Lomax_7':
        r['author'] = 'Chrislex7'
        print("Updated: Lomax_7 -> Chrislex7")

print(f"After: {len(reviews)} reviews")

with open('lib/reviews-data.json', 'w', encoding='utf-8') as f:
    json.dump(reviews, f, indent=2, ensure_ascii=False)

print("Done!")
