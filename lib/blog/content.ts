import { marked } from 'marked';
import {
  type BlogContentBlock,
  blogContentBlockSchema,
  blogContentDocumentSchema,
  type BlogContentDocument,
  type RichTextInlineNode,
  type RichTextMark
} from './schema';

type TocEntry = {
  id: string;
  text: string;
  level: number;
};

const WORDS_PER_MINUTE = 225;
const DEPRECATED_BLOCK_TYPES = new Set([
  'callout',
  'gallery',
  'instagram_embed',
  'join_patreon',
  'pull_quote',
  'key_takeaways',
  'cta_banner',
  'audio_embed',
  'transcript_excerpt',
  'episode_metadata_card'
]);
const DEFAULT_LISTEN_EPISODE_HEADING = 'Listen to the linked episode';

function randomId() {
  return crypto.randomUUID();
}

export function slugifyBlogText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180) || 'post';
}

export function createRichText(value = ''): RichTextInlineNode[] {
  return value ? [{ type: 'text', text: value, marks: [] }] : [];
}

export function createDefaultBlogDocument(): BlogContentDocument {
  return [
    {
      id: randomId(),
      type: 'paragraph',
      align: 'left',
      content: createRichText('')
    }
  ];
}

function isListenEpisodeBlock(block: BlogContentBlock): block is Extract<BlogContentBlock, { type: 'listen_episode' }> {
  return block.type === 'listen_episode';
}

export function hasPrimaryListenEpisodeBlock(document: BlogContentDocument) {
  return document.some((block) => isListenEpisodeBlock(block));
}

export function createPrimaryListenEpisodeBlock(episodeId?: string | null): Extract<BlogContentBlock, { type: 'listen_episode' }> {
  return {
    id: randomId(),
    type: 'listen_episode',
    episodeId: episodeId || null,
    heading: DEFAULT_LISTEN_EPISODE_HEADING,
    description: '',
    platform: 'generic'
  };
}

export function removePrimaryListenEpisodeBlocks(document: BlogContentDocument): BlogContentDocument {
  return document.filter((block) => !isListenEpisodeBlock(block));
}

export function insertPrimaryListenEpisodeBlockAtTop(
  document: BlogContentDocument,
  episodeId?: string | null
): BlogContentDocument {
  const withoutPrimary = removePrimaryListenEpisodeBlocks(document);
  return [createPrimaryListenEpisodeBlock(episodeId), ...withoutPrimary];
}

export function syncPrimaryListenEpisodeBlocksEpisode(
  document: BlogContentDocument,
  episodeId?: string | null
): BlogContentDocument {
  const normalizedEpisodeId = episodeId || null;
  return document.map((block) =>
    isListenEpisodeBlock(block)
      ? {
          ...block,
          episodeId: normalizedEpisodeId
        }
      : block
  );
}

export function normalizePrimaryListenEpisodeBlocksForSave(
  document: BlogContentDocument,
  linkedEpisodeIds: string[]
): BlogContentDocument {
  if (!linkedEpisodeIds.length) {
    return removePrimaryListenEpisodeBlocks(document);
  }

  let seenPrimary = false;
  return document.filter((block) => {
    if (!isListenEpisodeBlock(block)) return true;
    if (seenPrimary) return false;
    seenPrimary = true;
    return true;
  });
}

export function normalizeBlogDocument(input: unknown): BlogContentDocument {
  const parsed = blogContentDocumentSchema.safeParse(input);
  if (parsed.success && parsed.data.length > 0) return parsed.data;

  if (Array.isArray(input)) {
    const filtered = input
      .filter((item) => {
        const type = item && typeof item === 'object' && 'type' in item ? (item as Record<string, unknown>).type : '';
        return typeof type !== 'string' || !DEPRECATED_BLOCK_TYPES.has(type);
      })
      .map((item) => blogContentBlockSchema.safeParse(item))
      .filter((result): result is { success: true; data: BlogContentBlock } => result.success)
      .map((result) => result.data);
    if (filtered.length > 0) return filtered;
  }

  return createDefaultBlogDocument();
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

function marksToMarkdown(text: string, marks: RichTextMark[]) {
  return marks.reduce((acc, mark) => {
    if (mark.type === 'bold') return `**${acc}**`;
    if (mark.type === 'italic') return `*${acc}*`;
    if (mark.type === 'underline') return `<u>${acc}</u>`;
    if (mark.type === 'strike') return `~~${acc}~~`;
    if (mark.type === 'code') return `\`${acc}\``;
    if (mark.type === 'color') return `<span style="color:${mark.value}">${acc}</span>`;
    if (mark.type === 'font_size') return `<span style="font-size:${mark.value}">${acc}</span>`;
    if (mark.type === 'link') return `[${acc}](${mark.href})`;
    return acc;
  }, escapeMarkdown(text));
}

export function richTextToPlainText(nodes: RichTextInlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'hard_break') return '\n';
      return node.text;
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function richTextToMarkdown(nodes: RichTextInlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'hard_break') return '  \n';
      return marksToMarkdown(node.text, node.marks || []);
    })
    .join('');
}

