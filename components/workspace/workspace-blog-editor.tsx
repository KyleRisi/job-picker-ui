'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type NodeViewProps
} from '@tiptap/react';
import { Extension, Node as TiptapNode } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import LinkExtension from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import {
  buildSeoChecklist,
  blogDocumentToMarkdown,
  blocksToTiptapJson,
  createPrimaryListenEpisodeBlock,
  createRichText,
  hasPrimaryListenEpisodeBlock,
  normalizeBlogDocument,
  normalizePrimaryListenEpisodeBlocksForSave,
  richTextToPlainText,
  slugifyBlogText,
  syncPrimaryListenEpisodeBlocksEpisode,
  tiptapJsonToBlocks
} from '@/lib/blog/content';
import type { BlogContentBlock } from '@/lib/blog/schema';
import { getImageBlockLayout } from '@/lib/blog/image-layout';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import { isYouTubeUrl, toYouTubeEmbedUrl } from '@/lib/blog/youtube';
import { MediaLibraryPickerModal, type MediaPickerAsset } from '@/components/blog/media-library-picker-modal';
import { EpisodeCard } from '@/components/episodes-browser';
import { EpisodeMediaPlayer } from '@/components/episode-media-player';
import { FeaturedEpisodeShowcase } from '@/components/featured-episode-showcase';
import type { PodcastEpisode } from '@/lib/podcast-shared';
import { WorkspaceEditorShell } from './workspace-editor-shell';

const FONT_SIZES = ['14px', '16px', '18px', '20px', '24px'];

type StructuredBlockOption = {
  type: BlogContentBlock['type'];
  label: string;
};

type WorkspaceEpisodeOption = {
  id: string;
  title: string;
  slug: string;
  audioUrl: string;
  artworkUrl: string | null;
  episodeNumber: number | null;
  publishedAt: string | null;
};

type WorkspacePostOption = {
  id: string;
  title: string;
};

type WorkspaceAuthorOption = {
  id: string;
  name: string;
};

type WorkspaceTermOption = {
  id: string;
  name: string;
};

function toPodcastEpisodeCard(episode: WorkspaceEpisodeOption): PodcastEpisode {
  return {
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    seasonNumber: null,
    episodeNumber: episode.episodeNumber ?? null,
    publishedAt: episode.publishedAt || '',
    description: '',
    descriptionHtml: '',
    audioUrl: episode.audioUrl,
    artworkUrl: episode.artworkUrl || null,
    duration: null,
    sourceUrl: null
  };
}

const WORKSPACE_DRAFT_STORAGE_PREFIX = 'workspace-blog-editor-draft:';
const WORKSPACE_EPISODE_DRAFT_STORAGE_PREFIX = 'workspace-episode-editor-draft:';
const MAX_MEDIA_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const IMAGE_COMPRESSION_QUALITY = 0.82;
const NON_RESIZABLE_MIME_TYPES = new Set(['image/gif', 'image/svg+xml']);

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** exponent);
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
}

function replaceFileExtension(fileName: string, extension: string) {
  const safeExtension = extension.replace(/^\.+/, '') || 'bin';
  const stem = fileName.replace(/\.[^.]+$/, '') || 'image';
  return `${stem}.${safeExtension}`;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number; image: HTMLImageElement }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to read image dimensions.'));
      img.src = objectUrl;
    });
    return { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height, image };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function prepareImageForUpload(file: File): Promise<{ file: File; notice?: string }> {
  if (!file.type?.startsWith('image/')) {
    throw new Error('Only image files are supported.');
  }
  if (!file.size) {
    throw new Error('Selected image is empty.');
  }
  if (NON_RESIZABLE_MIME_TYPES.has(file.type)) {
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
      throw new Error(`Image is too large (${formatBytes(file.size)}). Maximum upload size is ${formatBytes(MAX_MEDIA_UPLOAD_BYTES)}.`);
    }
    return { file };
  }

  let prepared = file;
  let notice = '';

  try {
    const { width, height, image } = await readImageDimensions(file);
    const largestDimension = Math.max(width, height);
    const scale = largestDimension > MAX_IMAGE_DIMENSION ? (MAX_IMAGE_DIMENSION / largestDimension) : 1;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
      const compressed = await canvasToBlob(canvas, 'image/webp', IMAGE_COMPRESSION_QUALITY);
      if (compressed && compressed.size > 0 && compressed.size < file.size) {
        prepared = new File(
          [compressed],
          replaceFileExtension(file.name, 'webp'),
          { type: compressed.type || 'image/webp' }
        );
        notice = `Image optimized (${formatBytes(file.size)} -> ${formatBytes(prepared.size)}).`;
      }
    }
  } catch {
    // If optimization fails, continue with original file and rely on server-side validation.
  }

  if (prepared.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error(`Image is too large (${formatBytes(prepared.size)}). Maximum upload size is ${formatBytes(MAX_MEDIA_UPLOAD_BYTES)}.`);
  }

  return { file: prepared, notice: notice || undefined };
}

function createStructuredBlock(type: BlogContentBlock['type']): BlogContentBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case 'cta_button':
      return { id, type, label: 'button', href: '', align: 'center', variant: 'primary', note: '' };
    case 'image':
      return { id, type, assetId: null, alt: '', caption: '', credit: '', size: 'wide' };
    case 'video_embed':
      return { id, type, url: '', title: '' };
    case 'youtube_embed':
      return { id, type, url: '', title: '', size: 'wide' };
    case 'podcast_player':
      return { id, type, episodeId: null, titleOverride: '' };
    case 'table':
      return { id, type, headers: ['Column 1', 'Column 2'], rows: [['', '']] };
    case 'listen_episode':
      return { id, type, episodeId: null, heading: 'Listen to the linked episode', description: '', platform: 'generic' };
    case 'resources':
      return { id, type, heading: 'Further resources', items: [] };
    case 'related_episodes':
      return { id, type, heading: 'Related episodes', episodeIds: [] };
    case 'related_posts':
      return { id, type, heading: 'Related posts', postIds: [] };
    case 'faq':
      return { id, type, heading: 'FAQ', items: [] };
    case 'transcript':
      return { id, type, heading: 'Episode transcript', content: [] };
    default:
      return { id, type: 'resources', heading: 'Further resources', items: [] };
  }
}

const STRUCTURED_BLOCK_OPTIONS: StructuredBlockOption[] = [
  { type: 'cta_button', label: 'CTA button' },
  { type: 'image', label: 'Image' },
  { type: 'video_embed', label: 'Video embed' },
  { type: 'youtube_embed', label: 'YouTube embed' },
  { type: 'podcast_player', label: 'Podcast player' },
  { type: 'table', label: 'Table' },
  { type: 'resources', label: 'Further resources' },
  { type: 'related_episodes', label: 'Related episodes' },
  { type: 'related_posts', label: 'Related posts' },
  { type: 'faq', label: 'FAQ' },
  { type: 'transcript', label: 'Transcript' }
];

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  },
  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
    } as any;
  }
});

const ICON = {
  code: '/blog/icons/code_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  alignCenter: '/blog/icons/format_align_center_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  alignLeft: '/blog/icons/format_align_left_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  alignRight: '/blog/icons/format_align_right_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  bold: '/blog/icons/format_bold_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  clear: '/blog/icons/format_clear_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  italic: '/blog/icons/format_italic_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  bulletedList: '/blog/icons/format_list_bulleted_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  numberedList: '/blog/icons/format_list_numbered_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  quote: '/blog/icons/format_quote_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  underlined: '/blog/icons/format_underlined_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  horizontalRule: '/blog/icons/horizontal_rule_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  link: '/blog/icons/link_2_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  redo: '/blog/icons/redo_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  undo: '/blog/icons/undo_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg'
} as const;

