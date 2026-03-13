import type { RichTextInlineNode } from '@/lib/blog/schema';

function renderTranscriptInline(nodes: RichTextInlineNode[]) {
  return nodes.map((node, index) => {
    if (node.type === 'hard_break') return <br key={`br-${index}`} />;
    return <span key={`txt-${index}`}>{node.text}</span>;
  });
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
  return (
    <section className={`rounded-2xl border p-5 ${isDark ? 'border-white/20 bg-white/10' : 'border-carnival-ink/15 bg-white'}`}>
      <h3 className={`text-xl font-black ${isDark ? 'text-white' : 'text-carnival-ink'}`}>{heading || 'Episode transcript'}</h3>
      <p className={`mt-3 whitespace-pre-wrap text-base leading-7 ${isDark ? 'text-white/85' : 'text-carnival-ink/85'}`}>
        {renderTranscriptInline(content || [])}
      </p>
    </section>
  );
}