function blockToPlainText(block: BlogContentBlock): string {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return richTextToPlainText(block.content);
    case 'list':
      return block.items.map((item) => richTextToPlainText(item.content)).join('\n');
    case 'blockquote':
      return [richTextToPlainText(block.quote), block.attribution].filter(Boolean).join('\n');
    case 'cta_button':
      return [block.label, block.note, block.href].filter(Boolean).join('\n');
    case 'image':
      return [block.alt, block.caption, block.credit].filter(Boolean).join('\n');
    case 'video_embed':
    case 'youtube_embed':
      return [block.title, block.url].filter(Boolean).join('\n');
    case 'podcast_player':
      return block.titleOverride;
    case 'table':
      return [...block.headers, ...block.rows.flat()].join(' ');
    case 'code_block':
      return block.code;
    case 'listen_episode':
      return [block.heading, block.description].filter(Boolean).join('\n');
    case 'resources':
      return [
        block.heading,
        ...block.items.map((item) => [item.label, item.description, item.href].filter(Boolean).join(' '))
      ].join('\n');
    case 'related_episodes':
    case 'related_posts':
      return block.heading;
    case 'faq':
      return [block.heading, ...block.items.map((item) => `${item.question} ${richTextToPlainText(item.answer)}`)].join('\n');
    case 'divider':
      return '';
    default:
      return '';
  }
}

export function flattenBlogDocumentToRichText(document: BlogContentDocument): RichTextInlineNode[] {
  const blocks = normalizeBlogDocument(document);
  const text = blocks
    .map((block) => blockToPlainText(block))
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!text) return createRichText('');

  const lines = text.split('\n');
  const nodes: RichTextInlineNode[] = [];
  lines.forEach((line, index) => {
    if (line) {
      nodes.push({ type: 'text', text: line, marks: [] });
    }
    if (index < lines.length - 1) {
      nodes.push({ type: 'hard_break' });
    }
  });
  return nodes;
}

function blockToMarkdown(block: BlogContentBlock): string {
  switch (block.type) {
    case 'paragraph':
      return richTextToMarkdown(block.content);
    case 'heading':
      return `${'#'.repeat(block.level)} ${richTextToMarkdown(block.content)}`;
    case 'list':
      return block.items
        .map((item, index) =>
          block.style === 'ordered'
            ? `${index + 1}. ${richTextToMarkdown(item.content)}`
            : `- ${richTextToMarkdown(item.content)}`
        )
        .join('\n');
    case 'blockquote':
      return `> ${richTextToMarkdown(block.quote)}${block.attribution ? `\n>\n> ${block.attribution}` : ''}`;
    case 'cta_button':
      return `[${block.label}](${block.href || '#'})`;
    case 'image':
      return block.assetId || block.src ? `![${block.alt}](${block.assetId || block.src})` : block.caption;
    case 'video_embed':
    case 'youtube_embed':
      return block.url;
    case 'podcast_player':
      return block.titleOverride || 'Podcast player';
    case 'table': {
      const headers = block.headers.length > 0 ? block.headers : block.rows[0] || [];
      const separator = headers.map(() => '---');
      const rows = block.rows.map((row) => `| ${row.join(' | ')} |`);
      return [`| ${headers.join(' | ')} |`, `| ${separator.join(' | ')} |`, ...rows].join('\n');
    }
    case 'divider':
      return '---';
    case 'code_block':
      return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
    case 'listen_episode':
      return `### ${block.heading}\n${block.description}`;
    case 'resources':
      return [`### ${block.heading}`, ...block.items.map((item) => `- [${item.label}](${item.href}) ${item.description}`)].join('\n');
    case 'related_episodes':
    case 'related_posts':
      return `### ${block.heading}`;
    case 'faq':
      return [`### ${block.heading}`, ...block.items.map((item) => `#### ${item.question}\n${richTextToMarkdown(item.answer)}`)].join('\n');
    default:
      return '';
  }
}

