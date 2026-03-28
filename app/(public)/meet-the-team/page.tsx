import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getActiveTeamMembers, getJobsForPublic } from '@/lib/data';
import { FreaksGrid, type FreakMember } from '@/components/freaks-grid';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

type TeamMember = {
  name: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
  imageClassName?: string;
  href?: string;
};

// Public, non-personalized content: refresh periodically instead of rendering on every request.
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Meet the Team',
  description:
    'Meet the core Compendium Podcast team and the additional freaks behind the scenes.',
  ...buildCanonicalAndSocialMetadata({
    title: 'Meet the Team | The Compendium Podcast',
    description:
      'Meet the core Compendium Podcast team and the additional freaks behind the scenes.',
    twitterTitle: 'Meet the Team | The Compendium Podcast',
    twitterDescription:
      'Meet the core Compendium Podcast team and the additional freaks behind the scenes.',
    canonicalCandidate: '/meet-the-team',
    fallbackPath: '/meet-the-team',
    openGraphType: 'website',
    imageUrl: '/The Compendium Main.jpg',
    imageAlt: 'Meet the team at The Compendium Podcast'
  })
};

function getLondonDayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
}

function pickDailyTitle(titles: string[]): string {
  if (!titles.length) return 'Co-Host';
  const uniqueTitles = Array.from(new Set(titles.map((title) => title.trim()).filter(Boolean)));
  if (!uniqueTitles.length) return 'Co-Host';

  const dayKey = getLondonDayKey();
  const seed = dayKey.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return uniqueTitles[seed % uniqueTitles.length];
}

function MemberCard({ member }: { member: TeamMember }) {
  const cardClassName = member.href
    ? 'rounded-2xl border border-white/15 bg-white/10 p-5 text-center shadow-card backdrop-blur-sm transition-colors duration-200 hover:bg-white/15'
    : 'rounded-2xl border border-white/15 bg-white/10 p-5 text-center shadow-card backdrop-blur-sm';

  const cardContent = (
    <>
      <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-carnival-gold/45 bg-carnival-cream/20 shadow-lg">
        <Image
          src={member.imageSrc}
          alt={member.imageAlt}
          width={160}
          height={160}
          className={`h-full w-full object-cover ${member.imageClassName || ''}`}
        />
      </div>
      <h3 className="mt-4 text-xl font-black text-white">{member.name}</h3>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-carnival-gold/90">
        {member.title}
      </p>
    </>
  );

  return (
    <article className={cardClassName}>
      {member.href ? (
        <Link href={member.href} className="block" aria-label={`Open ${member.name} author page`}>
          {cardContent}
        </Link>
      ) : (
        cardContent
      )}
    </article>
  );
}

export default async function MeetTheTeamPage() {
  let adamTitle = 'Co-Host';
  let liveTeamMembers: Awaited<ReturnType<typeof getActiveTeamMembers>> = [];

  try {
    const jobs = await getJobsForPublic();
    adamTitle = pickDailyTitle(jobs.map((job) => job.title));
  } catch (error) {
    console.error('Failed to load jobs for Adam title rotation on team page:', error);
  }

  try {
    liveTeamMembers = await getActiveTeamMembers();
  } catch (error) {
    console.error('Failed to load active team members for freaks section:', error);
  }

  const coreTeam: TeamMember[] = [
    {
      name: 'Kyle Risi',
      title: 'Ringmaster',
      imageSrc: '/Kyle-meet-the-team.jpg',
      imageAlt: 'Kyle',
      imageClassName: 'scale-150',
      href: '/author/kyle-risi'
    },
    {
      name: 'Adam Cox',
      title: adamTitle,
      imageSrc: '/Adam-meet-the-team.jpg',
      imageAlt: 'Adam',
      imageClassName: 'scale-150',
      href: '/author/adam-cox'
    },
    {
      name: 'Kieth',
      title: 'Resident Lion Behaviour Co-ordinator',
      imageSrc: '/Kieth-meet-the-team-256.jpg',
      imageAlt: 'Kieth'
    },
    {
      name: 'Sue',
      title: 'Ministeress of Human Affairs',
      imageSrc: '/Sue-meet-the-team-256.jpg',
      imageAlt: 'Sue from HR'
    }
  ];
  const coreNames = new Set(coreTeam.map((member) => member.name.toLowerCase()));
  const freaksTeam: FreakMember[] = liveTeamMembers
    .filter(
      (member) =>
        !coreNames.has(member.full_name.toLowerCase()) &&
        Boolean(member.profile_photo_data_url?.trim())
    )
    .map((member) => ({
      id: member.id,
      name: member.full_name,
      title: member.job_title,
      imageSrc: member.profile_photo_data_url || '',
      imageAlt: `${member.full_name} profile`
    }));

  return (
    <>
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image
            src="/cover-banner-hero.jpg"
            alt=""
            fill
            priority
            quality={72}
            className="object-cover object-top opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-carnival-ink/70 via-carnival-ink/85 to-carnival-ink" />
          <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-carnival-red/25 blur-[120px]" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4">
          <header className="mb-10 text-center md:mb-14">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">
              The Compendium Podcast
            </p>
            <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">
              Meet the Team
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
              Corporate headshots, whimsically overwrought bureaucratic titles, and a healthy respect
              for the eternal big-top circus of administrative absurdity.
            </p>
          </header>

          <section>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Core Team</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {coreTeam.map((member) => (
                <MemberCard key={member.name} member={member} />
              ))}
            </div>
          </section>

          <section className="mt-10 border-t border-white/15 pt-10 md:mt-14 md:pt-12">
            <h2 className="text-2xl font-black text-white sm:text-3xl">Our Circus Freaks</h2>
            <p className="mt-2 text-sm text-white/70">
              Under Standard Circus Policy 12-C, these freaks are officially essential to daily
              operations. Without their service, structure and whimsy would both fail, so each is
              formally recognized for outstanding administrative chaos.
            </p>
            <FreaksGrid members={freaksTeam} />
          </section>
        </div>
      </section>

      <section className="full-bleed -mb-8 bg-carnival-gold py-16 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 text-center">
          <div>
            <span className="inline-block rounded-full bg-carnival-teal px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
              The Compendium Podcast
            </span>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-carnival-ink md:text-5xl">
              Join the Team
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-carnival-ink/85">
              Ready to enter the official administrative chaos pipeline? Pick a role, submit your
              application, and claim your place in circus history.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                Find a Job &rarr;
              </Link>
              <Link
                href="/my-job"
                className="inline-flex items-center gap-2 rounded-full border-2 border-carnival-teal bg-carnival-teal px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                I Have a Job
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
