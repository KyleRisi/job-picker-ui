'use client';

import Image from 'next/image';
import { useState } from 'react';
import { WorkspaceEditorShell } from './workspace-editor-shell';

type EpisodeStub = {
  slug: string;
  title: string;
  episodeNumber: number | null;
  seasonNumber: number | null;
  publishedAt: string;
  description: string;
  artworkUrl: string | null;
  isFeatured: boolean;
  isVisible: boolean;
  isArchived: boolean;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  noindex: boolean;
  nofollow: boolean;
};

export function WorkspaceEpisodeEditor({ episode }: { episode: EpisodeStub }) {
  const backHref = '/workspace/dashboard/episodes';

  const sidebar = (
    <div className="divide-y divide-slate-200">
      {/* URL */}
      <SidebarSection title="URL">
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 break-all">
          /episodes/<span className="font-semibold text-slate-900">{episode.slug}</span>
        </div>
      </SidebarSection>

      {/* Episode Info */}
      <SidebarSection title="Episode Info">
        <div className="space-y-3">
          {episode.seasonNumber != null && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Season</label>
              <p className="text-sm text-slate-600">{episode.seasonNumber}</p>
            </div>
          )}
          {episode.episodeNumber != null && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Episode</label>
              <p className="text-sm text-slate-600">{episode.episodeNumber}</p>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Published</label>
            <p className="text-sm text-slate-600">
              {new Date(episode.publishedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {episode.isFeatured && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold uppercase text-blue-800">Featured</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${episode.isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {episode.isVisible ? 'Visible' : 'Hidden'}
            </span>
            {episode.isArchived && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-600">Archived</span>
            )}
          </div>
          {episode.artworkUrl && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Artwork</label>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <Image
                  src={episode.artworkUrl}
                  alt=""
                  width={1200}
                  height={1200}
                  className="h-auto w-full object-cover"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>
      </SidebarSection>

      {/* SEO */}
      <SidebarSection title="SEO" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">SEO Title</label>
            <p className="text-sm text-slate-600">{episode.seoTitle || '—'}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Meta Description</label>
            <p className="text-sm text-slate-600">{episode.metaDescription || '—'}</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Canonical URL</label>
            <p className="text-sm text-slate-600 break-all">{episode.canonicalUrl || '—'}</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Noindex: {episode.noindex ? 'Yes' : 'No'}</span>
            <span>Nofollow: {episode.nofollow ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </SidebarSection>
    </div>
  );

  return (
    <WorkspaceEditorShell
      backHref={backHref}
      backLabel="Episodes"
      title={episode.title}
      sidebar={sidebar}
    >
      {/* Content editor area — placeholder for future editor */}
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="text-3xl font-bold leading-tight text-slate-900">{episode.title}</h1>

        {episode.description ? (
          <p className="mt-4 text-lg leading-relaxed text-slate-500">{episode.description}</p>
        ) : (
          <p className="mt-4 text-lg text-slate-300 italic">No description</p>
        )}

        <div className="mt-8 rounded-lg border-2 border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-400">Episode editor will be rendered here</p>
        </div>
      </div>
    </WorkspaceEditorShell>
  );
}

function SidebarSection({
  title,
  defaultOpen = true,
  children
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{title}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 8"
          className={`h-2 w-3 fill-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M1.4 0 6 4.6 10.6 0 12 1.4l-6 6-6-6z" />
        </svg>
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </div>
  );
}
