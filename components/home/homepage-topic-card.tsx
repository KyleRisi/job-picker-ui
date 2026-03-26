import Link from 'next/link';

type HomepageTopicCardProps = {
  href: string;
  title: string;
  description: string;
  backgroundUrl?: string | null;
  eventProps?: Record<string, string>;
};

export function HomepageTopicCard({
  href,
  title,
  description,
  backgroundUrl,
  eventProps
}: HomepageTopicCardProps) {
  return (
    <Link
      href={href}
      className="group relative isolate flex min-h-[230px] flex-col overflow-hidden rounded-xl bg-carnival-ink p-4 shadow-[0_18px_40px_rgba(0,0,0,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_55px_rgba(0,0,0,0.55)]"
      {...eventProps}
    >
      {backgroundUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        />
      ) : null}

      <div className="mt-auto">
        <p className="text-xl font-black text-carnival-ink">
          <span className="inline-flex rounded-full bg-carnival-red px-3 py-1 text-xl leading-tight text-white">
            {title}
          </span>
        </p>
        <p className="mt-2 line-clamp-3 text-base leading-5 text-white">{description}</p>
      </div>
    </Link>
  );
}
