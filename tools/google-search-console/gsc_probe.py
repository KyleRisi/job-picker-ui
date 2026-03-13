import re
import subprocess
from urllib.parse import urlparse
from pathlib import Path
from collections import Counter

text = Path('/tmp/gsc_pages_28d.txt').read_text(errors='ignore')
urls = sorted(set(re.findall(r'https?://[^\s]+', text)))

candidates = []
for url in urls:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    path = parsed.path
    reasons = []

    if host != 'www.thecompendiumpodcast.com':
        reasons.append('non_www_or_alt_host')
    if url.startswith('http://'):
        reasons.append('http_scheme')
    if '/podcast/the-compendium-of-fascinating-things/episode/' in path:
        reasons.append('legacy_podcast_episode_path')
    if path.startswith('/episode/'):
        reasons.append('legacy_episode_singular_path')
    if re.match(r'^/episodes/episode-\d+-', path):
        reasons.append('legacy_numbered_episode_path')
    if path.startswith('/person/'):
        reasons.append('legacy_person_path')
    if path in ('/pressandmedia', '/pressandmedia/'):
        reasons.append('legacy_press_path')
    if parsed.query:
        reasons.append('query_variant')

    if reasons:
        candidates.append((url, ';'.join(reasons)))

manual = [
    ('https://www.thecompendiumpodcast.com/blog/topic/true-crime?page=2', 'legacy_blog_topic_redirect'),
    ('https://www.thecompendiumpodcast.com/blog/series/conspiracy?page=2', 'legacy_blog_series_redirect_sample'),
    ('https://www.thecompendiumpodcast.com/episodes/episode-118-the-acali-experiment-science-sex-and-santiago-genoves-s-bizarre-human-behaviour-study', 'legacy_numbered_episode_known_404'),
    ('https://www.thecompendiumpodcast.com/blog/the-jennifer-fairgate-mystery?hl=en-us', 'query_variant_known'),
]
seen = {url for url, _ in candidates}
for url, reason in manual:
    if url not in seen:
        candidates.append((url, reason))

priority = [
    'legacy_numbered_episode_path',
    'legacy_numbered_episode_known_404',
    'legacy_podcast_episode_path',
    'legacy_episode_singular_path',
    'legacy_blog_topic_redirect',
    'legacy_blog_series_redirect_sample',
    'legacy_person_path',
    'legacy_press_path',
    'non_www_or_alt_host',
    'http_scheme',
    'query_variant',
]

def score(reason: str) -> int:
    parts = reason.split(';')
    vals = [priority.index(part) for part in parts if part in priority]
    return min(vals) if vals else 999

candidates.sort(key=lambda item: (score(item[1]), item[0]))
candidates = candidates[:120]

rows = []
for url, reason in candidates:
    attempts = []
    for _ in range(3):
        first = subprocess.run(
            ['curl', '-I', '-s', '--connect-timeout', '5', '--max-time', '10', url],
            capture_output=True,
            text=True,
        )
        headers = first.stdout.splitlines()

        status_line = next((line for line in headers if line.startswith('HTTP/')), '')
        status_match = re.search(r'\s(\d{3})\s', status_line)
        first_status = status_match.group(1) if status_match else ''

        first_location = ''
        for line in headers:
            if line.lower().startswith('location:'):
                first_location = line.split(':', 1)[1].strip()
                break

        final = subprocess.run(
            ['curl', '-L', '-s', '--connect-timeout', '5', '--max-time', '15', '-o', '/dev/null', '-w', '%{http_code}\t%{url_effective}', url],
            capture_output=True,
            text=True,
        )
        parts = final.stdout.strip().split('\t')
        final_status = parts[0] if len(parts) > 0 else ''
        final_url = parts[1] if len(parts) > 1 else ''
        attempts.append((first_status, first_location, final_status, final_url))

    first_status = attempts[-1][0]
    first_location = attempts[-1][1]
    final_status = attempts[-1][2]
    final_url = attempts[-1][3]
    unstable = len({attempt[2] for attempt in attempts}) > 1
    fail_count = sum(1 for attempt in attempts if attempt[2].startswith(('4', '5')))
    final_classification = 'problem' if fail_count >= 2 else 'ok'

    rows.append((
        reason,
        url,
        first_status,
        first_location,
        final_status,
        final_url,
        str(fail_count),
        'yes' if unstable else 'no',
        final_classification,
    ))

report_path = Path('/tmp/gsc_redirect_probe_2026-03-10.tsv')
report_path.write_text(
    'reason\turl\tfirst_status\tfirst_location\tfinal_status\tfinal_url\tfail_count_3\tunstable\tclassification\n'
    + '\n'.join('\t'.join(row) for row in rows)
)

print('rows', len(rows))
print('first_status_counts', dict(Counter(row[2] for row in rows)))
print('final_status_counts', dict(Counter(row[4] for row in rows)))
problem_rows = [row for row in rows if row[8] == 'problem']
print('problem_rows', len(problem_rows))
for row in problem_rows[:40]:
    print('\t'.join(row))
print('report', str(report_path))