function Ico({ src, className = 'h-4 w-4' }: { src: string; className?: string }) {
  return <Image src={src} alt="" width={24} height={24} className={className} aria-hidden="true" unoptimized />;
}

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border text-[12px] font-semibold transition ${
        disabled
          ? 'cursor-not-allowed border-transparent text-[#a3a8c2] opacity-60'
          : active
            ? 'border-[#3558ff] bg-[#eef2ff] text-[#2643db]'
            : 'border-transparent text-[#30295c] hover:border-[#d8dced] hover:bg-[#f5f7ff]'
      }`}
    >
      {children}
    </button>
  );
}

const DEFAULT_STATE = {
  paragraph: true, h2: false, h3: false, h4: false, h5: false, h6: false,
  bold: false, italic: false, underline: false, strike: false, link: false,
  textAlign: 'left' as const, fontSize: '16px', color: '#1f1b49',
  bulletList: false, orderedList: false, blockquote: false, codeBlock: false,
  canUndo: false, canRedo: false
};

function InlineToolbar({
  editor,
  onInsertStructuredBlock
}: {
  editor: ReturnType<typeof useEditor>;
  onInsertStructuredBlock?: (type: BlogContentBlock['type']) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return DEFAULT_STATE;
      return {
        paragraph: e.isActive('paragraph'),
        h2: e.isActive('heading', { level: 2 }),
        h3: e.isActive('heading', { level: 3 }),
        h4: e.isActive('heading', { level: 4 }),
        h5: e.isActive('heading', { level: 5 }),
        h6: e.isActive('heading', { level: 6 }),
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        strike: e.isActive('strike'),
        link: e.isActive('link'),
        textAlign: e.isActive({ textAlign: 'center' }) ? 'center' as const
          : e.isActive({ textAlign: 'right' }) ? 'right' as const
          : 'left' as const,
        fontSize: e.getAttributes('textStyle').fontSize || '16px',
        color: e.getAttributes('textStyle').color || '#1f1b49',
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        blockquote: e.isActive('blockquote'),
        codeBlock: e.isActive('codeBlock'),
        canUndo: e.can().chain().focus().undo().run(),
        canRedo: e.can().chain().focus().redo().run()
      };
    }
  }) ?? DEFAULT_STATE;

  if (!editor) return null;

  const heading = state.h2 ? 'h2' : state.h3 ? 'h3' : state.h4 ? 'h4' : state.h5 ? 'h5' : state.h6 ? 'h6' : 'paragraph';

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Ico src={ICON.bold} />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Ico src={ICON.italic} />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Ico src={ICON.underlined} />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" /><path d="M4 12h16" />
        </svg>
      </ToolbarButton>

      <label
        className="ml-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-[#30295c] transition hover:border-[#d8dced] hover:bg-[#f5f7ff]"
        title="Text color"
      >
        <span className="h-4 w-4 rounded-[4px] border border-[#1f1b49]/20" style={{ backgroundColor: state.color }} />
        <input
          type="color"
          className="sr-only"
          value={state.color}
          onChange={(e) => editor.chain().focus().setColor(e.currentTarget.value).run()}
        />
      </label>

      <select
        className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[12px] font-semibold text-[#30295c] outline-none hover:border-[#d8dced] hover:bg-[#f5f7ff]"
        value={state.fontSize}
        onChange={(e) => editor.chain().focus().setMark('textStyle', { fontSize: e.currentTarget.value }).run()}
      >
        {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <Ico src={ICON.clear} />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-[#e1e5f2]" />

      <ToolbarButton label="Link" active={state.link} onClick={() => {
        const currentHref = typeof editor.getAttributes('link')?.href === 'string' ? editor.getAttributes('link').href.trim() : '';
        const href = window.prompt('Link URL', currentHref);
        if (href === null) return;
        const normalized = href.trim();
        if (!normalized) {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({
          href: normalized,
          target: normalized.startsWith('/') || normalized.startsWith('#') ? '_self' : '_blank',
          rel: 'noreferrer'
        }).run();
      }}>
        <Ico src={ICON.link} className="h-4.5 w-4.5" />
      </ToolbarButton>

      <ToolbarButton label="Align left" active={state.textAlign === 'left'} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <Ico src={ICON.alignLeft} />
      </ToolbarButton>
      <ToolbarButton label="Align center" active={state.textAlign === 'center'} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <Ico src={ICON.alignCenter} />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={state.textAlign === 'right'} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <Ico src={ICON.alignRight} />
      </ToolbarButton>

      <select
        className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[12px] font-semibold text-[#30295c] outline-none hover:border-[#d8dced] hover:bg-[#f5f7ff]"
        value={heading}
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === 'paragraph') {
            editor.chain().focus().setParagraph().run();
            return;
          }
          const level = Number(v.replace('h', '')) as 2 | 3 | 4 | 5 | 6;
          editor.chain().focus().setHeading({ level }).run();
        }}
      >
        <option value="paragraph">Paragraph</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
        <option value="h4">Heading 4</option>
        <option value="h5">Heading 5</option>
        <option value="h6">Heading 6</option>
      </select>

      <div className="mx-1 h-5 w-px bg-[#e1e5f2]" />

      <ToolbarButton label="Bullet list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <Ico src={ICON.bulletedList} className="h-4.5 w-4.5" />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <Ico src={ICON.numberedList} className="h-4.5 w-4.5" />
      </ToolbarButton>

      <ToolbarButton label="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Ico src={ICON.quote} />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Ico src={ICON.code} />
      </ToolbarButton>
      <ToolbarButton label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Ico src={ICON.horizontalRule} />
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-[#e1e5f2]" />

      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <Ico src={ICON.undo} className="h-4.5 w-4.5" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <Ico src={ICON.redo} className="h-4.5 w-4.5" />
      </ToolbarButton>

      {onInsertStructuredBlock ? (
        <select
          className="ml-1 h-7 rounded-md border border-[#dfe3ef] bg-white px-2 text-[12px] font-semibold text-[#2f295d] outline-none transition hover:bg-[#f4f6fc]"
          defaultValue=""
          onChange={(e) => {
            const type = e.currentTarget.value as BlogContentBlock['type'];
            if (!type) return;
            onInsertStructuredBlock(type);
            e.currentTarget.value = '';
          }}
          aria-label="Structured blocks"
          title="Structured blocks"
        >
          <option value="">Structured blocks</option>
          {STRUCTURED_BLOCK_OPTIONS.map((option) => (
            <option key={option.type} value={option.type}>{option.label}</option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

function toMediaPickerAsset(input: any): MediaPickerAsset | null {
  if (!input?.id || !input?.storage_path) return null;
  return {
    id: input.id,
    storage_path: input.storage_path,
    alt_text_default: input.alt_text_default || '',
    caption_default: input.caption_default || '',
    credit_source: input.credit_source || '',
    mime_type: input.mime_type || ''
  };
}

function prefillImageBlockFromAsset(
  block: Extract<BlogContentBlock, { type: 'image' }>,
  asset: MediaPickerAsset
): Extract<BlogContentBlock, { type: 'image' }> {
  return {
    ...block,
    assetId: asset.id,
    src: getStoragePublicUrl(asset.storage_path),
    alt: block.alt.trim() ? block.alt : asset.alt_text_default || '',
    caption: block.caption.trim() ? block.caption : asset.caption_default || '',
    credit: block.credit.trim() ? block.credit : asset.credit_source || ''
  };
}

function ImageBlockFields({
  block,
  onChange
}: {
  block: Extract<BlogContentBlock, { type: 'image' }>;
  onChange: (block: BlogContentBlock) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Alt text</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.alt} onChange={(e) => onChange({ ...block, alt: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Size</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.size} onChange={(e) => onChange({ ...block, size: e.currentTarget.value as 'narrow' | 'wide' | 'full' })}>
            <option value="narrow">Small</option>
            <option value="wide">Medium</option>
            <option value="full">Large</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function YouTubeBlockFields({
  block,
  onChange
}: {
  block: Extract<BlogContentBlock, { type: 'youtube_embed' }>;
  onChange: (block: BlogContentBlock) => void;
}) {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  function applyUrl(value: string, mode: 'change' | 'paste' | 'blur') {
    const nextRaw = value.trim();
    if (!nextRaw) {
      onChange({ ...block, url: '' });
      setStatus(null);
      return;
    }

    const embedUrl = toYouTubeEmbedUrl(nextRaw);
    if (embedUrl) {
      onChange({ ...block, url: embedUrl });
      if (mode === 'paste' || embedUrl !== nextRaw) {
        setStatus({ tone: 'success', text: 'YouTube URL detected and converted.' });
      } else {
        setStatus(null);
      }
      return;
    }

    onChange({ ...block, url: value });
    if (mode !== 'change' || isYouTubeUrl(nextRaw)) {
      setStatus({ tone: 'error', text: 'Couldn\'t parse a valid YouTube URL.' });
    } else {
      setStatus(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-700">YouTube URL</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={block.url}
            placeholder="https://www.youtube.com/watch?v=..."
            onChange={(e) => applyUrl(e.currentTarget.value, 'change')}
            onBlur={(e) => applyUrl(e.currentTarget.value, 'blur')}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text/plain') || '';
              const embedUrl = toYouTubeEmbedUrl(pasted);
              if (!embedUrl) return;
              e.preventDefault();
              onChange({ ...block, url: embedUrl });
              setStatus({ tone: 'success', text: 'YouTube URL detected and converted.' });
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.title || ''} onChange={(e) => onChange({ ...block, title: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Size</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.size || 'wide'} onChange={(e) => onChange({ ...block, size: e.currentTarget.value as 'narrow' | 'wide' | 'full' })}>
            <option value="narrow">Small</option>
            <option value="wide">Medium</option>
            <option value="full">Large</option>
          </select>
        </div>
      </div>
      {status ? <p className={`text-xs ${status.tone === 'success' ? 'text-[#3e7a50]' : 'text-[#9a2b2b]'}`}>{status.text}</p> : null}
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  episodes,
  posts
}: {
  block: BlogContentBlock;
  onChange: (block: BlogContentBlock) => void;
  episodes: WorkspaceEpisodeOption[];
  posts: WorkspacePostOption[];
}) {
  if (block.type === 'cta_button') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Label</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.label} onChange={(e) => onChange({ ...block, label: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Href</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.href} onChange={(e) => onChange({ ...block, href: e.currentTarget.value })} />
        </div>
      </div>
    );
  }

  if (block.type === 'image') return <ImageBlockFields block={block} onChange={onChange} />;
  if (block.type === 'youtube_embed') return <YouTubeBlockFields block={block} onChange={onChange} />;

  if (block.type === 'video_embed') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">URL</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.url} onChange={(e) => onChange({ ...block, url: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.title || ''} onChange={(e) => onChange({ ...block, title: e.currentTarget.value })} />
        </div>
      </div>
    );
  }

  if (block.type === 'podcast_player') {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Select episode</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.episodeId || ''} onChange={(e) => onChange({ ...block, episodeId: e.currentTarget.value || null })}>
            <option value="">No episode selected</option>
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.id}>{episode.title}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (block.type === 'listen_episode') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.heading || ''} onChange={(e) => onChange({ ...block, heading: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Episode</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.episodeId || ''} onChange={(e) => onChange({ ...block, episodeId: e.currentTarget.value || null })}>
            <option value="">Auto / none</option>
            {episodes.map((episode) => (
              <option key={episode.id} value={episode.id}>{episode.title}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700">CSV-like table</label>
        <textarea
          className="min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={[block.headers.join(','), ...block.rows.map((row) => row.join(','))].join('\n')}
          onChange={(e) => {
            const rows = e.currentTarget.value.split('\n');
            const headers = rows[0] ? rows[0].split(',').map((cell) => cell.trim()) : [];
            const body = rows.slice(1).filter(Boolean).map((row) => row.split(',').map((cell) => cell.trim()));
            onChange({ ...block, headers, rows: body });
          }}
        />
      </div>
    );
  }

  if (block.type === 'resources') {
    const current = block;
    function addItem() {
      onChange({ ...current, items: [...current.items, { id: crypto.randomUUID(), label: '', href: '', description: '' }] });
    }
    function removeItem(index: number) {
      onChange({ ...current, items: current.items.filter((_, i) => i !== index) });
    }
    function updateItem(index: number, field: 'label' | 'href' | 'description', value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
      onChange({ ...current, items: next });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={current.heading} onChange={(e) => onChange({ ...current, heading: e.currentTarget.value })} />
        </div>
        {current.items.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-slate-300 p-3">
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Label" value={item.label} onChange={(e) => updateItem(index, 'label', e.currentTarget.value)} />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="URL" value={item.href} onChange={(e) => updateItem(index, 'href', e.currentTarget.value)} />
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Description" value={item.description} onChange={(e) => updateItem(index, 'description', e.currentTarget.value)} />
            <button type="button" className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}
        <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs" onClick={addItem}>Add resource</button>
      </div>
    );
  }

  if (block.type === 'related_posts') {
    const current = block;
    const availablePosts = posts.filter((p) => !current.postIds.includes(p.id));
    function addPost(postId: string) {
      if (!postId || current.postIds.includes(postId)) return;
      onChange({ ...current, postIds: [...current.postIds, postId] });
    }
    function removePost(index: number) {
      onChange({ ...current, postIds: current.postIds.filter((_, i) => i !== index) });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={current.heading} onChange={(e) => onChange({ ...current, heading: e.currentTarget.value })} />
        </div>
        {current.postIds.map((postId, index) => {
          const post = posts.find((p) => p.id === postId);
          return (
            <div key={postId} className="flex items-center justify-between gap-2 rounded-md border border-slate-300 px-3 py-2">
              <p className="truncate text-sm text-slate-700">{index + 1}. {post?.title || postId}</p>
              <button type="button" className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => removePost(index)}>Remove</button>
            </div>
          );
        })}
        {availablePosts.length > 0 ? (
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" onChange={(e) => addPost(e.currentTarget.value)}>
            <option value="">+ Add a post...</option>
            {availablePosts.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  if (block.type === 'related_episodes') {
    const current = block;
    const availableEpisodes = episodes.filter((e) => !current.episodeIds.includes(e.id));
    function addEpisode(episodeId: string) {
      if (!episodeId || current.episodeIds.includes(episodeId)) return;
      onChange({ ...current, episodeIds: [...current.episodeIds, episodeId] });
    }
    function removeEpisode(index: number) {
      onChange({ ...current, episodeIds: current.episodeIds.filter((_, i) => i !== index) });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={current.heading} onChange={(e) => onChange({ ...current, heading: e.currentTarget.value })} />
        </div>
        {current.episodeIds.map((episodeId, index) => {
          const episode = episodes.find((e) => e.id === episodeId);
          return (
            <div key={episodeId} className="flex items-center justify-between gap-2 rounded-md border border-slate-300 px-3 py-2">
              <p className="truncate text-sm text-slate-700">{index + 1}. {episode?.title || episodeId}</p>
              <button type="button" className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => removeEpisode(index)}>Remove</button>
            </div>
          );
        })}
        {availableEpisodes.length > 0 ? (
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="" onChange={(e) => addEpisode(e.currentTarget.value)}>
            <option value="">+ Add an episode...</option>
            {availableEpisodes.map((e) => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  if (block.type === 'faq') {
    const current = block;
    function addItem() {
      onChange({ ...current, items: [...current.items, { id: crypto.randomUUID(), question: '', answer: [] }] });
    }
    function removeItem(index: number) {
      onChange({ ...current, items: current.items.filter((_, i) => i !== index) });
    }
    function updateQuestion(index: number, value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, question: value } : item));
      onChange({ ...current, items: next });
    }
    function updateAnswer(index: number, value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, answer: createRichText(value) } : item));
      onChange({ ...current, items: next });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={current.heading} onChange={(e) => onChange({ ...current, heading: e.currentTarget.value })} />
        </div>
        {current.items.map((item, index) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-slate-300 p-3">
            <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Question" value={item.question} onChange={(e) => updateQuestion(index, e.currentTarget.value)} />
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              rows={2}
              placeholder="Answer"
              value={richTextToPlainText(item.answer)}
              onChange={(e) => updateAnswer(index, e.currentTarget.value)}
            />
            <button type="button" className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => removeItem(index)}>Remove</button>
          </div>
        ))}
        <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs" onClick={addItem}>Add FAQ item</button>
      </div>
    );
  }

  if (block.type === 'transcript') {
    const text = richTextToPlainText(block.content);
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
          <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={block.heading} onChange={(e) => onChange({ ...block, heading: e.currentTarget.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Transcript ({count} words)</label>
          <textarea
            className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={text}
            onChange={(e) => onChange({ ...block, content: createRichText(e.currentTarget.value) })}
          />
        </div>
      </div>
    );
  }

  return <p className="text-sm text-slate-500">No settings for this block type.</p>;
}

function structuredBlockTypeLabel(type: BlogContentBlock['type']) {
  return STRUCTURED_BLOCK_OPTIONS.find((option) => option.type === type)?.label || type.replace(/_/g, ' ');
}

function structuredBlockPreviewLines(
  block: BlogContentBlock,
  episodesById: Map<string, string>,
  postsById: Map<string, string>
) {
  if (block.type === 'cta_button') return [block.label || 'CTA button', block.href || 'No destination URL yet.'];
  if (block.type === 'image') return [block.alt || 'Image block', block.assetId ? 'Image selected.' : 'No image selected.'];
  if (block.type === 'video_embed' || block.type === 'youtube_embed') return [block.title || structuredBlockTypeLabel(block.type), block.url || 'No URL yet.'];
  if (block.type === 'podcast_player') return [block.titleOverride || 'Podcast player', block.episodeId ? episodesById.get(block.episodeId) || block.episodeId : 'Auto / none'];
  if (block.type === 'table') return [`${block.headers.length} columns`, `${block.rows.length} rows`];
  if (block.type === 'listen_episode') return [block.heading || 'Listen to episode', block.episodeId ? episodesById.get(block.episodeId) || block.episodeId : 'Auto / none'];
  if (block.type === 'resources') return [block.heading || 'Further resources', `${block.items.length} resources`];
  if (block.type === 'related_episodes') return [block.heading || 'Related episodes', `${block.episodeIds.length} selected`];
  if (block.type === 'related_posts') return [block.heading || 'Related posts', `${block.postIds.length} selected`];
  if (block.type === 'faq') return [block.heading || 'FAQ', `${block.items.length} items`];
  if (block.type === 'transcript') {
    const plain = richTextToPlainText(block.content);
    const wordCount = plain ? plain.split(/\s+/).filter(Boolean).length : 0;
    return [block.heading || 'Transcript', wordCount ? `${wordCount} words` : 'No transcript content yet.'];
  }
  return ['Structured block'];
}

function StructuredBlockNodeView({
  node,
  selected,
  editor,
  getPos,
  updateAttributes,
  deleteNode,
  episodes,
  posts
}: NodeViewProps & {
  episodes: WorkspaceEpisodeOption[];
  posts: WorkspacePostOption[];
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaPickerAsset | null>(null);
  const [imageDraft, setImageDraft] = useState<Extract<BlogContentBlock, { type: 'image' }> | null>(null);
  const [ctaDraft, setCtaDraft] = useState<Extract<BlogContentBlock, { type: 'cta_button' }> | null>(null);
  const [transcriptEditing, setTranscriptEditing] = useState(true);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [youtubeStatus, setYoutubeStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [youtubeDetailsOpen, setYoutubeDetailsOpen] = useState(true);
  const [relatedPostSelection, setRelatedPostSelection] = useState('');
  const [inlineImagePickerOpen, setInlineImagePickerOpen] = useState(false);
  const [inlineImageUploadMessage, setInlineImageUploadMessage] = useState('');
  const [inlineImageUploading, setInlineImageUploading] = useState(false);
  const inlineImageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const block = node.attrs?.block as BlogContentBlock | null;
  const episodesById = useMemo(() => new Map(episodes.map((episode) => [episode.id, episode.title])), [episodes]);
  const postsById = useMemo(() => new Map(posts.map((post) => [post.id, post.title])), [posts]);

  useEffect(() => {
    const transcriptPanelOpen = block?.type === 'transcript' && transcriptEditing;
    if (!popoverOpen && !youtubeDetailsOpen && !transcriptPanelOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) return;
      if (!containerRef.current.contains(target)) {
        setPopoverOpen(false);
        setYoutubeDetailsOpen(false);
        if (block?.type === 'transcript') setTranscriptEditing(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [block, popoverOpen, transcriptEditing, youtubeDetailsOpen]);

  useEffect(() => {
    if (!block || block.type !== 'image' || !block.assetId) {
      setPreviewAsset(null);
      return;
    }
    const assetId = block.assetId;

    let active = true;
    async function loadPreviewAsset() {
      try {
        const response = await fetch(`/api/admin/blog/media/${assetId}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const asset = toMediaPickerAsset(data);
        if (asset) setPreviewAsset(asset);
      } catch {
        // Keep fallback src rendering path when metadata lookup fails.
      }
    }

    void loadPreviewAsset();
    return () => {
      active = false;
    };
  }, [block]);

  useEffect(() => {
    if (block?.type !== 'related_posts') {
      setRelatedPostSelection('');
      return;
    }
    if (relatedPostSelection && block.postIds.includes(relatedPostSelection)) {
      setRelatedPostSelection('');
    }
  }, [block, relatedPostSelection]);

  if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
    return (
      <NodeViewWrapper className="my-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
        Structured block is invalid. Remove and add it again.
      </NodeViewWrapper>
    );
  }

  const previewLines = structuredBlockPreviewLines(block, episodesById, postsById);
  const typeLabel = structuredBlockTypeLabel(block.type);

  const ensureNodeSelection = () => {
    if (typeof getPos !== 'function') return;
    const position = getPos();
    if (typeof position !== 'number') return;
    editor.commands.setNodeSelection(position);
  };
  const dragHandle = (
    <span
      data-drag-handle
      draggable="true"
      role="button"
      tabIndex={0}
      className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 cursor-grab select-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      aria-label="Drag and move block"
      title="Drag and move block"
      onMouseDown={ensureNodeSelection}
      onDragStart={(event) => {
        ensureNodeSelection();
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current">
        <circle cx="3" cy="2.25" r="1" />
        <circle cx="3" cy="6" r="1" />
        <circle cx="3" cy="9.75" r="1" />
        <circle cx="9" cy="2.25" r="1" />
        <circle cx="9" cy="6" r="1" />
        <circle cx="9" cy="9.75" r="1" />
      </svg>
    </span>
  );

  const imageUrl = block.type === 'image'
    ? (previewAsset?.storage_path ? getStoragePublicUrl(previewAsset.storage_path) : block.src || '')
    : '';

  if (block.type === 'image') {
    const imageBlock = block as Extract<BlogContentBlock, { type: 'image' }>;
    const draft = imageDraft || imageBlock;
    const imageLayout = getImageBlockLayout(imageBlock.size);
    const imageSizeClass =
      imageBlock.size === 'full'
        ? 'w-full'
        : imageBlock.size === 'narrow'
          ? 'w-1/2'
          : 'w-3/4';
    async function handleInlineImageUpload(file: File) {
      setInlineImageUploading(true);
      setInlineImageUploadMessage('');
      try {
        const prepared = await prepareImageForUpload(file);
        const formData = new FormData();
        formData.set('file', prepared.file, prepared.file.name);
        if (prepared.notice) setInlineImageUploadMessage(prepared.notice);
        const response = await fetch('/api/admin/blog/media', { method: 'POST', body: formData });
        const raw = await response.text();
        let data: any = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = {};
        }
        if (!response.ok) {
          setInlineImageUploadMessage(data?.error || raw || 'Failed to upload image.');
          return;
        }
        const uploaded = toMediaPickerAsset(data);
        if (!uploaded) {
          setInlineImageUploadMessage('Image uploaded but metadata could not be loaded.');
          return;
        }
        setPreviewAsset(uploaded);
        updateAttributes({ block: prefillImageBlockFromAsset(imageBlock, uploaded) });
        setInlineImageUploadMessage('');
      } catch (error) {
        setInlineImageUploadMessage(error instanceof Error ? error.message : 'Network error while uploading image.');
      } finally {
        setInlineImageUploading(false);
      }
    }

    function handleInlineImageLibrarySelect(asset: MediaPickerAsset) {
      setPreviewAsset(asset);
      updateAttributes({ block: prefillImageBlockFromAsset(imageBlock, asset) });
      setInlineImagePickerOpen(false);
      setInlineImageUploadMessage('');
    }

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
        >
          {dragHandle}
          <input
            ref={inlineImageUploadInputRef}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0] || null;
              e.currentTarget.value = '';
              if (!file) return;
              void handleInlineImageUpload(file);
            }}
          />
          {imageUrl ? (
            <button
              type="button"
              className="block w-full text-left"
              onMouseDown={ensureNodeSelection}
              onClick={() => {
                ensureNodeSelection();
                setImageDraft(imageBlock);
                setPopoverOpen(true);
              }}
            >
              <div className={`mx-auto ${imageSizeClass}`}>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <Image src={imageUrl} alt={imageBlock.alt || 'Image block'} width={1200} height={800} sizes={imageLayout.sizes} className="h-auto w-full object-cover" />
                </div>
              </div>
            </button>
          ) : (
            <>
              <div className="space-y-2">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-sm font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50"
                  onMouseDown={ensureNodeSelection}
                  onClick={() => inlineImageUploadInputRef.current?.click()}
                  disabled={inlineImageUploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {inlineImageUploading ? 'Uploading...' : 'Upload an image'}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-sm font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50"
                  onMouseDown={ensureNodeSelection}
                  onClick={() => setInlineImagePickerOpen(true)}
                  disabled={inlineImageUploading}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Pick from Media Library
                </button>
              </div>
              {inlineImageUploadMessage ? (
                <p className={`mt-2 text-xs ${/fail|error|unable/i.test(inlineImageUploadMessage) ? 'text-[#9a2b2b]' : 'text-[#3e7a50]'}`}>
                  {inlineImageUploadMessage}
                </p>
              ) : null}
              <MediaLibraryPickerModal
                open={inlineImagePickerOpen}
                onClose={() => setInlineImagePickerOpen(false)}
                onSelect={handleInlineImageLibrarySelect}
              />
            </>
          )}

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                    onClick={() => {
                      const cleared = { ...imageBlock, assetId: null, src: undefined };
                      setPreviewAsset(null);
                      setImageDraft(cleared);
                      updateAttributes({ block: cleared });
                      setPopoverOpen(false);
                    }}
                    disabled={!imageBlock.assetId && !imageBlock.src}
                  >
                    Remove image
                  </button>
                </div>
              </div>
              <BlockFields
                block={draft}
                onChange={(next) => {
                  const nextImage = next as Extract<BlogContentBlock, { type: 'image' }>;
                  const stabilizedNext = nextImage.src
                    ? nextImage
                    : (previewAsset?.storage_path
                        ? { ...nextImage, src: getStoragePublicUrl(previewAsset.storage_path) }
                        : nextImage);
                  setImageDraft(stabilizedNext);
                  updateAttributes({ block: stabilizedNext });
                }}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'cta_button') {
    const draft = ctaDraft || block;
    const buttonLabel = (block.label || '').trim() || 'button';
    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)]"
        >
          {dragHandle}
          <div className="flex justify-center">
            <button
              type="button"
              className="btn-primary"
              onMouseDown={ensureNodeSelection}
              onClick={() => {
                ensureNodeSelection();
                setCtaDraft(block);
                setPopoverOpen(true);
              }}
            >
              {buttonLabel}
            </button>
          </div>

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <BlockFields
                block={draft}
                onChange={(next) => {
                  setCtaDraft(next as Extract<BlogContentBlock, { type: 'cta_button' }>);
                  updateAttributes({ block: next });
                }}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'youtube_embed') {
    const youtubeBlock = block as Extract<BlogContentBlock, { type: 'youtube_embed' }>;
    const embedUrl = toYouTubeEmbedUrl(youtubeBlock.url);
    const runYoutubeSearch = () => {
      const nextRaw = (youtubeUrlInput || youtubeBlock.url || '').trim();
      if (!nextRaw) {
        setYoutubeStatus({ tone: 'error', text: 'Enter a YouTube URL first.' });
        return;
      }
      const nextEmbedUrl = toYouTubeEmbedUrl(nextRaw);
      if (!nextEmbedUrl) {
        setYoutubeStatus({ tone: 'error', text: 'Couldn\'t parse a valid YouTube URL.' });
        return;
      }
      updateAttributes({ block: { ...youtubeBlock, url: nextEmbedUrl } });
      setYoutubeUrlInput(nextEmbedUrl);
      setYoutubeStatus({ tone: 'success', text: 'YouTube URL loaded.' });
      setYoutubeDetailsOpen(true);
    };

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onMouseDown={ensureNodeSelection}
          onClick={(event) => {
            if (!embedUrl) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, textarea')) return;
            setYoutubeDetailsOpen(true);
          }}
        >
          {dragHandle}
          {embedUrl ? (
            <>
              <div
                className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2"
                onMouseDown={ensureNodeSelection}
                onClick={() => setYoutubeDetailsOpen(true)}
              >
                <div className="overflow-hidden rounded-lg bg-slate-50">
                  <iframe
                    src={embedUrl}
                    title={youtubeBlock.title || 'YouTube video'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="aspect-video w-full"
                  />
                </div>
              </div>

              {youtubeDetailsOpen ? (
                <>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrlInput || youtubeBlock.url || ''}
                      onChange={(e) => {
                        setYoutubeUrlInput(e.currentTarget.value);
                        setYoutubeStatus(null);
                      }}
                      onMouseDown={ensureNodeSelection}
                    />
                    <button
                      type="button"
                      aria-label="Load YouTube video"
                      title="Load YouTube video"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      onMouseDown={ensureNodeSelection}
                      onClick={runYoutubeSearch}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                  </div>
                  {youtubeStatus ? (
                    <p className={`mt-2 text-xs ${youtubeStatus.tone === 'success' ? 'text-[#3e7a50]' : 'text-[#9a2b2b]'}`}>
                      {youtubeStatus.text}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={youtubeBlock.title || ''}
                        onChange={(e) => updateAttributes({ block: { ...youtubeBlock, title: e.currentTarget.value } })}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">Size</label>
                      <select
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={youtubeBlock.size || 'wide'}
                        onChange={(e) => updateAttributes({ block: { ...youtubeBlock, size: e.currentTarget.value as 'narrow' | 'wide' | 'full' } })}
                      >
                        <option value="narrow">Small</option>
                        <option value="wide">Medium</option>
                        <option value="full">Large</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrlInput || youtubeBlock.url || ''}
                  onChange={(e) => {
                    setYoutubeUrlInput(e.currentTarget.value);
                    setYoutubeStatus(null);
                  }}
                  onMouseDown={ensureNodeSelection}
                />
                <button
                  type="button"
                  aria-label="Load YouTube video"
                  title="Load YouTube video"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  onMouseDown={ensureNodeSelection}
                  onClick={runYoutubeSearch}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
              </div>
              {youtubeStatus ? (
                <p className={`mt-2 text-xs ${youtubeStatus.tone === 'success' ? 'text-[#3e7a50]' : 'text-[#9a2b2b]'}`}>
                  {youtubeStatus.text}
                </p>
              ) : null}
            </>
          )}

          {youtubeDetailsOpen ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                onClick={() => deleteNode()}
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'podcast_player') {
    const podcastBlock = block as Extract<BlogContentBlock, { type: 'podcast_player' }>;
    const selectedEpisode = podcastBlock.episodeId ? episodes.find((e) => e.id === podcastBlock.episodeId) || null : null;

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            setPopoverOpen(true);
          }}
        >
          {dragHandle}
          <div
            className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2"
            onMouseDown={ensureNodeSelection}
          >
            {selectedEpisode ? (
              <EpisodeMediaPlayer
                episode={{
                  slug: selectedEpisode.slug,
                  title: selectedEpisode.title,
                  audioUrl: selectedEpisode.audioUrl,
                  artworkUrl: selectedEpisode.artworkUrl,
                  episodeNumber: selectedEpisode.episodeNumber,
                  publishedAt: selectedEpisode.publishedAt || new Date().toISOString(),
                  duration: null
                }}
              />
            ) : (
              <div className="pointer-events-none rounded-xl border border-slate-300 bg-slate-100 p-1 opacity-60 grayscale">
                <EpisodeMediaPlayer
                  episode={{
                    slug: 'no-episode-selected',
                    title: 'No episode selected',
                    audioUrl: '',
                    artworkUrl: null,
                    episodeNumber: null,
                    publishedAt: new Date().toISOString(),
                    duration: null
                  }}
                />
              </div>
            )}
          </div>

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <BlockFields
                block={podcastBlock}
                onChange={(next) => updateAttributes({ block: next })}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'listen_episode') {
    const listenEpisodeBlock = block as Extract<BlogContentBlock, { type: 'listen_episode' }>;
    const linkedEpisode = listenEpisodeBlock.episodeId
      ? episodes.find((episode) => episode.id === listenEpisodeBlock.episodeId) || null
      : null;
    const episodeCard = linkedEpisode ? toPodcastEpisodeCard(linkedEpisode) : null;

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className="relative"
          onMouseDown={ensureNodeSelection}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, textarea')) return;
            setPopoverOpen(true);
          }}
        >
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-carnival-ink">
                {listenEpisodeBlock.heading || 'Listen to the linked episode'}
              </h2>
              <span
                data-drag-handle
                draggable="true"
                role="button"
                tabIndex={0}
                className="inline-flex h-7 w-7 cursor-grab select-none items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                aria-label="Drag and move block"
                title="Drag and move block"
                onMouseDown={ensureNodeSelection}
                onDragStart={(event) => {
                  ensureNodeSelection();
                  event.dataTransfer.effectAllowed = 'move';
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current">
                  <circle cx="3" cy="2.25" r="1" />
                  <circle cx="3" cy="6" r="1" />
                  <circle cx="3" cy="9.75" r="1" />
                  <circle cx="9" cy="2.25" r="1" />
                  <circle cx="9" cy="6" r="1" />
                  <circle cx="9" cy="9.75" r="1" />
                </svg>
              </span>
            </div>
            {episodeCard ? (
              <EpisodeCard episode={episodeCard} featured />
            ) : (
              <div className="rounded-2xl border border-dashed border-carnival-ink/20 bg-white p-5 text-sm text-carnival-ink/70">
                No linked episode selected yet. Choose one in the “Episodes & Related” sidebar section.
              </div>
            )}
          </section>

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <BlockFields
                block={listenEpisodeBlock}
                onChange={(next) => updateAttributes({ block: next })}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'transcript') {
    const transcriptBlock = block as Extract<BlogContentBlock, { type: 'transcript' }>;
    const transcriptText = richTextToPlainText(transcriptBlock.content || []);
    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative overflow-hidden rounded-2xl border bg-white shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, button, a')) return;
            setTranscriptEditing(true);
          }}
        >
          {dragHandle}
          <div className="flex w-full items-center justify-between px-5 py-4 text-left" onMouseDown={ensureNodeSelection}>
            <span className="text-xl font-black leading-none text-[#231d46]">Episode transcript</span>
          </div>
          <div className="border-t border-slate-200 px-5 pb-5 pt-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Search transcript</label>
            <input
              type="text"
              placeholder="Search within this transcript"
              className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base text-slate-600 placeholder:text-slate-400"
              readOnly
              tabIndex={-1}
            />
            <textarea
              className="h-[300px] w-full rounded-xl border border-slate-300 px-4 py-3 text-lg leading-8 text-[#2f2c49]"
              placeholder="Paste transcript here..."
              value={transcriptText}
              onChange={(e) => updateAttributes({ block: { ...transcriptBlock, content: createRichText(e.currentTarget.value) } })}
            />
            {transcriptEditing ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => deleteNode()}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'related_posts') {
    const relatedPostsBlock = block as Extract<BlogContentBlock, { type: 'related_posts' }>;
    const availablePosts = posts.filter((post) => !relatedPostsBlock.postIds.includes(post.id));
    const headingText = (relatedPostsBlock.heading || '').trim() || 'Related posts';
    const selectedPosts = relatedPostsBlock.postIds
      .map((postId) => posts.find((post) => post.id === postId))
      .filter((post): post is WorkspacePostOption => Boolean(post));
    const unresolvedPostIds = relatedPostsBlock.postIds.filter((postId) => !selectedPosts.some((post) => post.id === postId));

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onMouseDown={ensureNodeSelection}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, textarea')) return;
            setPopoverOpen(true);
          }}
        >
          {dragHandle}
          {!popoverOpen ? (
            <section className="space-y-2 pr-10">
              <h3 className="text-xl font-black text-[#231d46]">{headingText}</h3>
              {relatedPostsBlock.postIds.length ? (
                <ul className="space-y-1.5 pl-4">
                  {selectedPosts.map((post) => (
                    <li key={post.id} className="flex items-baseline gap-1.5 text-[#4f567f]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 translate-y-[2px]"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span className="font-semibold">{post.title}</span>
                    </li>
                  ))}
                  {unresolvedPostIds.map((postId) => (
                    <li key={postId} className="flex items-baseline gap-1.5 text-[#4f567f]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 translate-y-[2px]"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      <span className="font-semibold">{postId}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#6f7598]">No related posts selected.</p>
              )}
            </section>
          ) : null}

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Heading</label>
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={relatedPostsBlock.heading}
                    onChange={(e) => updateAttributes({ block: { ...relatedPostsBlock, heading: e.currentTarget.value } })}
                  />
                </div>
                {relatedPostsBlock.postIds.map((postId, index) => {
                  const post = posts.find((p) => p.id === postId);
                  return (
                    <div key={postId} className="flex items-center justify-between gap-2 rounded-md border border-slate-300 px-3 py-2">
                      <p className="truncate text-sm text-slate-700">{index + 1}. {post?.title || postId}</p>
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                        onClick={() => {
                          updateAttributes({
                            block: {
                              ...relatedPostsBlock,
                              postIds: relatedPostsBlock.postIds.filter((_, i) => i !== index)
                            }
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={relatedPostSelection}
                  onChange={(e) => setRelatedPostSelection(e.currentTarget.value)}
                >
                  <option value="">Select a post...</option>
                  {availablePosts.map((post) => (
                    <option key={post.id} value={post.id}>{post.title}</option>
                  ))}
                </select>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
                    onClick={() => {
                      if (!relatedPostSelection || relatedPostsBlock.postIds.includes(relatedPostSelection)) return;
                      updateAttributes({ block: { ...relatedPostsBlock, postIds: [...relatedPostsBlock.postIds, relatedPostSelection] } });
                      setRelatedPostSelection('');
                    }}
                    disabled={!relatedPostSelection}
                  >
                    Add post
                  </button>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'resources') {
    const resourcesBlock = block as Extract<BlogContentBlock, { type: 'resources' }>;
    const headingText = (resourcesBlock.heading || '').trim() || 'Further resources';

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onMouseDown={ensureNodeSelection}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, textarea')) return;
            setPopoverOpen(true);
          }}
        >
          {dragHandle}
          {!popoverOpen ? (
            <section className="space-y-2 pr-10">
              <h3 className="text-xl font-black text-[#231d46]">{headingText}</h3>
              {resourcesBlock.items.length ? (
                <ul className="space-y-1.5 pl-4">
                  {resourcesBlock.items.map((item) => (
                    <li key={item.id} className="flex items-baseline gap-1.5 text-[#4f567f]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 translate-y-[2px]"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      <span className="font-semibold">{item.label || item.href || 'Untitled resource'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#6f7598]">No resources added yet.</p>
              )}
            </section>
          ) : null}

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <BlockFields
                block={resourcesBlock}
                onChange={(next) => updateAttributes({ block: next })}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  if (block.type === 'faq') {
    const faqBlock = block as Extract<BlogContentBlock, { type: 'faq' }>;
    const headingText = (faqBlock.heading || '').trim() || 'FAQ';

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-4 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
          onMouseDown={ensureNodeSelection}
          onClick={(event) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, input, select, textarea')) return;
            setPopoverOpen(true);
          }}
        >
          {dragHandle}
          {!popoverOpen ? (
            <section className="space-y-2 pr-10">
              <h3 className="text-xl font-black text-[#231d46]">{headingText}</h3>
              {faqBlock.items.length ? (
                <div className="space-y-1.5 pl-4">
                  {faqBlock.items.map((item) => (
                    <div key={item.id} className="flex items-baseline gap-1.5 text-[#4f567f]">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 translate-y-[2px]"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span className="font-semibold">{item.question || 'Untitled question'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#6f7598]">No FAQ items added yet.</p>
              )}
            </section>
          ) : null}

          {popoverOpen ? (
            <div className="mt-3 rounded-xl bg-white p-3">
              <BlockFields
                block={faqBlock}
                onChange={(next) => updateAttributes({ block: next })}
                episodes={episodes}
                posts={posts}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  onClick={() => {
                    deleteNode();
                    setPopoverOpen(false);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="not-prose relative my-4" contentEditable={false}>
      <div
        ref={containerRef}
        className={`relative rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
      >
        {dragHandle}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6f7598]">{typeLabel}</p>
            <p className="truncate text-[15px] font-bold text-[#231d46]">{previewLines[0] || 'Structured block'}</p>
            {previewLines[1] ? <p className="mt-0.5 line-clamp-2 text-sm text-[#6f7598]">{previewLines[1]}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-xs font-semibold text-[#4f567f] hover:bg-[#f4f6fc]"
              onMouseDown={ensureNodeSelection}
              onClick={() => setPopoverOpen((current) => !current)}
            >
              {popoverOpen ? 'Close' : 'Edit'}
            </button>
            <button
              type="button"
              className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-xs font-semibold text-[#8b3d3d]"
              onMouseDown={ensureNodeSelection}
              onClick={() => deleteNode()}
            >
              Remove
            </button>
          </div>
        </div>

        {popoverOpen ? (
          <div className="mt-3 rounded-xl border border-[#dfe3ef] bg-[#f9faff] p-3">
            <BlockFields
              block={block}
              onChange={(next) => updateAttributes({ block: next })}
              episodes={episodes}
              posts={posts}
            />
          </div>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

const StructuredBlockNode = TiptapNode.create({
  name: 'structuredBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  allowGapCursor: true,
  addOptions() {
    return {
      episodes: [] as WorkspaceEpisodeOption[],
      posts: [] as WorkspacePostOption[]
    };
  },
  addAttributes() {
    return {
      block: {
        default: null
      }
    };
  },
  parseHTML() {
    return [{ tag: 'structured-block' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['structured-block', HTMLAttributes];
  },
  addNodeView() {
    const options = this.options as {
      episodes: WorkspaceEpisodeOption[];
      posts: WorkspacePostOption[];
    };
    return ReactNodeViewRenderer((props) => (
      <StructuredBlockNodeView {...props} episodes={options.episodes} posts={options.posts} />
    ));
  }
});

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  status: string;
  excerpt: string | null;
  content_json: unknown;
  published_at: string | null;
  is_featured: boolean;
  author: { id: string; name: string } | null;
  featured_image: { id: string; url: string; alt_text: string | null } | null;
  taxonomies: { categories: { id: string; name: string }[]; tags: { id: string; name: string }[] };
  revisions: { id: string; revision_number: number; created_at: string }[];
  seo_title: string | null;
  seo_description: string | null;
  seo_score: number | null;
  focus_keyword: string | null;
  canonical_url: string | null;
  noindex: boolean;
  nofollow: boolean;
};

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

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    published: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-slate-200 text-slate-600',
    scheduled: 'bg-blue-100 text-blue-800'
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}

function SeoScoreBadge({
  score,
  advice
}: {
  score: number | null | undefined;
  advice: string[];
}) {
  const clamped = typeof score === 'number' && Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : null;

  if (clamped == null) return null;

  const toneClass =
    clamped >= 80
      ? 'bg-emerald-500'
      : clamped >= 50
        ? 'bg-amber-500'
        : 'bg-rose-500';

  return (
    <div
      className="group relative w-full"
      role="img"
      aria-label={`SEO score ${clamped}`}
      tabIndex={0}
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        SEO score
      </div>
      <div className="h-7 w-full overflow-hidden rounded-md border border-slate-300 bg-slate-100">
        <div
          className={`flex h-full items-center justify-end px-2 text-xs font-semibold text-white transition-all ${toneClass}`}
          style={{ width: `${Math.max(8, clamped)}%` }}
        >
          {clamped}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-full left-0 right-0 z-20 mb-2 hidden rounded-lg border border-slate-300 bg-white p-3 shadow-xl group-hover:block group-focus-within:block">
        {advice.length ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-800">How to improve</p>
            <p className="text-[11px] leading-4 text-slate-500">
              Complete these checks to increase your SEO score.
            </p>
            <ul className="list-disc space-y-1.5 pl-4 text-[11px] leading-4 text-slate-700">
              {advice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">All checks passing</p>
            <p className="text-[11px] leading-4 text-emerald-700">
              Great work. Your current SEO setup looks strong.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckboxDropdown({
  label,
  options,
  selectedIds,
  maxSelections,
  onToggle
}: {
  label: string;
  options: WorkspaceTermOption[];
  selectedIds: string[];
  maxSelections: number;
  onToggle: (id: string) => void;
}) {
  const selectedCount = selectedIds.length;
  const summary =
    selectedCount === 0
      ? 'None selected'
      : selectedCount === 1
        ? '1 selected'
        : `${selectedCount} selected`;

  return (
    <details className="group rounded-md border border-slate-300 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700">
        <span>{summary}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 6"
          className="h-2 w-2 fill-slate-600 transition-transform group-open:rotate-180"
        >
          <path d="M5 6L0 0h10L5 6z" />
        </svg>
      </summary>
      <div className="space-y-1 border-t border-slate-200 px-3 py-2">
        {options.length ? (
          options.map((option) => {
            const checked = selectedIds.includes(option.id);
            const disabled = !checked && selectedCount >= maxSelections;
            return (
              <label key={option.id} className={`flex items-center gap-2 text-sm ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(option.id)}
                />
                {option.name}
              </label>
            );
          })
        ) : (
          <p className="text-xs text-slate-400">No {label.toLowerCase()} available.</p>
        )}
      </div>
    </details>
  );
}

function toIsoDateTimeOrNull(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function asNullableText(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeIdArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => `${item || ''}`.trim())
    .filter(Boolean);
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num: number) => `${num}`.padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function WorkspaceBlogEditor({
  post,
  episodes,
  relatedPosts,
  authors,
  taxonomyOptions,
  mode = 'blog',
  episodeId,
  prepublishDraftControls
}: {
  post: BlogPost;
  episodes: WorkspaceEpisodeOption[];
  relatedPosts: WorkspacePostOption[];
  authors: WorkspaceAuthorOption[];
  mode?: 'blog' | 'episode' | 'episode-draft';
  episodeId?: string;
  prepublishDraftControls?: React.ReactNode;
  taxonomyOptions: {
    categories: WorkspaceTermOption[];
    series: WorkspaceTermOption[];
    topics: WorkspaceTermOption[];
    themes: WorkspaceTermOption[];
    collections: WorkspaceTermOption[];
  };
}) {
  const isEpisodeMode = mode === 'episode' || mode === 'episode-draft';
  const isEpisodeDraftMode = mode === 'episode-draft';
  const router = useRouter();
  const backHref = isEpisodeMode ? '/workspace/dashboard/episodes' : '/workspace/dashboard/blogs';
  const draftStorageKey = `${isEpisodeMode ? WORKSPACE_EPISODE_DRAFT_STORAGE_PREFIX : WORKSPACE_DRAFT_STORAGE_PREFIX}${episodeId || post.id}`;
  const postAny = post as any;
  const episodeSourceLastSyncedAt = useMemo(
    () => (isEpisodeMode ? `${postAny?.source?.last_synced_at || ''}`.trim() : ''),
    [isEpisodeMode, postAny?.source?.last_synced_at]
  );
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [slugEditorOpen, setSlugEditorOpen] = useState(false);
  const [slugDraft, setSlugDraft] = useState(post.slug || '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(postAny.featured_image_id || post.featured_image?.id || null);
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post.featured_image?.url || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState(post.featured_image?.alt_text || '');
  const [featuredImageAltSynced, setFeaturedImageAltSynced] = useState(post.featured_image?.alt_text || '');
  const [heroImagePickerOpen, setHeroImagePickerOpen] = useState(false);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const [heroImageMessage, setHeroImageMessage] = useState('');
  const [heroImageAltEditorOpen, setHeroImageAltEditorOpen] = useState(false);
  const [heroImageAltSaving, setHeroImageAltSaving] = useState(false);
  const [episodeSyncModalMode, setEpisodeSyncModalMode] = useState<null | 'full' | 'metadata'>(null);
  const [episodeSyncBusyMode, setEpisodeSyncBusyMode] = useState<null | 'full' | 'metadata'>(null);
  const [episodeSyncFeedback, setEpisodeSyncFeedback] = useState<null | { tone: 'success' | 'error'; text: string }>(null);
  const heroImageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const heroImageAltEditorRef = useRef<HTMLDivElement | null>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const excerptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'archived'>(
    (post.status as 'draft' | 'scheduled' | 'published' | 'archived') || 'draft'
  );
  const [authorId, setAuthorId] = useState(
    postAny.author_id || postAny?.editorial?.author_id || post.author?.id || authors[0]?.id || ''
  );
  const [publishAt, setPublishAt] = useState(toLocalDateTimeInput(postAny.scheduled_at || post.published_at || null));
  const [isFeatured, setIsFeatured] = useState(Boolean(post.is_featured));
  const [title, setTitle] = useState(
    `${post.title || ''}`.trim().toLowerCase() === 'untitled post' ? '' : post.title || ''
  );
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [seoTitle, setSeoTitle] = useState(post.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(post.seo_description || '');
  const [socialTitle, setSocialTitle] = useState(postAny.social_title || '');
  const [socialDescription, setSocialDescription] = useState(postAny.social_description || '');
  const [canonicalUrl, setCanonicalUrl] = useState(post.canonical_url || '');
  const [focusKeyword, setFocusKeyword] = useState(post.focus_keyword || '');
  const [ogImageId, setOgImageId] = useState(postAny.og_image_id || '');
  const [schemaType, setSchemaType] = useState(postAny.schema_type || 'BlogPosting');
  const [noindex, setNoindex] = useState(Boolean(post.noindex));
  const [nofollow, setNofollow] = useState(Boolean(post.nofollow));
  const [featuredImageStoragePath, setFeaturedImageStoragePath] = useState<string>(
    postAny?.featured_image_storage_path
      || postAny?.editorial?.hero_image_storage_path
      || ''
  );
  const [linkedEpisodeIds, setLinkedEpisodeIds] = useState<string[]>(
    Array.isArray(postAny.linked_episodes)
      ? postAny.linked_episodes
          .map((item: any) => item?.episode?.id || item?.episode_id || '')
          .filter(Boolean)
      : []
  );
  const [relatedEpisodeSearch, setRelatedEpisodeSearch] = useState('');
  const [relatedPostIds, setRelatedPostIds] = useState<string[]>(
    Array.isArray(postAny.related_override_ids) ? postAny.related_override_ids : []
  );
  const initialPrimaryTopicId = postAny?.discovery?.primaryTopicId
    || postAny?.primary_topic_id
    || postAny?.primary_category_id
    || null;
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(
    initialPrimaryTopicId
  );
  const [seriesIds, setSeriesIds] = useState<string[]>(
    isEpisodeMode
      ? []
      : Array.isArray(postAny?.discovery?.seriesIds)
        ? normalizeIdArray(postAny.discovery.seriesIds).slice(0, 1)
        : Array.isArray(postAny?.taxonomies?.series)
          ? normalizeIdArray(postAny.taxonomies.series.map((item: any) => item.id)).slice(0, 1)
          : []
  );
  const [topicIds, setTopicIds] = useState<string[]>(
    (() => {
      const rawTopicIds = Array.isArray(postAny?.discovery?.topicIds)
        ? normalizeIdArray(postAny.discovery.topicIds)
        : Array.isArray(postAny?.taxonomies?.topicClusters)
          ? normalizeIdArray(postAny.taxonomies.topicClusters.map((item: any) => item.id))
          : [];
      const dedupedTopicIds = Array.from(new Set(rawTopicIds));
      if (!isEpisodeMode) return dedupedTopicIds.slice(0, 3);
      return dedupedTopicIds.filter((id) => id !== initialPrimaryTopicId).slice(0, 1);
    })()
  );
  const [themeIds, setThemeIds] = useState<string[]>(
    isEpisodeMode
      ? []
      : Array.isArray(postAny?.discovery?.themeIds)
        ? normalizeIdArray(postAny.discovery.themeIds).slice(0, 3)
        : []
  );
  const [collectionIds, setCollectionIds] = useState<string[]>(
    Array.isArray(postAny?.discovery?.collectionIds)
      ? normalizeIdArray(postAny.discovery.collectionIds).slice(0, isEpisodeMode ? 1 : 2)
      : []
  );
  const [removedInactiveNotice, setRemovedInactiveNotice] = useState<string[]>([]);
  const draftHydratedRef = useRef(false);
  const normalizedRelatedEpisodeSearch = relatedEpisodeSearch.trim().toLowerCase();
  const selectableRelatedEpisodes = useMemo(() => {
    const blockedId = episodeId || post.id;
    const available = episodes.filter((episode) => {
      if (!episode?.id) return false;
      if (episode.id === blockedId) return false;
      if (!normalizedRelatedEpisodeSearch) return true;
      const haystack = `${episode.title} ${episode.slug}`.toLowerCase();
      return haystack.includes(normalizedRelatedEpisodeSearch);
    });
    return available.slice(0, 100);
  }, [episodeId, episodes, normalizedRelatedEpisodeSearch, post.id]);
  const taxonomyOptionById = useMemo(
    () => new Map<string, string>([
      ...taxonomyOptions.categories.map((item) => [item.id, item.name] as const),
      ...taxonomyOptions.series.map((item) => [item.id, item.name] as const),
      ...taxonomyOptions.topics.map((item) => [item.id, item.name] as const),
      ...taxonomyOptions.themes.map((item) => [item.id, item.name] as const),
      ...taxonomyOptions.collections.map((item) => [item.id, item.name] as const)
    ]),
    [taxonomyOptions]
  );
  const taxonomyIdSets = useMemo(() => ({
    categories: new Set(taxonomyOptions.categories.map((item) => item.id)),
    series: new Set(taxonomyOptions.series.map((item) => item.id)),
    topics: new Set(taxonomyOptions.topics.map((item) => item.id)),
    themes: new Set(taxonomyOptions.themes.map((item) => item.id)),
    collections: new Set(taxonomyOptions.collections.map((item) => item.id))
  }), [taxonomyOptions]);
  const [hasPrimaryListenBlockInEditor, setHasPrimaryListenBlockInEditor] = useState(false);
  const activeSlug = useMemo(() => {
    if (isEpisodeDraftMode) return '';
    if (isEpisodeMode) return post.slug;
    if (slugManuallyEdited) return slugifyBlogText(slugDraft.trim() || 'Untitled Post');
    if (post.status !== 'draft') return post.slug;
    return slugifyBlogText(title.trim() || 'Untitled Post');
  }, [isEpisodeDraftMode, isEpisodeMode, post.slug, post.status, slugDraft, slugManuallyEdited, title]);

  const initialContent = useMemo(() => {
    const doc = normalizeBlogDocument(post.content_json || []);
    return blocksToTiptapJson(doc) as any;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const structuredBlockExtension = useMemo(
    () => StructuredBlockNode.configure({ episodes, posts: relatedPosts }),
    [episodes, relatedPosts]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4, 5, 6] } }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({ openOnClick: false }),
      Underline,
      structuredBlockExtension,
      Placeholder.configure({ placeholder: 'Start writing...' })
    ],
    editorProps: {
      attributes: {
        class: 'min-h-[420px] w-full bg-transparent px-0 py-0 text-[14px] leading-6 outline-none'
      }
    },
    content: initialContent
  });

  const liveSeoDocument = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) return null;
      return tiptapJsonToBlocks(currentEditor.getJSON() as any);
    }
  }) ?? null;

  const liveSeoResult = useMemo(() => {
    if (!liveSeoDocument) {
      return {
        score: post.seo_score,
        warnings: [] as string[]
      };
    }
    return buildSeoChecklist({
      title: title.trim() || 'Untitled Post',
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      focusKeyword: focusKeyword.trim() || null,
      canonicalUrl: canonicalUrl.trim() || null,
      document: liveSeoDocument,
      excerpt: excerpt.trim() || null,
      hasAuthor: Boolean(authorId),
      hasPrimaryCategory: Boolean(primaryCategoryId),
      hasLinkedEpisode: linkedEpisodeIds.length > 0
    });
  }, [authorId, canonicalUrl, excerpt, focusKeyword, linkedEpisodeIds.length, liveSeoDocument, post.seo_score, primaryCategoryId, seoDescription, seoTitle, title]);

  useEffect(() => {
    if (!editor) return;
    let isRepairing = false;

    const ensureTrailingParagraph = () => {
      if (isRepairing) return;
      const lastNode = editor.state.doc.lastChild;
      if (lastNode?.type.name === 'paragraph') return;
      isRepairing = true;
      editor.chain().focus().insertContentAt(editor.state.doc.content.size, { type: 'paragraph' }).run();
      isRepairing = false;
    };

    ensureTrailingParagraph();
    setHasPrimaryListenBlockInEditor(hasPrimaryListenEpisodeBlock(tiptapJsonToBlocks(editor.getJSON() as any)));
    editor.on('update', ensureTrailingParagraph);
    const handlePrimaryListenDetection = () => {
      setHasPrimaryListenBlockInEditor(hasPrimaryListenEpisodeBlock(tiptapJsonToBlocks(editor.getJSON() as any)));
    };
    editor.on('update', handlePrimaryListenDetection);
    return () => {
      editor.off('update', ensureTrailingParagraph);
      editor.off('update', handlePrimaryListenDetection);
    };
  }, [editor]);

  useEffect(() => {
    draftHydratedRef.current = false;
  }, [draftStorageKey]);

  useEffect(() => {
    if (!editor) return;
    if (draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        content?: Record<string, unknown>;
        title?: string;
        excerpt?: string;
        seoTitle?: string;
        seoDescription?: string;
        socialTitle?: string;
        socialDescription?: string;
        canonicalUrl?: string;
        focusKeyword?: string;
        ogImageId?: string;
        schemaType?: string;
        noindex?: boolean;
        nofollow?: boolean;
        slugDraft?: string;
        slugManuallyEdited?: boolean;
        featuredImageId?: string | null;
        featuredImageStoragePath?: string;
        featuredImageUrl?: string;
        featuredImageAlt?: string;
        featuredImageAltSynced?: string;
        status?: 'draft' | 'scheduled' | 'published' | 'archived';
        authorId?: string;
        publishAt?: string;
        isFeatured?: boolean;
        linkedEpisodeIds?: string[];
        relatedPostIds?: string[];
        primaryCategoryId?: string | null;
        seriesIds?: string[];
        topicIds?: string[];
        themeIds?: string[];
        collectionIds?: string[];
        updatedAt?: string;
      };
      if (isEpisodeMode) {
        const sourceLastSyncedAtMs = episodeSourceLastSyncedAt ? Date.parse(episodeSourceLastSyncedAt) : Number.NaN;
        const draftUpdatedAtMs = typeof parsed?.updatedAt === 'string' ? Date.parse(parsed.updatedAt) : Number.NaN;
        const shouldDiscardStaleDraft = Number.isFinite(sourceLastSyncedAtMs) && (
          !Number.isFinite(draftUpdatedAtMs) || draftUpdatedAtMs < sourceLastSyncedAtMs
        );
        if (shouldDiscardStaleDraft) {
          try {
            window.localStorage.removeItem(draftStorageKey);
          } catch {
            // Ignore storage failures.
          }
          return;
        }
      }
      const hasAnyDraftField =
        Boolean(parsed?.content) ||
        typeof parsed?.title === 'string' ||
        typeof parsed?.excerpt === 'string' ||
        typeof parsed?.slugDraft === 'string' ||
        typeof parsed?.slugManuallyEdited === 'boolean' ||
        typeof parsed?.featuredImageId === 'string' ||
        parsed?.featuredImageId === null ||
        typeof parsed?.featuredImageStoragePath === 'string' ||
        typeof parsed?.featuredImageUrl === 'string' ||
        Array.isArray(parsed?.linkedEpisodeIds) ||
        Array.isArray(parsed?.relatedPostIds) ||
        typeof parsed?.primaryCategoryId === 'string' ||
        parsed?.primaryCategoryId === null ||
        Array.isArray(parsed?.seriesIds) ||
        Array.isArray(parsed?.topicIds) ||
        Array.isArray(parsed?.themeIds) ||
        Array.isArray(parsed?.collectionIds);
      if (!hasAnyDraftField) return;

      if (parsed?.content) {
        editor.commands.setContent(parsed.content as any, false);
      }
      if (typeof parsed.title === 'string') setTitle(parsed.title);
      if (typeof parsed.excerpt === 'string') setExcerpt(parsed.excerpt);
      if (typeof parsed.slugDraft === 'string') setSlugDraft(parsed.slugDraft);
      if (typeof parsed.slugManuallyEdited === 'boolean') setSlugManuallyEdited(parsed.slugManuallyEdited);
      if (typeof parsed.featuredImageId === 'string' || parsed.featuredImageId === null) setFeaturedImageId(parsed.featuredImageId || null);
      if (typeof parsed.featuredImageStoragePath === 'string') setFeaturedImageStoragePath(parsed.featuredImageStoragePath);
      if (typeof parsed.featuredImageUrl === 'string') setFeaturedImageUrl(parsed.featuredImageUrl);
      if (typeof parsed.featuredImageAlt === 'string') setFeaturedImageAlt(parsed.featuredImageAlt);
      if (typeof parsed.featuredImageAltSynced === 'string') setFeaturedImageAltSynced(parsed.featuredImageAltSynced);
      if (typeof parsed.seoTitle === 'string') setSeoTitle(parsed.seoTitle);
      if (typeof parsed.seoDescription === 'string') setSeoDescription(parsed.seoDescription);
      if (typeof parsed.socialTitle === 'string') setSocialTitle(parsed.socialTitle);
      if (typeof parsed.socialDescription === 'string') setSocialDescription(parsed.socialDescription);
      if (typeof parsed.canonicalUrl === 'string') setCanonicalUrl(parsed.canonicalUrl);
      if (typeof parsed.focusKeyword === 'string') setFocusKeyword(parsed.focusKeyword);
      if (typeof parsed.ogImageId === 'string') setOgImageId(parsed.ogImageId);
      if (typeof parsed.schemaType === 'string') setSchemaType(parsed.schemaType);
      if (typeof parsed.noindex === 'boolean') setNoindex(parsed.noindex);
      if (typeof parsed.nofollow === 'boolean') setNofollow(parsed.nofollow);
      if (parsed.status === 'draft' || parsed.status === 'scheduled' || parsed.status === 'published' || parsed.status === 'archived') setStatus(parsed.status);
      if (typeof parsed.authorId === 'string') setAuthorId(parsed.authorId);
      if (typeof parsed.publishAt === 'string') setPublishAt(parsed.publishAt);
      if (typeof parsed.isFeatured === 'boolean') setIsFeatured(parsed.isFeatured);
      if (Array.isArray(parsed.linkedEpisodeIds)) setLinkedEpisodeIds(parsed.linkedEpisodeIds.filter(Boolean));
      if (Array.isArray(parsed.relatedPostIds)) setRelatedPostIds(parsed.relatedPostIds.filter(Boolean));
      if (typeof parsed.primaryCategoryId === 'string' || parsed.primaryCategoryId === null) setPrimaryCategoryId(parsed.primaryCategoryId || null);
      if (Array.isArray(parsed.seriesIds) && !isEpisodeMode) setSeriesIds(parsed.seriesIds.filter(Boolean).slice(0, 1));
      if (Array.isArray(parsed.topicIds)) {
        const parsedPrimaryTopicId = typeof parsed.primaryCategoryId === 'string' ? parsed.primaryCategoryId : null;
        const deduped = Array.from(new Set(parsed.topicIds.filter(Boolean))).filter((id) => id !== parsedPrimaryTopicId);
        setTopicIds(deduped.slice(0, isEpisodeMode ? 1 : 3));
      }
      if (Array.isArray(parsed.themeIds) && !isEpisodeMode) setThemeIds(parsed.themeIds.filter(Boolean).slice(0, 3));
      if (Array.isArray(parsed.collectionIds)) {
        const deduped = Array.from(new Set(parsed.collectionIds.filter(Boolean)));
        setCollectionIds(deduped.slice(0, isEpisodeMode ? 1 : 2));
      }
      setIsDirty(true);
    } catch {
      // Ignore malformed or unavailable local draft data.
    }
  }, [draftStorageKey, editor, episodeSourceLastSyncedAt, isEpisodeMode]);

  useEffect(() => {
    const removed: string[] = [];
    const sanitizeList = (current: string[], allowed: Set<string>, apply: (next: string[]) => void) => {
      const next = current.filter((id) => allowed.has(id));
      if (next.length !== current.length) {
        current
          .filter((id) => !allowed.has(id))
          .forEach((id) => removed.push(taxonomyOptionById.get(id) || id));
        apply(next);
      }
    };

    if (primaryCategoryId && !taxonomyIdSets.categories.has(primaryCategoryId)) {
      removed.push(taxonomyOptionById.get(primaryCategoryId) || primaryCategoryId);
      setPrimaryCategoryId(null);
    }
    sanitizeList(seriesIds, taxonomyIdSets.series, setSeriesIds);
    sanitizeList(topicIds, taxonomyIdSets.topics, setTopicIds);
    sanitizeList(themeIds, taxonomyIdSets.themes, setThemeIds);
    sanitizeList(collectionIds, taxonomyIdSets.collections, setCollectionIds);

    if (removed.length) {
      setRemovedInactiveNotice((current) => {
        const next = Array.from(new Set([...current, ...removed]));
        if (next.length === current.length && next.every((value, index) => value === current[index])) {
          return current;
        }
        return next;
      });
    }
  }, [
    collectionIds,
    primaryCategoryId,
    seriesIds,
    taxonomyIdSets,
    taxonomyOptionById,
    themeIds,
    topicIds
  ]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setIsDirty(true);
      try {
        window.localStorage.setItem(
          draftStorageKey,
          JSON.stringify({
            content: editor.getJSON(),
            title,
            excerpt,
            seoTitle,
            seoDescription,
            socialTitle,
            socialDescription,
            canonicalUrl,
            focusKeyword,
            ogImageId,
            schemaType,
            noindex,
            nofollow,
            slugDraft,
            slugManuallyEdited,
            featuredImageId,
            featuredImageStoragePath,
            featuredImageUrl,
            featuredImageAlt,
            featuredImageAltSynced,
            status,
            authorId,
            publishAt,
            isFeatured,
            linkedEpisodeIds,
            relatedPostIds,
            primaryCategoryId,
            seriesIds,
            topicIds,
            themeIds,
            collectionIds,
            updatedAt: new Date().toISOString()
          })
        );
      } catch {
        // Ignore storage write failures (quota/private mode).
      }
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [authorId, canonicalUrl, collectionIds, draftStorageKey, editor, excerpt, featuredImageAlt, featuredImageAltSynced, featuredImageId, featuredImageStoragePath, featuredImageUrl, focusKeyword, isFeatured, linkedEpisodeIds, nofollow, noindex, ogImageId, primaryCategoryId, publishAt, relatedPostIds, schemaType, seoDescription, seoTitle, seriesIds, slugDraft, slugManuallyEdited, socialDescription, socialTitle, status, themeIds, title, topicIds]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          ...parsed,
          title,
          excerpt,
          seoTitle,
          seoDescription,
          socialTitle,
          socialDescription,
          canonicalUrl,
          focusKeyword,
          ogImageId,
          schemaType,
          noindex,
          nofollow,
          slugDraft,
          slugManuallyEdited,
          featuredImageId,
          featuredImageStoragePath,
          featuredImageUrl,
          featuredImageAlt,
          featuredImageAltSynced,
          status,
          authorId,
          publishAt,
          isFeatured,
          linkedEpisodeIds,
          relatedPostIds,
          primaryCategoryId,
          seriesIds,
          topicIds,
          themeIds,
          collectionIds,
          updatedAt: new Date().toISOString()
        })
      );
    } catch {
      // Ignore storage write failures (quota/private mode).
    }
  }, [authorId, canonicalUrl, collectionIds, draftStorageKey, excerpt, featuredImageAlt, featuredImageAltSynced, featuredImageId, featuredImageStoragePath, featuredImageUrl, focusKeyword, isFeatured, linkedEpisodeIds, nofollow, noindex, ogImageId, primaryCategoryId, publishAt, relatedPostIds, schemaType, seoDescription, seoTitle, seriesIds, slugDraft, slugManuallyEdited, socialDescription, socialTitle, status, themeIds, title, topicIds]);

  useEffect(() => {
    if (!featuredImageId) {
      // Keep URL-based hero images (for example RSS artwork) even when no media asset id exists.
      setFeaturedImageStoragePath('');
      return;
    }
    if (featuredImageUrl) return;
    let active = true;
    async function loadFeaturedImage() {
      try {
        const response = await fetch(`/api/admin/blog/media/${featuredImageId}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        const asset = toMediaPickerAsset(data);
        if (!active || !asset?.storage_path) return;
        setFeaturedImageUrl(getStoragePublicUrl(asset.storage_path));
        setFeaturedImageStoragePath(asset.storage_path);
        if (!featuredImageAlt) {
          setFeaturedImageAlt(asset.alt_text_default || '');
          setFeaturedImageAltSynced(asset.alt_text_default || '');
        }
      } catch {
        // keep existing fallback
      }
    }
    void loadFeaturedImage();
    return () => {
      active = false;
    };
  }, [featuredImageAlt, featuredImageId, featuredImageUrl]);

  useEffect(() => {
    if (!heroImageAltEditorOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!heroImageAltEditorRef.current || !target) return;
      if (!heroImageAltEditorRef.current.contains(target)) {
        setHeroImageAltEditorOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [heroImageAltEditorOpen]);

  useEffect(() => {
    const target = titleTextareaRef.current;
    if (!target) return;
    target.style.height = '0px';
    target.style.height = `${target.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    const target = excerptTextareaRef.current;
    if (!target) return;
    target.style.height = '0px';
    target.style.height = `${target.scrollHeight}px`;
  }, [excerpt]);

  const publishAtIso = useMemo(() => {
    if (!publishAt) return null;
    const date = new Date(publishAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }, [publishAt]);

  const temporalStatus = useMemo<'draft' | 'scheduled' | 'published'>(() => {
    if (!publishAtIso) return 'draft';
    const publishMs = new Date(publishAtIso).getTime();
    return publishMs > Date.now() ? 'scheduled' : 'published';
  }, [publishAtIso]);

  const episodePublishedAtDisplay = useMemo(
    () => toLocalDateTimeInput(post.published_at || null),
    [post.published_at]
  );

  const effectiveStatus = useMemo<'draft' | 'scheduled' | 'published' | 'archived'>(() => {
    if (status === 'archived') return 'archived';
    if (status === 'draft') return 'draft';
    return temporalStatus;
  }, [status, temporalStatus]);

  function insertStructuredBlock(type: BlogContentBlock['type']) {
    if (!editor) return;
    const block = createStructuredBlock(type);
    const selection = editor.state.selection;
    const chain = editor.chain().focus();

    if (selection instanceof NodeSelection && selection.node.type.name === 'structuredBlock') {
      chain.insertContentAt(selection.to, { type: 'structuredBlock', attrs: { block } });
    } else if (selection) {
      chain.insertContentAt({ from: selection.from, to: selection.to }, { type: 'structuredBlock', attrs: { block } });
    } else {
      chain.insertContent({ type: 'structuredBlock', attrs: { block } });
    }

    chain.run();
  }

  function toggleIdWithMax(current: string[], id: string, max: number) {
    if (!id) return current;
    if (current.includes(id)) {
      return current.filter((item) => item !== id);
    }
    if (current.length >= max) return current;
    return [...current, id];
  }
  const payloadPrimaryTopicId = primaryCategoryId && taxonomyIdSets.categories.has(primaryCategoryId)
    ? primaryCategoryId
    : null;
  const payloadSeriesIds = seriesIds.filter((id) => taxonomyIdSets.series.has(id));
  const payloadTopicIds = topicIds.filter((id) => taxonomyIdSets.topics.has(id));
  const payloadThemeIds = themeIds.filter((id) => taxonomyIdSets.themes.has(id));
  const payloadCollectionIds = collectionIds.filter((id) => taxonomyIdSets.collections.has(id));

  function buildPostPayload(
    currentContentJson: ReturnType<typeof tiptapJsonToBlocks>,
    overrides?: Partial<{ status: 'draft' | 'scheduled' | 'published' | 'archived' }>
  ) {
    const legacyPrimaryCategoryId = postAny.primary_category_id || post.taxonomies.categories[0]?.id || null;
    const legacyCategoryIds = Array.from(new Set((post.taxonomies.categories || []).map((category) => category.id)));
    const legacyTagIds = Array.from(new Set((post.taxonomies.tags || []).map((tag) => tag.id)));
    const normalizedTopicIds = Array.from(new Set(payloadTopicIds.filter(Boolean))).slice(0, 3);
    const baseDiscovery = postAny.discovery || {};
    const normalizedLinkedEpisodeIds = linkedEpisodeIds.filter(Boolean);
    const syncedContent = normalizePrimaryListenEpisodeBlocksForSave(
      syncPrimaryListenEpisodeBlocksEpisode(currentContentJson, normalizedLinkedEpisodeIds[0] || null),
      normalizedLinkedEpisodeIds
    );

    const statusBase = overrides?.status || status;
    const nextEffectiveStatus: 'draft' | 'scheduled' | 'published' | 'archived' =
      statusBase === 'archived'
        ? 'archived'
        : statusBase === 'draft'
          ? 'draft'
          : temporalStatus;

    return {
      title: title.trim() || 'Untitled Post',
      slug: activeSlug,
      status: nextEffectiveStatus,
      excerpt: excerpt.trim() || null,
      contentJson: syncedContent,
      featuredImageId,
      authorId: authorId || postAny.author_id || post.author?.id || '',
      publishedAt: nextEffectiveStatus === 'published' ? publishAtIso : null,
      scheduledAt: nextEffectiveStatus === 'scheduled' ? publishAtIso : null,
      archivedAt: nextEffectiveStatus === 'archived' ? toIsoDateTimeOrNull(postAny.archived_at) || new Date().toISOString() : null,
      isFeatured,
      // Keep legacy blog category separate from discovery primary topic.
      // Workspace taxonomy selector sets discovery topics, which are validated/saved under `discovery.primaryTopicId`.
      primaryCategoryId: legacyPrimaryCategoryId,
      taxonomy: {
        categoryIds: legacyCategoryIds,
        tagIds: legacyTagIds,
        seriesIds: payloadSeriesIds,
        topicClusterIds: [],
        labelIds: Array.isArray(postAny?.taxonomies?.labels) ? postAny.taxonomies.labels.map((item: any) => item.id) : []
      },
      discovery: {
        primaryTopicId: payloadPrimaryTopicId,
        topicIds: normalizedTopicIds,
        themeIds: payloadThemeIds,
        entityIds: Array.isArray(baseDiscovery.entityIds) ? baseDiscovery.entityIds : [],
        caseIds: Array.isArray(baseDiscovery.caseIds) ? baseDiscovery.caseIds : [],
        eventIds: Array.isArray(baseDiscovery.eventIds) ? baseDiscovery.eventIds : [],
        collectionIds: payloadCollectionIds,
        seriesIds: payloadSeriesIds
      },
      linkedEpisodes: normalizedLinkedEpisodeIds.map((episodeId, index) => ({
        episodeId,
        sortOrder: index,
        isPrimary: index === 0
      })),
      relatedPostIds,
      seo: {
        seoTitle: seoTitle.trim() || null,
        seoDescription: seoDescription.trim() || null,
        socialTitle: socialTitle.trim() || null,
        socialDescription: socialDescription.trim() || null,
        canonicalUrl: canonicalUrl.trim() || null,
        noindex,
        nofollow,
        focusKeyword: focusKeyword.trim() || null,
        schemaType: schemaType || 'BlogPosting',
        ogImageId: ogImageId.trim() || null
      },
      revisionReason: ''
    };
  }

  async function buildEpisodePayload(currentContentJson: ReturnType<typeof tiptapJsonToBlocks>) {
    const normalizedSecondaryTopicIds = Array.from(new Set(payloadTopicIds.filter(Boolean)))
      .filter((id) => id !== (payloadPrimaryTopicId || ''))
      .slice(0, 1);
    const normalizedCollectionIds = Array.from(new Set(payloadCollectionIds.filter(Boolean))).slice(0, 1);
    const baseDiscovery = postAny.discovery || {};
    const normalizedRelatedEpisodeIds = linkedEpisodeIds.filter((id) => id && id !== (episodeId || post.id));
    const normalizedBody = normalizeBlogDocument(currentContentJson);
    const bodyMarkdown = blogDocumentToMarkdown(normalizedBody) || null;

    const isEpisodeArchived = status === 'archived';
    const isEpisodeVisible = status === 'published' || status === 'scheduled';
    const heroStoragePath = featuredImageStoragePath || null;

    return {
      authorId: authorId || null,
      webTitle: title.trim() || null,
      webSlug: isEpisodeDraftMode ? null : (activeSlug || null),
      excerpt: excerpt.trim() || null,
      bodyJson: normalizedBody,
      bodyMarkdown,
      heroImageUrl: featuredImageUrl || null,
      heroImageStoragePath: heroStoragePath,
      seoTitle: seoTitle.trim() || null,
      metaDescription: seoDescription.trim() || null,
      focusKeyword: focusKeyword.trim() || null,
      canonicalUrlOverride: canonicalUrl.trim() || null,
      socialTitle: socialTitle.trim() || null,
      socialDescription: socialDescription.trim() || null,
      socialImageUrl: ogImageId.trim() || null,
      noindex,
      nofollow,
      isFeatured,
      isVisible: isEpisodeVisible,
      isArchived: isEpisodeArchived,
      editorialNotes: asNullableText(postAny?.editorial?.editorial_notes) || null,
      discovery: {
        primaryTopicId: payloadPrimaryTopicId,
        topicIds: normalizedSecondaryTopicIds,
        themeIds: Array.isArray(baseDiscovery.themeIds) ? baseDiscovery.themeIds : [],
        entityIds: Array.isArray(baseDiscovery.entityIds) ? baseDiscovery.entityIds : [],
        caseIds: Array.isArray(baseDiscovery.caseIds) ? baseDiscovery.caseIds : [],
        eventIds: Array.isArray(baseDiscovery.eventIds) ? baseDiscovery.eventIds : [],
        collectionIds: normalizedCollectionIds,
        seriesIds: payloadSeriesIds
      },
      relatedEpisodes: normalizedRelatedEpisodeIds.map((relatedEpisodeId, index) => ({
        episodeId: relatedEpisodeId,
        relationshipType: 'related',
        sortOrder: index
      })),
      relatedPosts: relatedPostIds.map((postId, index) => ({
        postId,
        sortOrder: index
      })),
      changeSummary: null
    };
  }

  async function buildPayload(
    currentContentJson: ReturnType<typeof tiptapJsonToBlocks>,
    overrides?: Partial<{ status: 'draft' | 'scheduled' | 'published' | 'archived' }>
  ) {
    if (isEpisodeMode) return buildEpisodePayload(currentContentJson);
    return buildPostPayload(currentContentJson, overrides);
  }

  function getEpisodeTaxonomyValidationError(): string | null {
    if (!isEpisodeMode) return null;
    if (!primaryCategoryId) return 'Episodes must have exactly one primary topic before saving.';
    if (Array.from(new Set(topicIds.filter(Boolean).filter((id) => id !== primaryCategoryId))).length > 1) {
      return 'Episodes can only have one secondary topic.';
    }
    if (Array.from(new Set(collectionIds.filter(Boolean))).length > 1) {
      return 'Episodes can only have one collection.';
    }
    return null;
  }

  async function persist() {
    if (!editor || saving || !isDirty) return;
    const taxonomyError = getEpisodeTaxonomyValidationError();
    if (taxonomyError) {
      window.alert(taxonomyError);
      return;
    }
    setSaving(true);
    try {
      const payload = await buildPayload(tiptapJsonToBlocks(editor.getJSON() as any));
      const endpoint = isEpisodeMode
        ? (isEpisodeDraftMode
          ? `/api/admin/blog/episodes/prepublish-drafts/${episodeId || post.id}`
          : `/api/admin/blog/episodes/${episodeId || post.id}`)
        : `/api/admin/blog/posts/${post.id}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save post.');
      }
      setIsDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save post.';
      window.alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function publishPost() {
    if (!editor || saving) return;
    const taxonomyError = getEpisodeTaxonomyValidationError();
    if (taxonomyError) {
      window.alert(taxonomyError);
      return;
    }
    setSaving(true);
    try {
      const payload = await buildPayload(tiptapJsonToBlocks(editor.getJSON() as any), { status: 'published' });
      const endpoint = isEpisodeMode
        ? (isEpisodeDraftMode
          ? `/api/admin/blog/episodes/prepublish-drafts/${episodeId || post.id}`
          : `/api/admin/blog/episodes/${episodeId || post.id}`)
        : `/api/admin/blog/posts/${post.id}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to publish post.');
      }
      setStatus(isEpisodeMode ? (status === 'archived' ? 'archived' : 'published') : (publishAtIso && new Date(publishAtIso).getTime() > Date.now() ? 'scheduled' : 'published'));
      setIsDirty(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to publish post.';
      window.alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePost() {
    if (isEpisodeMode || deletingPost || saving) return;
    setDeletingPost(true);
    try {
      const response = await fetch(`/api/admin/blog/posts/${post.id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete post.');
      }
      try {
        window.localStorage.removeItem(draftStorageKey);
      } catch {
        // Ignore storage failures.
      }
      router.push('/workspace/dashboard/blogs');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete post.';
      window.alert(message);
    } finally {
      setDeletingPost(false);
    }
  }

  async function openPreview() {
    if (!editor || previewBusy) return;
    if (isEpisodeMode) {
      if (isEpisodeDraftMode) {
        window.alert('Prepublish drafts are private until attached to a live RSS episode.');
        return;
      }
      if (isDirty) {
        await persist();
      }
      const base = window.location.origin.replace(/\/+$/, '');
      window.open(`${base}/episodes/${activeSlug}`, '_blank', 'noopener,noreferrer');
      return;
    }
    setPreviewBusy(true);
    try {
      const payload = await buildPayload(tiptapJsonToBlocks(editor.getJSON() as any));

      const autosaveResponse = await fetch(`/api/admin/blog/posts/${post.id}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!autosaveResponse.ok) {
        const data = await autosaveResponse.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to build preview.');
      }

      window.open(`/api/admin/blog/posts/${post.id}/preview`, '_blank', 'noopener,noreferrer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to build preview.';
      window.alert(message);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function confirmEpisodeSync() {
    if (!isEpisodeMode || isEpisodeDraftMode || !episodeSyncModalMode || episodeSyncBusyMode) return;
    const syncMode = episodeSyncModalMode;
    setEpisodeSyncBusyMode(syncMode);
    setEpisodeSyncFeedback(null);
    try {
      const endpoint = syncMode === 'full'
        ? `/api/admin/blog/episodes/${episodeId || post.id}/reset-from-rss`
        : `/api/admin/blog/episodes/${episodeId || post.id}/sync`;
      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Episode sync failed.');
      }

      if (syncMode === 'full') {
        try {
          window.localStorage.removeItem(draftStorageKey);
        } catch {
          // Ignore storage failures.
        }
      }

      setEpisodeSyncFeedback({
        tone: 'success',
        text: syncMode === 'full'
          ? 'Episode re-sync complete. Reloading...'
          : 'Episode metadata sync complete. Reloading...'
      });
      setEpisodeSyncModalMode(null);
      router.refresh();
      window.setTimeout(() => {
        window.location.reload();
      }, 450);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Episode sync failed.';
      setEpisodeSyncFeedback({ tone: 'error', text: message });
    } finally {
      setEpisodeSyncBusyMode(null);
    }
  }

  async function handleHeroImageUpload(file: File) {
    setHeroImageUploading(true);
    setHeroImageMessage('');
    try {
      const prepared = await prepareImageForUpload(file);
      const formData = new FormData();
      formData.set('file', prepared.file, prepared.file.name);
      if (prepared.notice) setHeroImageMessage(prepared.notice);
      const response = await fetch('/api/admin/blog/media', { method: 'POST', body: formData });
      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }
      if (!response.ok) {
        setHeroImageMessage(data?.error || raw || 'Failed to upload image.');
        return;
      }
      const asset = toMediaPickerAsset(data);
      if (!asset) {
        setHeroImageMessage('Image uploaded but metadata could not be loaded.');
        return;
      }
      setFeaturedImageId(asset.id);
      setFeaturedImageUrl(getStoragePublicUrl(asset.storage_path));
      setFeaturedImageStoragePath(asset.storage_path);
      setFeaturedImageAlt(asset.alt_text_default || '');
      setFeaturedImageAltSynced(asset.alt_text_default || '');
      setHeroImageMessage('');
      setIsDirty(true);
    } catch (error) {
      setHeroImageMessage(error instanceof Error ? error.message : 'Network error while uploading image.');
    } finally {
      setHeroImageUploading(false);
    }
  }

  function handleHeroImageLibrarySelect(asset: MediaPickerAsset) {
    setFeaturedImageId(asset.id);
    setFeaturedImageUrl(getStoragePublicUrl(asset.storage_path));
    setFeaturedImageStoragePath(asset.storage_path);
    setFeaturedImageAlt(asset.alt_text_default || '');
    setFeaturedImageAltSynced(asset.alt_text_default || '');
    setHeroImagePickerOpen(false);
    setHeroImageMessage('');
    setIsDirty(true);
  }

  async function persistHeroImageAlt() {
    if (!featuredImageId || heroImageAltSaving) return;
    const nextAlt = featuredImageAlt.trim();
    if (nextAlt === featuredImageAltSynced.trim()) return;
    setHeroImageAltSaving(true);
    try {
      const response = await fetch(`/api/admin/blog/media/${featuredImageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt_text_default: nextAlt })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHeroImageMessage(data?.error || 'Failed to update image alt text.');
        return;
      }
      const updatedAsset = toMediaPickerAsset(data);
      const updatedAlt = updatedAsset?.alt_text_default ?? nextAlt;
      setFeaturedImageAlt(updatedAlt);
      setFeaturedImageAltSynced(updatedAlt);
      setHeroImageMessage('Image alt text saved.');
      window.setTimeout(() => setHeroImageMessage(''), 1600);
    } catch {
      setHeroImageMessage('Failed to update image alt text.');
    } finally {
      setHeroImageAltSaving(false);
    }
  }

  function insertPrimaryListenEpisodeAtCursor() {
    if (!editor || !linkedEpisodeIds.length || hasPrimaryListenBlockInEditor) return;
    const block = createPrimaryListenEpisodeBlock(linkedEpisodeIds[0]);
    editor.chain().focus().insertContent({ type: 'structuredBlock', attrs: { block } }).run();
    setHasPrimaryListenBlockInEditor(true);
    setIsDirty(true);
  }

  function moveItem<T>(items: T[], index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return items;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    return next;
  }

  const sidebar = (
    <div className="divide-y divide-slate-200">
      <SidebarSection title="URL">
        <div className="space-y-2">
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            {slugEditorOpen && !isEpisodeMode ? (
              <div className="flex items-center gap-1">
                <span>{isEpisodeMode ? '/episodes/' : '/blog/'}</span>
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 font-semibold text-slate-900 outline-none"
                  value={slugDraft}
                  onChange={(event) => setSlugDraft(event.currentTarget.value)}
                  placeholder={isEpisodeMode ? 'episode-slug' : 'post-slug'}
                />
              </div>
            ) : (
              <p className="break-all">
                {isEpisodeMode ? '/episodes/' : '/blog/'}<span className="font-semibold text-slate-900">{activeSlug || (isEpisodeDraftMode ? '<assigned-on-attach>' : '')}</span>
              </p>
            )}
          </div>
          {isEpisodeMode ? (
            <p className="text-xs text-slate-500">
              {isEpisodeDraftMode
                ? 'Episode URL slug is assigned from the live RSS episode when this draft is attached.'
                : 'Episode URL slugs are locked and can’t be edited here.'}
            </p>
          ) : !slugEditorOpen ? (
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSlugDraft(activeSlug);
                setSlugEditorOpen(true);
              }}
            >
              Edit slug
            </button>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setSlugDraft(activeSlug);
                  setSlugEditorOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                onClick={() => {
                  const normalized = slugifyBlogText(slugDraft.trim() || 'Untitled Post');
                  setSlugDraft(normalized);
                  setSlugManuallyEdited(true);
                  setSlugEditorOpen(false);
                  setIsDirty(true);
                }}
              >
                Save slug
              </button>
            </div>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title={isEpisodeMode ? 'Episode Settings' : 'Post Settings'}>
        <div className="space-y-3">
          {isEpisodeMode ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Date</label>
              <input
                className="w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                type="datetime-local"
                value={episodePublishedAtDisplay}
                readOnly
                disabled
              />
              <p className="mt-1 text-xs text-slate-500">Pulled from RSS feed.</p>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
            <div className="flex items-center gap-2">
              <StatusPill status={effectiveStatus} />
            </div>
          </div>
          <div className="space-y-3">
            {!isEpisodeMode ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Author</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={authorId}
                  onChange={(event) => {
                    setAuthorId(event.currentTarget.value);
                    setIsDirty(true);
                  }}
                >
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>{author.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Status</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={status === 'scheduled' ? 'published' : status}
                onChange={(event) => {
                  setStatus(event.currentTarget.value as 'draft' | 'published' | 'archived');
                  setIsDirty(true);
                }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
              {status !== 'draft' && temporalStatus === 'scheduled' ? (
                <p className="mt-1 text-xs text-slate-500">With this date, status will publish as scheduled.</p>
              ) : null}
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(event) => {
                  setIsFeatured(event.currentTarget.checked);
                  setIsDirty(true);
                }}
              />
              {isEpisodeMode ? 'Featured episode' : 'Featured post'}
            </label>
            {isEpisodeMode ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Author</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={authorId}
                  onChange={(event) => {
                    setAuthorId(event.currentTarget.value);
                    setIsDirty(true);
                  }}
                >
                  <option value="">No author</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>{author.name}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {!isEpisodeMode ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Date</label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={publishAt}
                  onChange={(event) => {
                    setPublishAt(event.currentTarget.value);
                    if (status === 'archived') setStatus('published');
                    setIsDirty(true);
                  }}
                />
              </div>
            ) : null}
          </div>
          {!isEpisodeMode ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={saving || deletingPost}
                onClick={() => void publishPost()}
              >
                {saving ? 'Saving...' : effectiveStatus === 'scheduled' ? 'Schedule' : 'Publish'}
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                disabled={saving || deletingPost}
                onClick={() => void deletePost()}
              >
                {deletingPost ? 'Deleting...' : 'Delete Post'}
              </button>
            </div>
          ) : null}
        </div>
      </SidebarSection>

      {prepublishDraftControls ? (
        <SidebarSection title="Prepublish Draft" defaultOpen={false}>
          {prepublishDraftControls}
        </SidebarSection>
      ) : null}

      <SidebarSection title="Taxonomy" defaultOpen={false}>
        <div className="space-y-3">
          {removedInactiveNotice.length ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
              Removed inactive taxonomy terms from editor state: {removedInactiveNotice.join(', ')}.
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Primary topic</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={primaryCategoryId || ''}
              onChange={(event) => {
                const value = event.currentTarget.value || null;
                setPrimaryCategoryId(value);
                if (value && topicIds.includes(value)) {
                  setTopicIds((current) => current.filter((id) => id !== value));
                }
                setIsDirty(true);
              }}
            >
              <option value="">Select primary topic</option>
              {taxonomyOptions.categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          {isEpisodeMode ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Secondary topic (optional, max 1)</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={topicIds[0] || ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setTopicIds(value ? [value] : []);
                    setIsDirty(true);
                  }}
                >
                  <option value="">None</option>
                  {taxonomyOptions.topics
                    .filter((topic) => !primaryCategoryId || topic.id !== primaryCategoryId)
                    .map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Collection (optional, max 1)</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={collectionIds[0] || ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setCollectionIds(value ? [value] : []);
                    setIsDirty(true);
                  }}
                >
                  <option value="">None</option>
                  {taxonomyOptions.collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>{collection.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                Episodes require exactly one primary topic, with at most one secondary topic and one collection.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Series (max 1)</label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={seriesIds[0] || ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setSeriesIds(value ? [value] : []);
                    setIsDirty(true);
                  }}
                >
                  <option value="">None</option>
                  {taxonomyOptions.series.map((series) => (
                    <option key={series.id} value={series.id}>{series.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Topics (max 3)</label>
                <CheckboxDropdown
                  label="Topics"
                  options={taxonomyOptions.topics}
                  selectedIds={topicIds}
                  maxSelections={3}
                  onToggle={(topicId) => {
                    setTopicIds(toggleIdWithMax(topicIds, topicId, 3));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Themes (max 3)</label>
                <CheckboxDropdown
                  label="Themes"
                  options={taxonomyOptions.themes}
                  selectedIds={themeIds}
                  maxSelections={3}
                  onToggle={(themeId) => {
                    setThemeIds(toggleIdWithMax(themeIds, themeId, 3));
                    setIsDirty(true);
                  }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Collections (max 2)</label>
                <CheckboxDropdown
                  label="Collections"
                  options={taxonomyOptions.collections}
                  selectedIds={collectionIds}
                  maxSelections={2}
                  onToggle={(collectionId) => {
                    setCollectionIds(toggleIdWithMax(collectionIds, collectionId, 2));
                    setIsDirty(true);
                  }}
                />
              </div>
            </>
          )}
        </div>
      </SidebarSection>

      <SidebarSection title="Episodes & Related" defaultOpen={false}>
        <div className="space-y-4">
          {!isEpisodeMode ? (
            <div className="space-y-2 rounded-xl border border-[#dfe3ef] bg-white p-2.5">
              <button
                type="button"
                className="rounded-md border border-[#dfe3ef] bg-[#f7f9ff] px-3 py-1.5 text-xs font-semibold text-[#2f295d] disabled:cursor-not-allowed disabled:opacity-50"
                onClick={insertPrimaryListenEpisodeAtCursor}
                disabled={!linkedEpisodeIds.length || hasPrimaryListenBlockInEditor}
              >
                Insert primary episode card
              </button>
              <p className="text-xs text-[#6f7598]">
                Linked episodes do not render a primary card unless you insert one.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#72789b]">
              {isEpisodeMode ? 'Related episode IDs' : 'Linked episode IDs'}
            </label>
            <details className="group rounded-md border border-slate-300 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm text-slate-700">
                <span>Select episodes</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 10 6"
                  className="h-2 w-2 fill-slate-600 transition-transform group-open:rotate-180"
                >
                  <path d="M5 6L0 0h10L5 6z" />
                </svg>
              </summary>
              <div className="space-y-2 border-t border-slate-200 px-3 py-2">
                <input
                  value={relatedEpisodeSearch}
                  onChange={(event) => setRelatedEpisodeSearch(event.currentTarget.value)}
                  placeholder="Search episodes by title or slug"
                  className="w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
                />
                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200">
                  {selectableRelatedEpisodes.length ? (
                    selectableRelatedEpisodes.map((episode) => (
                      <button
                        key={episode.id}
                        type="button"
                        className={`flex w-full items-center gap-2 border-b px-2.5 py-2 text-left text-sm last:border-b-0 ${
                          linkedEpisodeIds.includes(episode.id)
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
                            : 'border-slate-100 text-slate-700 hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          if (linkedEpisodeIds.includes(episode.id)) return;
                          setLinkedEpisodeIds((current) => [...current, episode.id]);
                          setRelatedEpisodeSearch('');
                          setIsDirty(true);
                        }}
                      >
                        <span className={`shrink-0 text-xs font-semibold ${linkedEpisodeIds.includes(episode.id) ? 'text-emerald-700' : 'text-transparent'}`}>
                          ✓
                        </span>
                        <span className="truncate">{episode.title}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-2.5 py-2 text-xs text-slate-500">No episodes match your search.</p>
                  )}
                </div>
              </div>
            </details>

            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#72789b]">
              {isEpisodeMode ? 'Selected related episodes (save order)' : 'Selected episodes (save order)'}
            </p>
            {linkedEpisodeIds.length ? (
              <div className="space-y-2">
                {linkedEpisodeIds.map((episodeId, index) => {
                  const episode = episodes.find((item) => item.id === episodeId);
                  return (
                    <div key={episodeId} className="rounded-xl border border-[#dfe3ef] bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#273058]">{index + 1}. {episode?.title || episodeId}</p>
                          {index === 0 ? <p className="text-xs text-[#6f7598]">Primary episode</p> : null}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            onClick={() => {
                              setLinkedEpisodeIds((current) => moveItem(current, index, 'up'));
                              setIsDirty(true);
                            }}
                            disabled={index === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            onClick={() => {
                              setLinkedEpisodeIds((current) => moveItem(current, index, 'down'));
                              setIsDirty(true);
                            }}
                            disabled={index === linkedEpisodeIds.length - 1}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                            onClick={() => {
                              setLinkedEpisodeIds((current) => current.filter((_, itemIndex) => itemIndex !== index));
                              setIsDirty(true);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No linked episodes selected.</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-[#72789b]">Manual related post IDs</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value=""
              onChange={(event) => {
                const postId = event.currentTarget.value;
                if (!postId || relatedPostIds.includes(postId)) return;
                setRelatedPostIds((current) => [...current, postId]);
                setIsDirty(true);
              }}
            >
              <option value="">Select posts</option>
              {relatedPosts.map((relatedPost) => (
                <option key={relatedPost.id} value={relatedPost.id}>
                  {relatedPost.title}
                </option>
              ))}
            </select>

            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#72789b]">Selected posts (save order)</p>
            {relatedPostIds.length ? (
              <div className="space-y-2">
                {relatedPostIds.map((postId, index) => {
                  const relatedPost = relatedPosts.find((item) => item.id === postId);
                  return (
                    <div key={postId} className="rounded-xl border border-[#dfe3ef] bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold text-[#273058]">{index + 1}. {relatedPost?.title || postId}</p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            onClick={() => {
                              setRelatedPostIds((current) => moveItem(current, index, 'up'));
                              setIsDirty(true);
                            }}
                            disabled={index === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                            onClick={() => {
                              setRelatedPostIds((current) => moveItem(current, index, 'down'));
                              setIsDirty(true);
                            }}
                            disabled={index === relatedPostIds.length - 1}
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                            onClick={() => {
                              setRelatedPostIds((current) => current.filter((_, itemIndex) => itemIndex !== index));
                              setIsDirty(true);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No manual related posts selected.</p>
            )}
          </div>
        </div>
      </SidebarSection>

      <SidebarSection title="SEO" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <SeoScoreBadge score={liveSeoResult.score} advice={liveSeoResult.warnings} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">SEO Title</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={seoTitle}
              onChange={(event) => {
                setSeoTitle(event.currentTarget.value);
                setIsDirty(true);
              }}
              placeholder="SEO title"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">SEO Description</label>
            <textarea
              className="min-h-[72px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={seoDescription}
              onChange={(event) => {
                setSeoDescription(event.currentTarget.value);
                setIsDirty(true);
              }}
              placeholder="SEO meta description"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Focus Keyword</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={focusKeyword}
              onChange={(event) => {
                setFocusKeyword(event.currentTarget.value);
                setIsDirty(true);
              }}
              placeholder="Focus keyword"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">Canonical URL</label>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={canonicalUrl}
              onChange={(event) => {
                setCanonicalUrl(event.currentTarget.value);
                setIsDirty(true);
              }}
              placeholder={isEpisodeMode ? '/episodes/your-slug' : '/blog/your-slug'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={noindex}
                onChange={(event) => {
                  setNoindex(event.currentTarget.checked);
                  setIsDirty(true);
                }}
              />
              Noindex
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={nofollow}
                onChange={(event) => {
                  setNofollow(event.currentTarget.checked);
                  setIsDirty(true);
                }}
              />
              Nofollow
            </label>
          </div>
        </div>
      </SidebarSection>

      {isEpisodeMode && !isEpisodeDraftMode ? (
        <SidebarSection title="Sync Episode" defaultOpen={false}>
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Run RSS sync actions for this episode. These actions can overwrite source values.
            </p>
            <button
              type="button"
              className="w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setEpisodeSyncModalMode('full')}
              disabled={Boolean(episodeSyncBusyMode)}
            >
              Full Re-sync from RSS
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setEpisodeSyncModalMode('metadata')}
              disabled={Boolean(episodeSyncBusyMode)}
            >
              Sync Metadata Only
            </button>
            {episodeSyncFeedback ? (
              <p className={`text-xs ${episodeSyncFeedback.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
                {episodeSyncFeedback.text}
              </p>
            ) : null}
          </div>
        </SidebarSection>
      ) : null}

      <SidebarSection title="Revisions" defaultOpen={false}>
      {post.revisions.length > 0 ? (
          <ul className="space-y-2">
            {post.revisions.map((rev) => (
              <li key={rev.id} className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-slate-700">Rev #{rev.revision_number}</span>
                <span className="text-slate-400">{new Date(rev.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">No revisions yet.</p>
        )}
      </SidebarSection>
    </div>
  );

  const heroImageFrameClasses = isEpisodeMode
    ? 'mx-auto relative aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50'
    : 'relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50';

  const heroImageClasses = isEpisodeMode ? 'h-full w-full object-cover' : 'h-auto w-full object-cover';

  return (
    <>
      <WorkspaceEditorShell
      backHref={backHref}
      backLabel="back"
      sidebar={sidebar}
      toolbar={<InlineToolbar editor={editor} onInsertStructuredBlock={insertStructuredBlock} />}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void openPreview()}
            disabled={previewBusy || isEpisodeDraftMode}
          >
            {isEpisodeDraftMode ? 'Private Draft' : (previewBusy ? 'Building…' : 'View')}
          </button>
          <button
            type="button"
            className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-medium ${
              isDirty || saving
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => void persist()}
            disabled={saving || !isDirty}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      }
    >
      <div
        className="blog-editor-preview mx-auto max-w-[860px] px-8 py-10"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('.ProseMirror')) return;
          if (target?.closest('input, textarea, select, button')) return;
          e.preventDefault();
          editor?.chain().focus('end').run();
        }}
      >
        <input
          ref={heroImageUploadInputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.currentTarget.files?.[0] || null;
            e.currentTarget.value = '';
            if (!file) return;
            void handleHeroImageUpload(file);
          }}
        />
        {featuredImageUrl ? (
          <div className="mb-6">
            <div className={heroImageFrameClasses} ref={heroImageAltEditorRef}>
              <Image
                src={featuredImageUrl}
                alt={featuredImageAlt || 'Hero image'}
                width={1720}
                height={1720}
                className={heroImageClasses}
                unoptimized={isEpisodeMode}
              />
              <button
                type="button"
                className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                aria-label="Remove hero image"
                title="Remove hero image"
                onClick={() => {
                  setFeaturedImageId(null);
                  setFeaturedImageUrl('');
                  setFeaturedImageStoragePath('');
                  setFeaturedImageAlt('');
                  setFeaturedImageAltSynced('');
                  setHeroImageAltEditorOpen(false);
                  setIsDirty(true);
                }}
              >
                x
              </button>
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setHeroImageAltEditorOpen((current) => !current)}
                >
                  Edit
                </button>
                {heroImageAltEditorOpen ? (
                  <div className="absolute bottom-full right-0 z-20 mb-1 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <label className="mb-1 block text-xs font-medium text-slate-700">Alt text</label>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={featuredImageAlt}
                      onChange={(event) => {
                        setFeaturedImageAlt(event.currentTarget.value);
                        setIsDirty(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void persistHeroImageAlt();
                        }
                      }}
                      placeholder="Describe this image"
                    />
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void persistHeroImageAlt()}
                        disabled={heroImageAltSaving || featuredImageAlt.trim() === featuredImageAltSynced.trim()}
                      >
                        {heroImageAltSaving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <div
              className={
                isEpisodeMode
                  ? 'mx-auto flex aspect-square w-full max-w-[420px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5'
                  : 'space-y-2'
              }
            >
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-sm font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50 ${isEpisodeMode ? 'w-full max-w-[280px]' : 'w-full'}`}
                onClick={() => heroImageUploadInputRef.current?.click()}
                disabled={heroImageUploading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {heroImageUploading ? 'Uploading...' : 'Upload an image'}
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-4 py-5 text-sm font-semibold text-[#6f7598] transition hover:border-[#bfc7de] hover:text-[#4f5bd5] disabled:opacity-50 ${isEpisodeMode ? 'w-full max-w-[280px]' : 'w-full'}`}
                onClick={() => setHeroImagePickerOpen(true)}
                disabled={heroImageUploading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Pick from Media Library
              </button>
            </div>
            {heroImageMessage ? (
              <p className={`text-xs ${/fail|error|unable/i.test(heroImageMessage) ? 'text-[#9a2b2b]' : 'text-[#3e7a50]'}`}>
                {heroImageMessage}
              </p>
            ) : null}
          </div>
        )}
        <MediaLibraryPickerModal
          open={heroImagePickerOpen}
          onClose={() => setHeroImagePickerOpen(false)}
          onSelect={handleHeroImageLibrarySelect}
        />

        <textarea
          ref={titleTextareaRef}
          className={`w-full resize-none overflow-hidden border-0 bg-transparent px-0 text-[2.15rem] font-black tracking-tight leading-tight outline-none placeholder:text-[#a6acbe] md:text-[2.4rem] ${
            title.trim() ? 'text-[#231d46]' : 'text-[#9ca3b7]'
          }`}
          placeholder={isEpisodeMode ? 'Untitled Episode' : 'Untitled Post'}
          value={title}
          rows={1}
          onInput={(event) => {
            const target = event.currentTarget;
            target.style.height = '0px';
            target.style.height = `${target.scrollHeight}px`;
          }}
          onChange={(event) => {
            setTitle(event.currentTarget.value);
            setIsDirty(true);
          }}
        />

        <div className="relative mt-4 mb-6 flex flex-wrap items-start gap-3 text-[12px] text-[#6a7094]">
          <textarea
            ref={excerptTextareaRef}
            className="min-h-[3rem] min-w-[180px] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[13px] leading-6 text-[#656d8f] outline-none placeholder:text-[#9ea7c0]"
            placeholder={isEpisodeMode ? 'Episode excerpt' : 'Post excerpt'}
            value={excerpt}
            rows={1}
            onInput={(event) => {
              const target = event.currentTarget;
              target.style.height = '0px';
              target.style.height = `${target.scrollHeight}px`;
            }}
            onChange={(event) => {
              setExcerpt(event.currentTarget.value);
              setIsDirty(true);
            }}
          />
        </div>

        <EditorContent editor={editor} />
      </div>
      </WorkspaceEditorShell>
      {isEpisodeMode && !isEpisodeDraftMode && episodeSyncModalMode ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {episodeSyncModalMode === 'full' ? 'Re-sync Episode from RSS' : 'Sync Episode Metadata'}
              </h3>
              <p className="text-sm text-slate-700">
                {episodeSyncModalMode === 'full'
                  ? 'This will replace source episode data from RSS and clear editorial overrides so the page falls back to RSS/source values.'
                  : 'This will update source metadata only and keep editorial content untouched.'}
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">What changes</p>
                {episodeSyncModalMode === 'full' ? (
                  <p className="mt-1 text-sm text-slate-700">
                    Editorial title, excerpt, body, SEO, hero, and social overrides are cleared. Source episode values are refreshed from RSS.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-700">
                    Only <code>published_at</code>, <code>audio_url</code>, <code>artwork_url</code>, and <code>last_synced_at</code> are updated from RSS.
                  </p>
                )}
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">What does not change</p>
                <p className="mt-1 text-sm text-emerald-800">
                  Taxonomy and author assignments are preserved.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => setEpisodeSyncModalMode(null)}
                  disabled={Boolean(episodeSyncBusyMode)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                    episodeSyncModalMode === 'full' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  onClick={() => void confirmEpisodeSync()}
                  disabled={Boolean(episodeSyncBusyMode)}
                >
                  {episodeSyncBusyMode ? 'Syncing...' : 'Confirm Sync'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
