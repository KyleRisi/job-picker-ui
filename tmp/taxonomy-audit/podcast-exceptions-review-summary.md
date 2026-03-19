# Podcast Exceptions Review Summary (Preparation Only)

Source: `podcast-manual-exceptions.csv`

## Totals
- Total podcast manual rows: 134
- Deterministic duplicates: 90
- Explicit exceptions: 44

## Exception Classification Counts
- `slug correction`: 28
- `destination differs from simple pattern`: 8
- `canonical content remap`: 8

## Interpretation
- `slug correction`: Destination is effectively the same content slug with normalization differences (apostrophes, punctuation, tokenization).
- `destination differs from simple pattern`: Destination intentionally diverges from plain `/episodes/<legacy-slug>` transform.
- `canonical content remap`: Destination points to a materially different canonical episode slug and should remain explicit unless editorially changed.

## Future-State Intent (Not Executed)
- Keep these 44 as explicit manual exceptions.
- Baseline podcast legacy behavior can be pattern-owned in a later phase.
