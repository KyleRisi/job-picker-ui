'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RichTextInlineNode } from '@/lib/blog/schema';

function transcriptNodesToText(nodes: RichTextInlineNode[]) {
  return (nodes || [])
    .map((node) => (node.type === 'hard_break' ? '\n' : node.text || ''))
    .join('');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function TranscriptBlock({
  heading,
  content,
  theme = 'light'
}: {
  heading: string;
  content: RichTextInlineNode[];
  theme?: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const matchRefs = useRef<Array<HTMLElement | null>>([]);
  const transcriptText = useMemo(() => transcriptNodesToText(content || []), [content]);
  const lowerQuery = searchQuery.trim().toLowerCase();

  const escapedQuery = useMemo(() => (lowerQuery ? escapeRegExp(lowerQuery) : ''), [lowerQuery]);
  const matchRegex = useMemo(() => (escapedQuery ? new RegExp(`(${escapedQuery})`, 'ig') : null), [escapedQuery]);
  const matchCount = useMemo(() => {
    if (!matchRegex) return 0;
    const matches = transcriptText.match(matchRegex);
    return matches?.length || 0;
  }, [matchRegex, transcriptText]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [lowerQuery]);

  useEffect(() => {
    if (!matchCount) {
      setActiveMatchIndex(0);
      return;
    }
    if (activeMatchIndex >= matchCount) {
      setActiveMatchIndex(matchCount - 1);
    }
  }, [activeMatchIndex, matchCount]);

  useEffect(() => {
    if (!matchCount) return;
    const activeNode = matchRefs.current[activeMatchIndex];
    if (!activeNode) return;
    activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeMatchIndex, matchCount]);

  const goToPreviousMatch = () => {
    if (!matchCount) return;
    setActiveMatchIndex((current) => (current - 1 + matchCount) % matchCount);
  };

  const goToNextMatch = () => {
    if (!matchCount) return;
    setActiveMatchIndex((current) => (current + 1) % matchCount);
  };

  let renderMatchIndex = -1;
  matchRefs.current = [];

  return (
    <section className={`rounded-2xl border p-5 ${isDark ? 'border-white/20 bg-white/10' : 'border-carnival-ink/15 bg-white'}`}>
      <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-carnival-ink'}`}>{heading || 'Episode transcript'}</h3>
      <div className="mt-4">
        <label className={`mb-2 block text-xs font-bold uppercase tracking-[0.2em] ${isDark ? 'text-white/70' : 'text-slate-500'}`}>Search transcript</label>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && event.shiftKey) {
              event.preventDefault();
              goToPreviousMatch();
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              goToNextMatch();
            }
          }}
          placeholder="Search within this transcript"
          className={`w-full rounded-xl border px-4 py-2.5 text-base ${isDark ? 'border-white/25 bg-white/10 text-white placeholder:text-white/60' : 'border-slate-300 text-slate-600 placeholder:text-slate-400'}`}
        />
        {lowerQuery ? (
          <div className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 ${isDark ? 'border-white/20 bg-white/10' : 'border-[#ddd9cb] bg-[#f1eddd]'}`}>
            <p className={`text-sm font-semibold ${isDark ? 'text-white/85' : 'text-[#505065]'}`}>
              {matchCount > 0
                ? `${matchCount} match${matchCount === 1 ? '' : 'es'} • ${activeMatchIndex + 1} of ${matchCount}`
                : 'No matches found'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-white/25 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'}`}
                onClick={goToPreviousMatch}
                disabled={!matchCount}
              >
                Previous
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-white/25 bg-white/5 text-white hover:bg-white/10 disabled:opacity-50' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'}`}
                onClick={goToNextMatch}
                disabled={!matchCount}
              >
                Next
              </button>
              <button
                type="button"
                className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${isDark ? 'border-white/25 bg-white/5 text-white hover:bg-white/10' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                onClick={() => setSearchQuery('')}
              >
                Clear
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="mt-3 max-h-[600px] overflow-y-auto">
        <p className={`whitespace-pre-wrap text-base leading-7 ${isDark ? 'text-white/85' : 'text-carnival-ink/85'}`}>
          {matchRegex
            ? transcriptText.split(matchRegex).map((part, index) => {
                if (part === '\n') return <br key={`br-${index}`} />;
                if (!part) return null;
                const isMatch = part.toLowerCase() === lowerQuery;
                if (!isMatch) return <span key={`txt-${index}`}>{part}</span>;
                renderMatchIndex += 1;
                const matchIndex = renderMatchIndex;
                const isActive = matchIndex === activeMatchIndex;
                return (
                  <mark
                    key={`match-${index}`}
                    ref={(node) => {
                      matchRefs.current[matchIndex] = node;
                    }}
                    className={isActive
                      ? 'rounded bg-carnival-red px-0.5 text-white'
                      : 'rounded bg-carnival-gold/60 px-0.5 text-inherit'}
                  >
                    {part}
                  </mark>
                );
              })
            : transcriptText.split('\n').map((line, lineIndex, lines) => (
                <span key={`line-${lineIndex}`}>
                  {line}
                  {lineIndex < lines.length - 1 ? <br /> : null}
                </span>
              ))}
        </p>
      </div>
    </section>
  );
}
