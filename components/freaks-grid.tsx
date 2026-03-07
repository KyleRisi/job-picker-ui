'use client';

import { useState } from 'react';
import Image from 'next/image';

export type FreakMember = {
  id?: string;
  name: string;
  title: string;
  imageSrc: string;
  imageAlt: string;
};

function FreakCard({ member }: { member: FreakMember }) {
  const isDataUrl = member.imageSrc.startsWith('data:image/');
  return (
    <article className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center shadow-card backdrop-blur-sm">
      <div className="mx-auto h-32 w-32 overflow-hidden rounded-full border-4 border-carnival-gold/45 bg-carnival-cream/20 shadow-lg">
        <Image
          src={member.imageSrc}
          alt={member.imageAlt}
          width={160}
          height={160}
          className="h-full w-full object-cover"
          unoptimized={isDataUrl}
        />
      </div>
      <h3 className="mt-4 text-xl font-black text-white">{member.name}</h3>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-carnival-gold/90">
        {member.title}
      </p>
    </article>
  );
}

export function FreaksGrid({ members }: { members: FreakMember[] }) {
  const batchSize = 9;
  const [visibleCount, setVisibleCount] = useState(batchSize);

  if (!members.length) {
    return (
      <p className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-5 text-sm text-white/80">
        No filled applications with photos to show yet.
      </p>
    );
  }

  const visibleMembers = members.slice(0, visibleCount);
  const hasMore = members.length > visibleCount;

  return (
    <>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleMembers.map((member) => (
          <FreakCard key={member.id || `${member.name}-${member.title}`} member={member} />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + batchSize)}
            className="inline-flex rounded-full bg-carnival-red px-6 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
          >
            More
          </button>
        </div>
      ) : null}
    </>
  );
}