export function blogDocumentToPlainText(document: BlogContentDocument) {
  return document
    .map(blockToPlainText)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function blogDocumentToMarkdown(document: BlogContentDocument) {
  return document
    .map(blockToMarkdown)
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function markdownToBlogDocument(markdown: string): BlogContentDocument {
  const source = `${markdown || ''}`.replace(/\r\n/g, '\n').trim();
  if (!source) return createDefaultBlogDocument();

  const tokens = marked.lexer(source, {
    async: false,
    breaks: true,
    gfm: true
  }) as Array<Record<string, any>>;
  const blocks: BlogContentBlock[] = [];

  tokens.forEach((token) => {
    if (!token?.type || token.type === 'space') return;

    if (token.type === 'heading') {
      blocks.push({
        id: randomId(),
        type: 'heading',
        level: Math.min(6, Math.max(2, Number(token.depth || 2))) as 2 | 3 | 4 | 5 | 6,
        align: 'left',
        content: markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || '' }])
      });
      return;
    }

    if (token.type === 'paragraph' || token.type === 'text') {
      blocks.push({
        id: randomId(),
        type: 'paragraph',
        align: 'left',
        content: markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || token.raw || '' }])
      });
      return;
    }

    if (token.type === 'hr') {
      blocks.push({ id: randomId(), type: 'divider' });
      return;
    }

    if (token.type === 'code') {
      blocks.push({
        id: randomId(),
        type: 'code_block',
        language: `${token.lang || ''}`,
        code: `${token.text || ''}`
      });
      return;
    }

    if (token.type === 'blockquote') {
      blocks.push({
        id: randomId(),
        type: 'blockquote',
        quote: flattenMarkdownBlockTokensToRichText(token.tokens || []),
        attribution: ''
      });
      return;
    }

    if (token.type === 'list') {
      blocks.push({
        id: randomId(),
        type: 'list',
        style: token.ordered ? 'ordered' : 'bullet',
        items: (token.items || []).map((item: Record<string, any>) => ({
          id: randomId(),
          content: flattenMarkdownBlockTokensToRichText(item.tokens || [{ type: 'text', text: item.text || '' }])
        }))
      });
      return;
    }

    if (token.type === 'table') {
      blocks.push({
        id: randomId(),
        type: 'table',
        headers: (token.header || []).map((cell: Record<string, any>) =>
          richTextToPlainText(markdownTokensToRichText(cell.tokens || [{ type: 'text', text: cell.text || '' }]))
        ),
        rows: (token.rows || []).map((row: Array<Record<string, any>>) =>
          row.map((cell) =>
            richTextToPlainText(markdownTokensToRichText(cell.tokens || [{ type: 'text', text: cell.text || '' }]))
          )
        )
      });
    }
  });

  return normalizeBlogDocument(blocks);
}

function areSameMarks(left: RichTextMark[] = [], right: RichTextMark[] = []) {
  if (left.length !== right.length) return false;
  return left.every((mark, index) => JSON.stringify(mark) === JSON.stringify(right[index]));
}

function appendInlineNode(target: RichTextInlineNode[], node: RichTextInlineNode) {
  if (node.type === 'hard_break') {
    target.push(node);
    return;
  }

  const previous = target[target.length - 1];
  if (previous?.type === 'text' && areSameMarks(previous.marks, node.marks)) {
    previous.text += node.text;
    return;
  }

  target.push(node);
}

