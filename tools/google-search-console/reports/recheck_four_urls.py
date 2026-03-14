import subprocess
import time

URLS = [
    "https://www.thecompendiumpodcast.com/episodes/episode-105-sixto-rodriguez-the-story-of-an-unknown-musician-who-inspired-a-revolution",
    "https://www.thecompendiumpodcast.com/episodes/episode-145-lucy-letby-did-she-really-kill-these-babies",
    "https://www.thecompendiumpodcast.com/podcast/the-compendium-of-fascinating-things/episode/anni-dewani-honeymoon-murder-and-the-corruption-at-the-heart-of-south-africa",
    "https://www.thecompendiumpodcast.com/podcast/the-compendium-of-fascinating-things/episode/ariel-castro-abducted-in-plain-sight",
]

for url in URLS:
    print(f"\n=== {url}")
    for run_number in range(1, 4):
        first = subprocess.run(
            ["curl", "-I", "-s", "--connect-timeout", "5", "--max-time", "15", url],
            capture_output=True,
            text=True,
        )
        first_status = ""
        first_location = ""
        for line in first.stdout.splitlines():
            if line.startswith("HTTP/") and not first_status:
                parts = line.split()
                if len(parts) >= 2:
                    first_status = parts[1]
            if line.lower().startswith("location:") and not first_location:
                first_location = line.split(":", 1)[1].strip()

        final = subprocess.run(
            [
                "curl",
                "-L",
                "-s",
                "-o",
                "/dev/null",
                "--connect-timeout",
                "5",
                "--max-time",
                "20",
                "-w",
                "%{http_code}\t%{url_effective}",
                url,
            ],
            capture_output=True,
            text=True,
        )
        parts = final.stdout.strip().split("\t")
        final_status = parts[0] if len(parts) > 0 else ""
        final_url = parts[1] if len(parts) > 1 else ""

        print(
            f"run {run_number}: first={first_status or '-'} loc={first_location or '-'} | final={final_status or '-'} url={final_url or '-'}"
        )
        time.sleep(0.3)
