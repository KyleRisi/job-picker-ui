import Link from 'next/link';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';

const COMPARE_TIERS_URL = 'https://www.thecompendiumpodcast.com/patreon#membership-options';
const YOUTUBE_URL = 'https://www.youtube.com/@CompendiumPodcast';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';
const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';

export function JoinPatreonCta() {
  return (
    <section className="full-bleed bg-carnival-ink px-4 py-28 md:py-32 text-white">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-[30px] font-black tracking-tight">Join the Patreon</h2>
        <p className="mx-auto mt-4 max-w-3xl text-[16px] text-white/90">
          Get ad-free listening, early access, bonus archive drops, and your private RSS feed without switching apps.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={PATREON_INTERNAL_PATH}
            className="inline-flex h-[35px] items-center justify-center rounded-full bg-carnival-red px-6 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            Join Patreon
          </Link>
          <a
            href={COMPARE_TIERS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[35px] items-center justify-center rounded-full bg-[#7a705e] px-6 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            Compare tiers
          </a>
          <a
            href={SPOTIFY_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[35px] items-center justify-center rounded-full bg-[#1DB954] px-6 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            Listen on Spotify
          </a>
          <a
            href={APPLE_PODCASTS_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[35px] items-center justify-center rounded-full bg-[#B457F2] px-6 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            Listen on Apple Podcasts
          </a>
          <a
            href={YOUTUBE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[35px] items-center justify-center rounded-full bg-carnival-red px-6 text-[14px] font-semibold text-white transition hover:brightness-110"
          >
            Watch on YouTube
          </a>
        </div>
      </div>
    </section>
  );
}