function markdownTokensToRichText(tokens: Array<Record<string, any>> = [], marks: RichTextMark[] = []): RichTextInlineNode[] {
  const nodes: RichTextInlineNode[] = [];

  tokens.forEach((token) => {
    if (!token?.type) return;

    if (token.type === 'text' || token.type === 'escape') {
      if (token.tokens?.length) {
        markdownTokensToRichText(token.tokens, marks).forEach((node) => appendInlineNode(nodes, node));
        return;
      }
      appendInlineNode(nodes, {
        type: 'text',
        text: `${token.text || token.raw || ''}`,
        marks: [...marks]
      });
      return;
    }

    if (token.type === 'strong') {
      markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || '' }], [...marks, { type: 'bold' }]).forEach((node) => appendInlineNode(nodes, node));
      return;
    }

    if (token.type === 'em') {
      markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || '' }], [...marks, { type: 'italic' }]).forEach((node) => appendInlineNode(nodes, node));
      return;
    }

    if (token.type === 'del') {
      markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || '' }], [...marks, { type: 'strike' }]).forEach((node) => appendInlineNode(nodes, node));
      return;
    }

    if (token.type === 'codespan') {
      appendInlineNode(nodes, {
        type: 'text',
        text: `${token.text || ''}`,
        marks: [...marks, { type: 'code' }]
      });
      return;
    }

    if (token.type === 'link') {
      markdownTokensToRichText(
        token.tokens || [{ type: 'text', text: token.text || token.href || '' }],
        [
          ...marks,
          {
            type: 'link',
            href: `${token.href || ''}`,
            target: `${token.href || ''}`.startsWith('/') || `${token.href || ''}`.startsWith('#') ? '_self' : '_blank'
          }
        ]
      ).forEach((node) => appendInlineNode(nodes, node));
      return;
    }

    if (token.type === 'br') {
      appendInlineNode(nodes, { type: 'hard_break' });
      return;
    }

    if (token.type === 'html') {
      const raw = `${token.raw || token.text || ''}`.trim();
      if (/^<br\s*\/?>$/i.test(raw)) {
        appendInlineNode(nodes, { type: 'hard_break' });
        return;
      }
      const stripped = raw.replace(/<[^>]+>/g, '');
      if (stripped) {
        appendInlineNode(nodes, {
          type: 'text',
          text: stripped,
          marks: [...marks]
        });
      }
      return;
    }

    if (token.tokens?.length) {
      markdownTokensToRichText(token.tokens, marks).forEach((node) => appendInlineNode(nodes, node));
    }
  });

  return nodes;
}

function flattenMarkdownBlockTokensToRichText(tokens: Array<Record<string, any>> = []) {
  const nodes: RichTextInlineNode[] = [];

  tokens.forEach((token, index) => {
    if (!token?.type || token.type === 'space') return;

    if (token.type === 'paragraph' || token.type === 'text' || token.type === 'heading') {
      markdownTokensToRichText(token.tokens || [{ type: 'text', text: token.text || token.raw || '' }]).forEach((node) => appendInlineNode(nodes, node));
    } else if (token.type === 'list') {
      (token.items || []).forEach((item: Record<string, any>, itemIndex: number) => {
        appendInlineNode(nodes, {
          type: 'text',
          text: token.ordered ? `${itemIndex + 1}. ` : '- ',
          marks: []
        });
        flattenMarkdownBlockTokensToRichText(item.tokens || [{ type: 'text', text: item.text || '' }]).forEach((node) => appendInlineNode(nodes, node));
        if (itemIndex < token.items.length - 1) {
          appendInlineNode(nodes, { type: 'hard_break' });
        }
      });
    } else if (token.type === 'code') {
      appendInlineNode(nodes, {
        type: 'text',
        text: `${token.text || ''}`,
        marks: [{ type: 'code' }]
      });
    }

    if (index < tokens.length - 1) {
      appendInlineNode(nodes, { type: 'hard_break' });
    }
  });

  return nodes;
}

export function estimateReadingTimeMinutes(document: BlogContentDocument) {
  const wordCount = blogDocumentToPlainText(document)
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

export function extractToc(document: BlogContentDocument): TocEntry[] {
  return document.flatMap((block) => {
    if (block.type !== 'heading') return [];
    const text = richTextToPlainText(block.content);
    if (!text) return [];
    return [
      {
        id: block.id,
        text,
        level: block.level
      }
    ];
  });
}

export function collectHeadingOutline(document: BlogContentDocument) {
  return extractToc(document).map((item) => ({
    id: item.id,
    text: item.text,
    level: item.level
  }));
}

export function collectReferencedImageIds(document: BlogContentDocument) {
  const ids = new Set<string>();
  document.forEach((block) => {
    if (block.type === 'image' && block.assetId) ids.add(block.assetId);
  });
  return [...ids];
}

export function generateExcerpt(document: BlogContentDocument, maxLength = 180) {
  const plain = blogDocumentToPlainText(document).replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

export function getMissingAltTextAssetIds(document: BlogContentDocument) {
  const missing: string[] = [];
  document.forEach((block) => {
    if (block.type === 'image' && block.assetId && !block.alt.trim()) missing.push(block.assetId);
  });
  return missing;
}

export function buildSeoChecklist(params: {
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  document: BlogContentDocument;
  excerpt?: string | null;
  hasAuthor?: boolean;
  hasPrimaryCategory?: boolean;
  hasLinkedEpisode?: boolean;
}) {
  const warnings: Array<{ key: string; label: string; ok: boolean }> = [];
  const title = params.seoTitle || params.title;
  const description = params.seoDescription || params.excerpt || generateExcerpt(params.document);
  const plain = blogDocumentToPlainText(params.document).toLowerCase();
  const keyword = (params.focusKeyword || '').trim().toLowerCase();
  const toc = extractToc(params.document);

  warnings.push({
    key: 'title-length',
    label: 'SEO title length is in the 30-65 character range.',
    ok: title.length >= 30 && title.length <= 65
  });
  warnings.push({
    key: 'description-length',
    label: 'Meta description length is in the 70-160 character range.',
    ok: description.length >= 70 && description.length <= 160
  });
  warnings.push({
    key: 'heading-structure',
    label: 'Post body includes at least one H2+ heading.',
    ok: toc.length > 0
  });
  warnings.push({
    key: 'focus-keyword',
    label: 'Focus keyword appears in the body content.',
    ok: keyword ? plain.includes(keyword) : false
  });
  warnings.push({
    key: 'canonical',
    label: 'Canonical URL is set or defaults to the blog permalink.',
    ok: true
  });
  warnings.push({
    key: 'alt-text',
    label: 'Inline images include alt text.',
    ok: getMissingAltTextAssetIds(params.document).length === 0
  });
  warnings.push({
    key: 'length',
    label: 'Content has enough substance to rank.',
    ok: plain.split(/\s+/).filter(Boolean).length >= 250
  });
  warnings.push({
    key: 'author',
    label: 'Post has an author selected.',
    ok: Boolean(params.hasAuthor)
  });
  warnings.push({
    key: 'primary-category',
    label: 'Post has a primary category selected.',
    ok: Boolean(params.hasPrimaryCategory)
  });
  warnings.push({
    key: 'linked-episode',
    label: 'Post has at least one linked episode.',
    ok: Boolean(params.hasLinkedEpisode)
  });

  const score = Math.round((warnings.filter((warning) => warning.ok).length / warnings.length) * 100);

  return {
    score,
    checklist: warnings,
    warnings: warnings.filter((warning) => !warning.ok).map((warning) => warning.label)
  };
}

export type BlogTiptapJSON = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: BlogTiptapJSON[];
};

function tiptapMarksToRichText(marks: BlogTiptapJSON['marks']): RichTextMark[] {
  const result: RichTextMark[] = [];
  (marks || []).forEach((mark) => {
    if (!mark?.type) return;
    if (mark.type === 'bold' || mark.type === 'italic' || mark.type === 'underline' || mark.type === 'strike' || mark.type === 'code') {
      result.push({ type: mark.type });
      return;
    }
    if (mark.type === 'textStyle') {
      if (mark.attrs?.color) {
        result.push({ type: 'color', value: `${mark.attrs.color}` });
      }
      if (mark.attrs?.fontSize) {
        result.push({ type: 'font_size', value: `${mark.attrs.fontSize}` });
      }
      return;
    }
    if (mark.type === 'link') {
      result.push({
        type: 'link',
        href: `${mark.attrs?.href || ''}`,
        target: mark.attrs?.target === '_blank' ? '_blank' : '_self',
        rel: `${mark.attrs?.rel || ''}` || undefined
      });
      return;
    }
  });
  return result;
}

function tiptapInlineToRichText(nodes: BlogTiptapJSON[] = []): RichTextInlineNode[] {
  const result: RichTextInlineNode[] = [];
  nodes.forEach((node) => {
    if (!node?.type) return;
    if (node.type === 'text') {
      result.push({
        type: 'text',
        text: node.text || '',
        marks: tiptapMarksToRichText(node.marks)
      });
      return;
    }
    if (node.type === 'hardBreak') {
      result.push({ type: 'hard_break' });
      return;
    }
    if (node.content?.length) {
      result.push(...tiptapInlineToRichText(node.content));
    }
  });
  return result;
}

export function tiptapJsonToBlocks(doc: BlogTiptapJSON | null | undefined): BlogContentDocument {
  const content = doc?.content || [];
  const blocks: BlogContentBlock[] = [];

  content.forEach((node) => {
    if (!node?.type) return;
    if (node.type === 'structuredBlock') {
      const candidate = (node.attrs && typeof node.attrs === 'object') ? (node.attrs as Record<string, unknown>).block : null;
      const parsed = blogContentDocumentSchema.safeParse([candidate]);
      if (parsed.success && parsed.data.length) {
        blocks.push(parsed.data[0]);
      }
      return;
    }
    if (node.type === 'paragraph') {
      blocks.push({
        id: randomId(),
        type: 'paragraph',
        align: (node.attrs?.textAlign as 'left' | 'center' | 'right' | undefined) || 'left',
        content: tiptapInlineToRichText(node.content)
      });
      return;
    }
    if (node.type === 'heading') {
      const level = Number(node.attrs?.level || 2);
      blocks.push({
        id: randomId(),
        type: 'heading',
        level: [2, 3, 4, 5, 6].includes(level) ? (level as 2 | 3 | 4 | 5 | 6) : 2,
        align: (node.attrs?.textAlign as 'left' | 'center' | 'right' | undefined) || 'left',
        content: tiptapInlineToRichText(node.content)
      });
      return;
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      blocks.push({
        id: randomId(),
        type: 'list',
        style: node.type === 'orderedList' ? 'ordered' : 'bullet',
        items: (node.content || []).map((item) => ({
          id: randomId(),
          content: tiptapInlineToRichText(item.content?.flatMap((child) => child.content || []) || [])
        }))
      });
      return;
    }
    if (node.type === 'blockquote') {
      blocks.push({
        id: randomId(),
        type: 'blockquote',
        quote: tiptapInlineToRichText(node.content?.flatMap((child) => child.content || []) || []),
        attribution: ''
      });
      return;
    }
    if (node.type === 'horizontalRule') {
      blocks.push({
        id: randomId(),
        type: 'divider'
      });
      return;
    }
    if (node.type === 'codeBlock') {
      blocks.push({
        id: randomId(),
        type: 'code_block',
        language: `${node.attrs?.language || ''}`,
        code: (node.content || []).map((child) => child.text || '').join('')
      });
      return;
    }
  });

  return normalizeBlogDocument(blocks);
}

export function blocksToTiptapJson(document: BlogContentDocument): BlogTiptapJSON {
  const content: BlogTiptapJSON[] = [];
  document.forEach((block) => {
    if (block.type === 'paragraph') {
      content.push({
        type: 'paragraph',
        attrs: block.align !== 'left' ? { textAlign: block.align } : undefined,
        content: richTextToTiptapInline(block.content)
      });
      return;
    }
    if (block.type === 'heading') {
      content.push({
        type: 'heading',
        attrs: {
          level: block.level,
          ...(block.align !== 'left' ? { textAlign: block.align } : {})
        },
        content: richTextToTiptapInline(block.content)
      });
      return;
    }
    if (block.type === 'list') {
      content.push({
        type: block.style === 'ordered' ? 'orderedList' : 'bulletList',
        content: block.items.map((item) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: richTextToTiptapInline(item.content)
            }
          ]
        }))
      });
      return;
    }
    if (block.type === 'blockquote') {
      content.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: richTextToTiptapInline(block.quote)
          }
        ]
      });
      return;
    }
    if (block.type === 'divider') {
      content.push({
        type: 'horizontalRule'
      });
      return;
    }
    if (block.type === 'code_block') {
      content.push({
        type: 'codeBlock',
        attrs: { language: block.language || null },
        content: [
          {
            type: 'text',
            text: block.code
          }
        ]
      });
      return;
    }

    content.push({
      type: 'structuredBlock',
      attrs: {
        block
      }
    });
  });

  return {
    type: 'doc',
    content
  };
}

function richTextToTiptapInline(nodes: RichTextInlineNode[]): BlogTiptapJSON[] {
  return nodes.flatMap((node) => {
    if (node.type === 'hard_break') {
      return [{ type: 'hardBreak' }];
    }
    const styleAttrs: Record<string, unknown> = {};
    const marks: Array<{ type: string; attrs?: Record<string, unknown> }> = [];
    (node.marks || []).forEach((mark) => {
      if (mark.type === 'color') {
        styleAttrs.color = mark.value;
        return;
      }
      if (mark.type === 'font_size') {
        styleAttrs.fontSize = mark.value;
        return;
      }
      if (mark.type === 'link') {
        marks.push({
          type: 'link',
          attrs: {
            href: mark.href,
            target: mark.target,
            rel: mark.rel
          }
        });
        return;
      }
      marks.push({ type: mark.type });
    });

    if (Object.keys(styleAttrs).length > 0) {
      marks.push({
        type: 'textStyle',
        attrs: styleAttrs
      });
    }

    return [
      {
        type: 'text',
        text: node.text,
        marks
      }
    ];
  });
}
