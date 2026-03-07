'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState, type NodeViewProps } from '@tiptap/react';
import { Extension, Node as TiptapNode } from '@tiptap/core';
import { marked } from 'marked';
import StarterKit from '@tiptap/starter-kit';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import { EpisodeCard } from '@/components/episodes-browser';
import { FeaturedEpisodeShowcase } from '@/components/featured-episode-showcase';
import { getImageBlockLayout } from '@/lib/blog/image-layout';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import { isYouTubeUrl, toYouTubeEmbedUrl } from '@/lib/blog/youtube';
import {
  blocksToTiptapJson,
  createPrimaryListenEpisodeBlock,
  createRichText,
  hasPrimaryListenEpisodeBlock,
  normalizeBlogDocument,
  normalizePrimaryListenEpisodeBlocksForSave,
  removePrimaryListenEpisodeBlocks,
  syncPrimaryListenEpisodeBlocksEpisode,
  tiptapJsonToBlocks
} from '@/lib/blog/content';
import type { BlogContentBlock, BlogPostWriteInput } from '@/lib/blog/schema';
import type { PodcastEpisode } from '@/lib/podcast-shared';
import { MediaLibraryPickerModal, type MediaPickerAsset } from './media-library-picker-modal';
import { ImageAssetPicker } from './image-asset-picker';

const FONT_SIZES = ['14px', '16px', '18px', '20px', '24px'];
type MediaOption = MediaPickerAsset;
type SelectOption = {
  id: string;
  label: string;
};
type AdminEpisodeOption = {
  id: string;
  title: string;
  slug: string;
  publishedAt: string | null;
  descriptionPlain: string;
  descriptionHtml: string;
  audioUrl: string;
  artworkUrl: string | null;
};
type StructuredBlockOption = {
  type: BlogContentBlock['type'];
  label: string;
};

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

function createBlock(type: BlogContentBlock['type']): BlogContentBlock {
  const id = crypto.randomUUID();
  switch (type) {
    case 'cta_button':
      return { id, type, label: 'Learn more', href: '', align: 'center', variant: 'primary', note: '' };
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
  { type: 'faq', label: 'FAQ' }
];

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPodcastEpisodeCard(episode: AdminEpisodeOption): PodcastEpisode {
  return {
    id: episode.id,
    slug: episode.slug,
    title: episode.title,
    seasonNumber: null,
    episodeNumber: null,
    publishedAt: episode.publishedAt || '',
    description: episode.descriptionPlain || '',
    descriptionHtml: episode.descriptionHtml || '',
    audioUrl: episode.audioUrl || '',
    artworkUrl: episode.artworkUrl || null,
    duration: null,
    sourceUrl: null
  };
}

function toLocalDateTimeInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeSlugInput(value: string) {
  return value
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCanonicalOrigin(input: string) {
  const value = input.trim();
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function deriveInitialPostStatus(initialPost: any): BlogPostWriteInput['status'] {
  if (initialPost.status === 'archived') return 'archived';
  const now = Date.now();

  const scheduled = initialPost.scheduled_at ? new Date(initialPost.scheduled_at).getTime() : Number.NaN;
  if (Number.isFinite(scheduled) && scheduled > now) return 'scheduled';

  const published = initialPost.published_at ? new Date(initialPost.published_at).getTime() : Number.NaN;
  if (Number.isFinite(published) && published <= now) return 'published';

  if (initialPost.status === 'published' || initialPost.status === 'scheduled') {
    return initialPost.status;
  }

  return 'draft';
}

function plainTextToTiptapContent(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [{ type: 'paragraph' }];

  return normalized.split(/\n{2,}/).map((paragraph) => ({
    type: 'paragraph',
    content: paragraph.split('\n').flatMap((line, index) => {
      const nodes: Array<Record<string, unknown>> = [];
      if (index > 0) nodes.push({ type: 'hardBreak' });
      if (line.length > 0) {
        nodes.push({ type: 'text', text: line });
      }
      return nodes;
    })
  }));
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function looksLikeMarkdown(value: string) {
  return /(^|\n)(#{1,6}\s|[-*]\s|\d+\.\s|>\s|```|---$|\*\*|__|\[[^\]]+\]\([^)]+\)|`[^`]+`)/m.test(value);
}

function sanitizePastedHtml(html: string) {
  if (typeof window === 'undefined') return '';

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const allowedTags = new Set([
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'blockquote', 'pre', 'code', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'
  ]);

  const safeHref = (href: string) => /^(https?:|mailto:|\/|#)/i.test(href);

  const sanitizeNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ? document.createTextNode(node.textContent) : null;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const normalizedTag = tagName === 'h1' ? 'h2' : tagName;

    if (!allowedTags.has(tagName)) {
      const fragment = document.createDocumentFragment();
      Array.from(element.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeNode(child);
        if (sanitizedChild) fragment.appendChild(sanitizedChild);
      });
      return fragment;
    }

    const clean = document.createElement(normalizedTag);

    if (normalizedTag === 'a') {
      const href = element.getAttribute('href') || '';
      if (href && safeHref(href)) {
        clean.setAttribute('href', href);
        clean.setAttribute('target', href.startsWith('/') || href.startsWith('#') ? '_self' : '_blank');
        clean.setAttribute('rel', 'noreferrer');
      }
    }

    Array.from(element.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeNode(child);
      if (sanitizedChild) clean.appendChild(sanitizedChild);
    });

    return clean;
  };

  const container = document.createElement('div');
  Array.from(document.body.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child);
    if (sanitized) container.appendChild(sanitized);
  });

  return container.innerHTML.trim();
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
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border text-[12px] font-semibold transition ${
        disabled
          ? 'cursor-not-allowed border-transparent text-[#a3a8c2] opacity-60'
          :
        active
          ? 'border-[#3558ff] bg-[#eef2ff] text-[#2643db]'
          : 'border-transparent text-[#30295c] hover:border-[#d8dced] hover:bg-[#f5f7ff]'
      }`}
    >
      {children}
    </button>
  );
}

function IconBack() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const BLOG_EDITOR_ICONS = {
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
  sidebarPanel: '/blog/icons/grid_layout_side_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  preview: '/blog/icons/visibility_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  redo: '/blog/icons/redo_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg',
  undo: '/blog/icons/undo_24dp_1F1F1F_FILL0_wght400_GRAD0_opsz24.svg'
} as const;

function BlogEditorIcon({
  src,
  className = 'h-4.5 w-4.5'
}: {
  src: string;
  className?: string;
}) {
  return <Image src={src} alt="" width={24} height={24} className={className} aria-hidden="true" unoptimized />;
}

function IconLink() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.link} />;
}

function IconBold() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.bold} className="h-4 w-4" />;
}

function IconItalic() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.italic} className="h-4 w-4" />;
}

function IconUnderline() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.underlined} className="h-4 w-4" />;
}

function IconStrike() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 6H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8" />
      <path d="M4 12h16" />
    </svg>
  );
}

function IconClearFormatting() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.clear} className="h-4 w-4" />;
}

function IconAlign({ align }: { align: 'left' | 'center' | 'right' }) {
  if (align === 'center') return <BlogEditorIcon src={BLOG_EDITOR_ICONS.alignCenter} className="h-4 w-4" />;
  if (align === 'right') return <BlogEditorIcon src={BLOG_EDITOR_ICONS.alignRight} className="h-4 w-4" />;
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.alignLeft} className="h-4 w-4" />;
}

function IconList({ ordered = false }: { ordered?: boolean }) {
  return <BlogEditorIcon src={ordered ? BLOG_EDITOR_ICONS.numberedList : BLOG_EDITOR_ICONS.bulletedList} />;
}

function IconQuote() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.quote} className="h-4 w-4" />;
}

function IconCode() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.code} className="h-4 w-4" />;
}

function IconUndo({ redo = false }: { redo?: boolean }) {
  return <BlogEditorIcon src={redo ? BLOG_EDITOR_ICONS.redo : BLOG_EDITOR_ICONS.undo} />;
}

function IconPreview() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.preview} />;
}

function IconSidebar() {
  return <BlogEditorIcon src={BLOG_EDITOR_ICONS.sidebarPanel} />;
}

function InlineToolbar({
  editor,
  disabled = false
}: {
  editor: ReturnType<typeof useEditor>;
  disabled?: boolean;
}) {
  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return {
          paragraph: true,
          h2: false,
          h3: false,
          h4: false,
          h5: false,
          h6: false,
          bold: false,
          italic: false,
          underline: false,
          strike: false,
          link: false,
          textAlign: 'left',
          fontSize: '16px',
          color: '#1f1b49',
          bulletList: false,
          orderedList: false,
          blockquote: false,
          codeBlock: false,
          canUndo: false,
          canRedo: false
        };
      }

      return {
        paragraph: currentEditor.isActive('paragraph'),
        h2: currentEditor.isActive('heading', { level: 2 }),
        h3: currentEditor.isActive('heading', { level: 3 }),
        h4: currentEditor.isActive('heading', { level: 4 }),
        h5: currentEditor.isActive('heading', { level: 5 }),
        h6: currentEditor.isActive('heading', { level: 6 }),
        bold: currentEditor.isActive('bold'),
        italic: currentEditor.isActive('italic'),
        underline: currentEditor.isActive('underline'),
        strike: currentEditor.isActive('strike'),
        link: currentEditor.isActive('link'),
        textAlign: currentEditor.isActive({ textAlign: 'center' })
          ? 'center'
          : currentEditor.isActive({ textAlign: 'right' })
            ? 'right'
            : 'left',
        fontSize: currentEditor.getAttributes('textStyle').fontSize || '16px',
        color: currentEditor.getAttributes('textStyle').color || '#1f1b49',
        bulletList: currentEditor.isActive('bulletList'),
        orderedList: currentEditor.isActive('orderedList'),
        blockquote: currentEditor.isActive('blockquote'),
        codeBlock: currentEditor.isActive('codeBlock'),
        canUndo: currentEditor.can().chain().focus().undo().run(),
        canRedo: currentEditor.can().chain().focus().redo().run()
      };
    }
  });

  const effectiveToolbarState = toolbarState ?? {
    paragraph: true,
    h2: false,
    h3: false,
    h4: false,
    h5: false,
    h6: false,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    link: false,
    textAlign: 'left',
    fontSize: '16px',
    color: '#1f1b49',
    bulletList: false,
    orderedList: false,
    blockquote: false,
    codeBlock: false,
    canUndo: false,
    canRedo: false
  };

  if (!editor) return null;

  return (
    <div className={`flex shrink-0 items-center gap-0.5 ${disabled ? 'pointer-events-none opacity-45' : ''}`}>
      <ToolbarButton label="Bold" active={effectiveToolbarState.bold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
        <IconBold />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={effectiveToolbarState.italic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <IconItalic />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={effectiveToolbarState.underline} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <IconUnderline />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={effectiveToolbarState.strike} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <IconStrike />
      </ToolbarButton>
      <label
        className={`ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#30295c] transition ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:border-[#d8dced] hover:bg-[#f5f7ff]'}`}
        title="Text color"
      >
        <span className="h-4 w-4 rounded-[4px] border border-[#1f1b49]/20" style={{ backgroundColor: effectiveToolbarState.color }} />
        <input
          type="color"
          className="sr-only"
          disabled={disabled}
          value={effectiveToolbarState.color}
          onChange={(event) => editor.chain().focus().setColor(event.currentTarget.value).run()}
        />
      </label>
      <select
        disabled={disabled}
        className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[12px] font-semibold text-[#30295c] outline-none hover:border-[#d8dced] hover:bg-[#f5f7ff]"
        value={effectiveToolbarState.fontSize}
        onChange={(event) => editor.chain().focus().setMark('textStyle', { fontSize: event.currentTarget.value }).run()}
      >
        {FONT_SIZES.map((fontSize) => (
          <option key={fontSize} value={fontSize}>{fontSize}</option>
        ))}
      </select>
      <ToolbarButton label="Clear formatting" disabled={disabled} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <IconClearFormatting />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-[#e1e5f2]" />
      <ToolbarButton label="Link" active={effectiveToolbarState.link} disabled={disabled} onClick={() => {
        if (effectiveToolbarState.link) {
          editor.chain().focus().unsetLink().run();
          return;
        }
        const href = window.prompt('Link URL');
        if (!href) return;
        editor.chain().focus().extendMarkRange('link').setLink({ href, target: href.startsWith('/') ? '_self' : '_blank', rel: 'noreferrer' }).run();
      }}>
        <IconLink />
      </ToolbarButton>
      <ToolbarButton label="Align left" active={effectiveToolbarState.textAlign === 'left'} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <IconAlign align="left" />
      </ToolbarButton>
      <ToolbarButton label="Align center" active={effectiveToolbarState.textAlign === 'center'} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <IconAlign align="center" />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={effectiveToolbarState.textAlign === 'right'} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <IconAlign align="right" />
      </ToolbarButton>
      <select
        disabled={disabled}
        className="h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[12px] font-semibold text-[#30295c] outline-none hover:border-[#d8dced] hover:bg-[#f5f7ff]"
        value={
          effectiveToolbarState.h2
            ? 'h2'
            : effectiveToolbarState.h3
              ? 'h3'
              : effectiveToolbarState.h4
                ? 'h4'
                : effectiveToolbarState.h5
                  ? 'h5'
                  : effectiveToolbarState.h6
                    ? 'h6'
                : 'paragraph'
        }
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === 'paragraph') {
            editor.chain().focus().setParagraph().run();
            return;
          }
          if (value === 'h2') editor.chain().focus().setHeading({ level: 2 }).run();
          if (value === 'h3') editor.chain().focus().setHeading({ level: 3 }).run();
          if (value === 'h4') editor.chain().focus().setHeading({ level: 4 }).run();
          if (value === 'h5') editor.chain().focus().setHeading({ level: 5 }).run();
          if (value === 'h6') editor.chain().focus().setHeading({ level: 6 }).run();
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
      <ToolbarButton label="Bullet list" active={effectiveToolbarState.bulletList} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <IconList />
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={effectiveToolbarState.orderedList} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <IconList ordered />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={effectiveToolbarState.blockquote} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <IconQuote />
      </ToolbarButton>
      <ToolbarButton label="Code block" active={effectiveToolbarState.codeBlock} disabled={disabled} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <IconCode />
      </ToolbarButton>
      <ToolbarButton label="Divider" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <BlogEditorIcon src={BLOG_EDITOR_ICONS.horizontalRule} className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-[#e1e5f2]" />
      <ToolbarButton label="Undo" disabled={disabled || !effectiveToolbarState.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <IconUndo />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={disabled || !effectiveToolbarState.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <IconUndo redo />
      </ToolbarButton>
    </div>
  );
}

function SidebarSection({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#e6e7ee] pb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[12px] font-black tracking-[0.02em] text-[#231d46]">{title}</span>
        <span className={`text-base text-[#5d6290] transition ${open ? 'rotate-180' : ''}`}>⌃</span>
      </button>
      {open ? <div className="space-y-4">{children}</div> : null}
    </section>
  );
}

function toggleOrderedSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function moveOrderedSelection(values: string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= values.length) return values;
  const next = [...values];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  return next;
}

function SearchableOrderedMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  buttonLabel,
  searchPlaceholder,
  emptySearchLabel,
  selectedListLabel,
  firstItemLabel,
  emptySelectionLabel = 'No items selected.'
}: {
  label: string;
  options: SelectOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  buttonLabel: string;
  searchPlaceholder: string;
  emptySearchLabel: string;
  selectedListLabel: string;
  firstItemLabel?: string;
  emptySelectionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const optionsById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.label.toLowerCase().includes(query) || option.id.toLowerCase().includes(query));
  }, [options, search]);

  useEffect(() => {
    if (!open) {
      setSearch('');
      return;
    }
    searchInputRef.current?.focus();

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) return;
      if (!containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="space-y-2.5">
      <label className="label text-sm">{label}</label>
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          className="input flex w-full items-center justify-between rounded-xl border-[#dfe3ef] text-left"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span className="truncate">{selectedIds.length ? `${selectedIds.length} selected` : buttonLabel}</span>
          <span className={`text-xs text-[#6f7598] transition ${open ? 'rotate-180' : ''}`}>⌄</span>
        </button>
        {open ? (
          <div className="absolute z-30 mt-1 w-full rounded-xl border border-[#dfe3ef] bg-white p-2 shadow-[0_12px_30px_rgba(24,31,68,0.14)]">
            <input
              ref={searchInputRef}
              className="input mb-2 rounded-xl border-[#dfe3ef] !py-1.5"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder={searchPlaceholder}
            />
            <div className="max-h-52 space-y-1 overflow-auto rounded-lg border border-[#e6e9f3] bg-[#fbfcff] p-2">
              {filteredOptions.length ? filteredOptions.map((option) => (
                <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(option.id)}
                    onChange={() => onChange(toggleOrderedSelection(selectedIds, option.id))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[#273058]">{option.label}</span>
                    <span className="block truncate text-[11px] text-[#7b819f]">{option.id}</span>
                  </span>
                </label>
              )) : (
                <p className="px-2 py-1 text-xs text-[#7b819f]">{emptySearchLabel}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#72789b]">{selectedListLabel}</p>
        {selectedIds.length ? selectedIds.map((id, index) => {
          const option = optionsById.get(id);
          return (
            <div key={`${id}-${index}`} className="flex items-start justify-between gap-2 rounded-xl border border-[#dfe3ef] bg-white px-2.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#273058]">{index + 1}. {option?.label || 'Unavailable item'}</p>
                <p className="truncate text-xs text-[#7b819f]">
                  {id}
                  {firstItemLabel && index === 0 ? `  |  ${firstItemLabel}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-[11px] font-semibold text-[#4f567f] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={index === 0}
                  onClick={() => onChange(moveOrderedSelection(selectedIds, index, -1))}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-[11px] font-semibold text-[#4f567f] disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={index === selectedIds.length - 1}
                  onClick={() => onChange(moveOrderedSelection(selectedIds, index, 1))}
                >
                  Down
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-[11px] font-semibold text-[#8b3d3d]"
                  onClick={() => onChange(selectedIds.filter((item) => item !== id))}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        }) : (
          <p className="text-xs text-[#7b819f]">{emptySelectionLabel}</p>
        )}
      </div>
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
  const hasAlt = Boolean(block.alt.trim());
  const hasCaption = Boolean(block.caption.trim());
  const hasCredit = Boolean(block.credit.trim());
  const hasManualFallback = Boolean((block.src || '').trim());

  return {
    ...block,
    assetId: asset.id,
    src: hasManualFallback ? block.src : undefined,
    alt: hasAlt ? block.alt : asset.alt_text_default || '',
    caption: hasCaption ? block.caption : asset.caption_default || '',
    credit: hasCredit ? block.credit : asset.credit_source || ''
  };
}

function ImageBlockFields({
  block,
  onChange
}: {
  block: Extract<BlogContentBlock, { type: 'image' }>;
  onChange: (block: BlogContentBlock) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<MediaPickerAsset | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!block.assetId) {
      setSelectedAsset(null);
      return;
    }

    setSelectedAsset(null);
    let active = true;
    async function loadAsset() {
      try {
        const response = await fetch(`/api/admin/blog/media/${block.assetId}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok) return;
        const asset = toMediaPickerAsset(data);
        if (asset) setSelectedAsset(asset);
      } catch {
        // Keep existing form data even when media lookup fails.
      }
    }

    void loadAsset();

    return () => {
      active = false;
    };
  }, [block.assetId]);

  function handleSelectAsset(asset: MediaPickerAsset) {
    setSelectedAsset(asset);
    setUploadMessage('');
    onChange(prefillImageBlockFromAsset(block, asset));
  }

  async function handleUploadAsset(file: File) {
    setUploadMessage('');
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/admin/blog/media', {
        method: 'POST',
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUploadMessage(data?.error || 'Failed to upload image.');
        return;
      }
      const uploaded = toMediaPickerAsset(data);
      if (!uploaded) {
        setUploadMessage('Image uploaded but metadata could not be loaded.');
        return;
      }
      handleSelectAsset(uploaded);
      setUploadMessage('Image uploaded and selected.');
    } catch {
      setUploadMessage('Network error while uploading image.');
    }
  }

  return (
    <div className="space-y-3">
      <ImageAssetPicker
        selectedAsset={selectedAsset}
        onUploadFile={handleUploadAsset}
        onOpenLibrary={() => setPickerOpen(true)}
        onRemove={() => {
          setSelectedAsset(null);
          setUploadMessage('');
          onChange({ ...block, assetId: null });
        }}
        uploadMessage={uploadMessage}
        recommendedText="Recommended image size: 720 x 450 pixels"
        compact
      />
      {block.assetId ? (
        <p className="text-[11px] text-[#7b819f]">Asset ID: {block.assetId}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Alt text</label>
          <input className="input" value={block.alt} onChange={(event) => onChange({ ...block, alt: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Caption</label>
          <input className="input" value={block.caption} onChange={(event) => onChange({ ...block, caption: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Credit</label>
          <input className="input" value={block.credit} onChange={(event) => onChange({ ...block, credit: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Size</label>
          <select
            className="input"
            value={block.size}
            onChange={(event) => onChange({ ...block, size: event.currentTarget.value as 'narrow' | 'wide' | 'full' })}
          >
            <option value="narrow">Small</option>
            <option value="wide">Medium</option>
            <option value="full">Large</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-[#dfe3ef] bg-white px-3 py-2.5">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#4f567f]"
          onClick={() => setAdvancedOpen((current) => !current)}
        >
          <span>Advanced</span>
          <span className={`text-[11px] text-[#6f7598] transition ${advancedOpen ? 'rotate-180' : ''}`}>⌄</span>
        </button>
        {advancedOpen ? (
          <div className="mt-2 space-y-2">
            <label className="label">Fallback src</label>
            <input
              className="input"
              value={block.src || ''}
              onChange={(event) => onChange({ ...block, src: event.currentTarget.value || undefined })}
              placeholder="https://..."
            />
          </div>
        ) : null}
      </div>

      <MediaLibraryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(asset) => handleSelectAsset(asset)}
      />
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
      setStatus({ tone: 'error', text: 'Couldn’t parse a valid YouTube URL.' });
    } else {
      setStatus(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">YouTube URL</label>
          <input
            className="input"
            value={block.url}
            placeholder="https://www.youtube.com/watch?v=..."
            onChange={(event) => applyUrl(event.currentTarget.value, 'change')}
            onBlur={(event) => applyUrl(event.currentTarget.value, 'blur')}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text/plain') || '';
              const embedUrl = toYouTubeEmbedUrl(pasted);
              if (!embedUrl) return;
              event.preventDefault();
              onChange({ ...block, url: embedUrl });
              setStatus({ tone: 'success', text: 'YouTube URL detected and converted.' });
            }}
          />
        </div>
        <div>
          <label className="label">Title</label>
          <input className="input" value={block.title || ''} onChange={(event) => onChange({ ...block, title: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Size</label>
          <select
            className="input"
            value={block.size || 'wide'}
            onChange={(event) => onChange({ ...block, size: event.currentTarget.value as 'narrow' | 'wide' | 'full' })}
          >
            <option value="narrow">Small</option>
            <option value="wide">Medium</option>
            <option value="full">Large</option>
          </select>
        </div>
      </div>
      {status ? (
        <p className={`text-xs ${status.tone === 'success' ? 'text-[#3e7a50]' : 'text-[#9a2b2b]'}`}>{status.text}</p>
      ) : null}
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
  episodes: AdminEpisodeOption[];
  posts: Array<{ id: string; title: string }>;
}) {
  if (block.type === 'cta_button') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Label</label>
          <input className="input" value={block.label} onChange={(event) => onChange({ ...block, label: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Href</label>
          <input className="input" value={block.href} onChange={(event) => onChange({ ...block, href: event.currentTarget.value })} />
        </div>
        <div>
          <label className="label">Alignment</label>
          <select
            className="input"
            value={block.align || 'center'}
            onChange={(event) => onChange({ ...block, align: event.currentTarget.value as 'left' | 'center' | 'right' })}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
    );
  }
  if (block.type === 'image') {
    return <ImageBlockFields block={block} onChange={onChange} />;
  }
  if (block.type === 'youtube_embed') {
    return <YouTubeBlockFields block={block} onChange={onChange} />;
  }
  if (block.type === 'video_embed') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">URL</label>
          <input className="input" value={block.url} onChange={(event) => onChange({ ...block, url: event.currentTarget.value })} />
        </div>
        {'title' in block ? (
          <div>
            <label className="label">Title</label>
            <input className="input" value={block.title || ''} onChange={(event) => onChange({ ...block, title: event.currentTarget.value } as BlogContentBlock)} />
          </div>
        ) : null}
      </div>
    );
  }
  if (block.type === 'listen_episode') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#2f295d]">Primary linked episode card</p>
        <p className="text-xs text-[#6f7598]">
          This block always uses the first selected episode from the sidebar “Episodes & Related” section.
        </p>
      </div>
    );
  }
  if (block.type === 'podcast_player') {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Episode</label>
          <select className="input" value={block.episodeId || ''} onChange={(event) => onChange({ ...block, episodeId: event.currentTarget.value || null } as BlogContentBlock)}>
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
        <label className="label">CSV-like table</label>
        <textarea
          className="input min-h-32"
          value={[block.headers.join(','), ...block.rows.map((row) => row.join(','))].join('\n')}
          onChange={(event) => {
            const rows = event.currentTarget.value.split('\n');
            const headers = rows[0] ? rows[0].split(',').map((cell) => cell.trim()) : [];
            const body = rows.slice(1).filter(Boolean).map((row) => row.split(',').map((cell) => cell.trim()));
            onChange({ ...block, headers, rows: body });
          }}
        />
      </div>
    );
  }
  if (block.type === 'resources') {
    const current = block as Extract<BlogContentBlock, { type: 'resources' }>;
    function updateItem(index: number, field: 'label' | 'href' | 'description', value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
      onChange({ ...current, items: next });
    }
    function removeItem(index: number) {
      onChange({ ...current, items: current.items.filter((_, i) => i !== index) });
    }
    function addItem() {
      onChange({ ...current, items: [...current.items, { id: crypto.randomUUID(), label: '', href: '', description: '' }] });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Heading</label>
          <input className="input" value={current.heading} onChange={(event) => onChange({ ...current, heading: event.currentTarget.value })} />
        </div>
        <div className="space-y-2">
          <label className="label">Resources</label>
          {current.items.map((item, index) => (
            <div key={item.id} className="group relative space-y-2 rounded-xl border border-[#dfe3ef] bg-[#f9fafd] p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5e7f0] text-[10px] font-bold text-[#5e6489]">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="input !rounded-lg !border-[#dfe3ef] !bg-white !px-3 !py-2 text-sm"
                    placeholder="Label"
                    value={item.label}
                    onChange={(event) => updateItem(index, 'label', event.currentTarget.value)}
                  />
                  <input
                    className="input !rounded-lg !border-[#dfe3ef] !bg-white !px-3 !py-2 text-sm"
                    placeholder="URL"
                    type="url"
                    value={item.href}
                    onChange={(event) => updateItem(index, 'href', event.currentTarget.value)}
                  />
                  <input
                    className="input !rounded-lg !border-[#dfe3ef] !bg-white !px-3 !py-2 text-sm"
                    placeholder="Description (optional)"
                    value={item.description}
                    onChange={(event) => updateItem(index, 'description', event.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="mt-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#99a0bd] transition hover:bg-[#fee2e2] hover:text-[#b42318]"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove resource ${index + 1}`}
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-3 py-2.5 text-xs font-semibold text-[#5e6489] transition hover:border-[#bfc7de] hover:text-[#4f5bd5]"
            onClick={addItem}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add resource
          </button>
        </div>
      </div>
    );
  }
  if (block.type === 'related_posts') {
    const current = block as Extract<BlogContentBlock, { type: 'related_posts' }>;
    function addPost(postId: string) {
      if (!postId || current.postIds.includes(postId)) return;
      onChange({ ...current, postIds: [...current.postIds, postId] });
    }
    function removePost(index: number) {
      onChange({ ...current, postIds: current.postIds.filter((_, i) => i !== index) });
    }
    const availablePosts = posts.filter((p) => !current.postIds.includes(p.id));
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Heading</label>
          <input className="input" value={current.heading} onChange={(event) => onChange({ ...current, heading: event.currentTarget.value })} />
        </div>
        <div className="space-y-2">
          <label className="label">Posts</label>
          {current.postIds.map((postId, index) => {
            const post = posts.find((p) => p.id === postId);
            return (
              <div key={postId} className="flex items-center gap-2 rounded-xl border border-[#dfe3ef] bg-[#f9fafd] p-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5e7f0] text-[10px] font-bold text-[#5e6489]">{index + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#2b3150]">{post?.title || postId}</p>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#99a0bd] transition hover:bg-[#fee2e2] hover:text-[#b42318]"
                  onClick={() => removePost(index)}
                  aria-label={`Remove post ${index + 1}`}
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            );
          })}
          {availablePosts.length > 0 ? (
            <select
              className="input !rounded-xl !border-dashed !border-[#cfd5e7] !bg-white text-sm text-[#5e6489]"
              value=""
              onChange={(event) => addPost(event.currentTarget.value)}
            >
              <option value="">+ Add a post…</option>
              {availablePosts.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          ) : current.postIds.length > 0 ? (
            <p className="text-xs text-[#7b819f]">All available posts have been added.</p>
          ) : null}
        </div>
      </div>
    );
  }
  if (block.type === 'related_episodes') {
    const current = block as Extract<BlogContentBlock, { type: 'related_episodes' }>;
    function addEpisode(episodeId: string) {
      if (!episodeId || current.episodeIds.includes(episodeId)) return;
      onChange({ ...current, episodeIds: [...current.episodeIds, episodeId] });
    }
    function removeEpisode(index: number) {
      onChange({ ...current, episodeIds: current.episodeIds.filter((_, i) => i !== index) });
    }
    const availableEpisodes = episodes.filter((e) => !current.episodeIds.includes(e.id));
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Heading</label>
          <input className="input" value={current.heading} onChange={(event) => onChange({ ...current, heading: event.currentTarget.value })} />
        </div>
        <div className="space-y-2">
          <label className="label">Episodes</label>
          {current.episodeIds.map((episodeId, index) => {
            const episode = episodes.find((e) => e.id === episodeId);
            return (
              <div key={episodeId} className="flex items-center gap-2 rounded-xl border border-[#dfe3ef] bg-[#f9fafd] p-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5e7f0] text-[10px] font-bold text-[#5e6489]">{index + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#2b3150]">{episode?.title || episodeId}</p>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#99a0bd] transition hover:bg-[#fee2e2] hover:text-[#b42318]"
                  onClick={() => removeEpisode(index)}
                  aria-label={`Remove episode ${index + 1}`}
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
            );
          })}
          {availableEpisodes.length > 0 ? (
            <select
              className="input !rounded-xl !border-dashed !border-[#cfd5e7] !bg-white text-sm text-[#5e6489]"
              value=""
              onChange={(event) => addEpisode(event.currentTarget.value)}
            >
              <option value="">+ Add an episode…</option>
              {availableEpisodes.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          ) : current.episodeIds.length > 0 ? (
            <p className="text-xs text-[#7b819f]">All available episodes have been added.</p>
          ) : null}
        </div>
      </div>
    );
  }
  if (block.type === 'faq') {
    const current = block as Extract<BlogContentBlock, { type: 'faq' }>;
    function updateQuestion(index: number, value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, question: value } : item));
      onChange({ ...current, items: next });
    }
    function updateAnswer(index: number, value: string) {
      const next = current.items.map((item, i) => (i === index ? { ...item, answer: createRichText(value) } : item));
      onChange({ ...current, items: next });
    }
    function removeItem(index: number) {
      onChange({ ...current, items: current.items.filter((_, i) => i !== index) });
    }
    function addItem() {
      onChange({ ...current, items: [...current.items, { id: crypto.randomUUID(), question: '', answer: createRichText('') }] });
    }
    return (
      <div className="space-y-3">
        <div>
          <label className="label">Heading</label>
          <input className="input" value={current.heading} onChange={(event) => onChange({ ...current, heading: event.currentTarget.value })} />
        </div>
        <div className="space-y-2">
          <label className="label">FAQ items</label>
          {current.items.map((item, index) => (
            <div key={item.id} className="group relative space-y-2 rounded-xl border border-[#dfe3ef] bg-[#f9fafd] p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e5e7f0] text-[10px] font-bold text-[#5e6489]">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    className="input !rounded-lg !border-[#dfe3ef] !bg-white !px-3 !py-2 text-sm font-medium"
                    placeholder="Question"
                    value={item.question}
                    onChange={(event) => updateQuestion(index, event.currentTarget.value)}
                  />
                  <textarea
                    className="input !rounded-lg !border-[#dfe3ef] !bg-white !px-3 !py-2 text-sm"
                    placeholder="Answer"
                    rows={2}
                    value={item.answer.map((part) => part.type === 'text' ? part.text : '').join('')}
                    onChange={(event) => updateAnswer(index, event.currentTarget.value)}
                  />
                </div>
                <button
                  type="button"
                  className="mt-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#99a0bd] transition hover:bg-[#fee2e2] hover:text-[#b42318]"
                  onClick={() => removeItem(index)}
                  aria-label={`Remove FAQ item ${index + 1}`}
                  title="Remove"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#cfd5e7] bg-white px-3 py-2.5 text-xs font-semibold text-[#5e6489] transition hover:border-[#bfc7de] hover:text-[#4f5bd5]"
            onClick={addItem}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add FAQ item
          </button>
        </div>
      </div>
    );
  }
  return <p className="text-sm text-carnival-ink/60">No extra fields for this block type.</p>;
}

function structuredBlockTypeLabel(type: BlogContentBlock['type']) {
  return STRUCTURED_BLOCK_OPTIONS.find((option) => option.type === type)?.label || type.replace(/_/g, ' ');
}

function structuredBlockPreviewLines(
  block: BlogContentBlock,
  episodesById: Map<string, string>,
  postsById: Map<string, string>
) {
  if (block.type === 'cta_button') {
    return [block.label || 'CTA button', block.href || 'No destination URL yet.'];
  }
  if (block.type === 'image') {
    return [block.alt || 'Image block', block.assetId ? `Asset: ${block.assetId}` : block.src ? `Source: ${block.src}` : 'No image selected.'];
  }
  if (block.type === 'video_embed' || block.type === 'youtube_embed') {
    return [block.title || structuredBlockTypeLabel(block.type), block.url || 'No URL yet.'];
  }
  if (block.type === 'podcast_player') {
    return [block.titleOverride || 'Podcast player', block.episodeId ? episodesById.get(block.episodeId) || block.episodeId : 'Auto / first linked episode.'];
  }
  if (block.type === 'table') {
    return [`${block.headers.length} columns`, `${block.rows.length} row${block.rows.length === 1 ? '' : 's'}`];
  }
  if (block.type === 'listen_episode') {
    return [block.heading || 'Listen to episode', block.episodeId ? episodesById.get(block.episodeId) || block.episodeId : 'Auto / first linked episode.'];
  }
  if (block.type === 'resources') {
    return [block.heading || 'Further resources', `${block.items.length} resource item${block.items.length === 1 ? '' : 's'}.`];
  }
  if (block.type === 'related_episodes') {
    const first = block.episodeIds[0];
    return [
      block.heading || 'Related episodes',
      block.episodeIds.length
        ? `${block.episodeIds.length} selected. First: ${first ? episodesById.get(first) || first : ''}`
        : 'No episode IDs selected.'
    ];
  }
  if (block.type === 'related_posts') {
    const first = block.postIds[0];
    return [
      block.heading || 'Related posts',
      block.postIds.length
        ? `${block.postIds.length} selected. First: ${first ? postsById.get(first) || first : ''}`
        : 'No post IDs selected.'
    ];
  }
  if (block.type === 'faq') {
    return [block.heading || 'FAQ', `${block.items.length} FAQ item${block.items.length === 1 ? '' : 's'}.`];
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
  episodes: AdminEpisodeOption[];
  posts: Array<{ id: string; title: string }>;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<MediaPickerAsset | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const block = node.attrs?.block as BlogContentBlock | null;
  const imageAssetId = block?.type === 'image' ? block.assetId : null;
  const episodesById = useMemo(() => new Map(episodes.map((episode) => [episode.id, episode])), [episodes]);
  const episodeTitlesById = useMemo(() => new Map(episodes.map((episode) => [episode.id, episode.title])), [episodes]);
  const postsById = useMemo(() => new Map(posts.map((post) => [post.id, post.title])), [posts]);

  useEffect(() => {
    if (!popoverOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!containerRef.current || !target) return;
      if (!containerRef.current.contains(target)) {
        setPopoverOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popoverOpen]);

  useEffect(() => {
    if (!imageAssetId) {
      setPreviewAsset(null);
      return;
    }

    let active = true;
    setPreviewAsset(null);
    async function loadPreviewAsset() {
      try {
        const response = await fetch(`/api/admin/blog/media/${imageAssetId}`, { cache: 'no-store' });
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
  }, [imageAssetId]);

  if (!block || typeof block !== 'object' || typeof block.type !== 'string') {
    return (
      <NodeViewWrapper className="my-4 rounded-xl border border-[#f0d9d9] bg-[#fff8f8] p-3 text-sm text-[#8b3d3d]">
        Structured block is invalid. Remove and add it again.
      </NodeViewWrapper>
    );
  }

  const previewLines = structuredBlockPreviewLines(block, episodeTitlesById, postsById);
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
      className="inline-flex h-7 w-7 cursor-grab select-none items-center justify-center rounded-md border border-[#dfe3ef] bg-white text-[#58608a] hover:bg-[#f4f6fc]"
      aria-label="Drag and move block"
      title="Drag and move block"
      onMouseDown={ensureNodeSelection}
      onDragStart={(event) => {
        ensureNodeSelection();
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      ⋮⋮
    </span>
  );

  if (block.type === 'image') {
    const imageLayout = getImageBlockLayout(block.size);
    const imageUrl = previewAsset?.storage_path ? getStoragePublicUrl(previewAsset.storage_path) : block.src || '';
    const captionText = block.caption || previewAsset?.caption_default || '';
    const creditText = block.credit || previewAsset?.credit_source || '';
    const waitingForAsset = Boolean(block.assetId && !previewAsset && !block.src);

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false} draggable="true">
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
        >
          <div className="absolute left-5 top-5 z-10">{dragHandle}</div>
          {imageUrl ? (
            <div
              role="button"
              tabIndex={0}
              data-drag-handle
              draggable="true"
              aria-label="Edit image block"
              className="cursor-pointer rounded-xl outline-none ring-[#3558ff] ring-offset-2 focus-visible:ring-2"
              onClick={() => {
                ensureNodeSelection();
                setPopoverOpen(true);
              }}
              onMouseDown={ensureNodeSelection}
              onDragStart={(event) => {
                ensureNodeSelection();
                event.dataTransfer.effectAllowed = 'move';
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  ensureNodeSelection();
                  setPopoverOpen(true);
                }
              }}
            >
              <figure className={`space-y-2 ${imageLayout.wrapperClassName}`}>
                <div className="relative overflow-hidden rounded-2xl border border-carnival-ink/15 bg-white">
                  <Image
                    src={imageUrl}
                    alt={block.alt || previewAsset?.alt_text_default || ''}
                    width={1200}
                    height={800}
                    sizes={imageLayout.sizes}
                    draggable={false}
                    className="h-auto w-full object-cover"
                  />
                </div>
                {(captionText || creditText) ? (
                  <figcaption className="space-y-1 text-sm text-carnival-ink/70">
                    {captionText ? <p>{captionText}</p> : null}
                    {creditText ? <p className="text-xs">Credit: {creditText}</p> : null}
                  </figcaption>
                ) : null}
              </figure>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              data-drag-handle
              draggable="true"
              aria-label="Edit image block"
              className="rounded-xl border border-dashed border-[#d3d9ec] bg-[#f7f9ff] p-6 text-left text-sm text-[#6f7598] outline-none ring-[#3558ff] ring-offset-2 focus-visible:ring-2"
              onClick={() => {
                ensureNodeSelection();
                setPopoverOpen(true);
              }}
              onMouseDown={ensureNodeSelection}
              onDragStart={(event) => {
                ensureNodeSelection();
                event.dataTransfer.effectAllowed = 'move';
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  ensureNodeSelection();
                  setPopoverOpen(true);
                }
              }}
            >
              {waitingForAsset ? 'Loading image preview...' : 'No image selected. Click to choose an image.'}
            </div>
          )}

          {popoverOpen ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-[#dfe3ef] bg-[#f9faff] p-3 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6f7598]">Image Block</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-xs font-semibold text-[#4f567f] hover:bg-[#f4f6fc]"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-xs font-semibold text-[#8b3d3d]"
                    onClick={() => deleteNode()}
                  >
                    Remove
                  </button>
                </div>
              </div>
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

  if (block.type === 'youtube_embed') {
    const embedUrl = toYouTubeEmbedUrl(block.url);
    const videoLayout = getImageBlockLayout(block.size);

    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false} draggable="true">
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
        >
          <div className="absolute left-5 top-5 z-10">{dragHandle}</div>
          {embedUrl ? (
            <div className={videoLayout.wrapperClassName}>
              <div className="relative overflow-hidden rounded-2xl border border-carnival-ink/15 bg-white">
                <iframe
                  src={embedUrl}
                  title={block.title || 'YouTube video'}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  className="aspect-video w-full"
                />
                <button
                  type="button"
                  className="absolute inset-0 cursor-pointer bg-transparent"
                  aria-label="Edit YouTube block"
                  onClick={() => {
                    ensureNodeSelection();
                    setPopoverOpen(true);
                  }}
                />
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Edit YouTube block"
              className="rounded-xl border border-dashed border-[#d3d9ec] bg-[#f7f9ff] p-6 text-left text-sm text-[#6f7598] outline-none ring-[#3558ff] ring-offset-2 focus-visible:ring-2"
              onClick={() => {
                ensureNodeSelection();
                setPopoverOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  ensureNodeSelection();
                  setPopoverOpen(true);
                }
              }}
            >
              Paste a valid YouTube URL to preview this block.
            </div>
          )}
          {popoverOpen ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-[#dfe3ef] bg-[#f9faff] p-3 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6f7598]">YouTube Block</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-xs font-semibold text-[#4f567f] hover:bg-[#f4f6fc]"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-xs font-semibold text-[#8b3d3d]"
                    onClick={() => deleteNode()}
                  >
                    Remove
                  </button>
                </div>
              </div>
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

  if (block.type === 'listen_episode') {
    const linkedEpisode = block.episodeId ? episodesById.get(block.episodeId) || null : null;
    const episode = linkedEpisode ? toPodcastEpisodeCard(linkedEpisode) : null;
    return (
      <NodeViewWrapper className="not-prose relative my-4" contentEditable={false} draggable="true">
        <div
          ref={containerRef}
          className={`relative rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
        >
          <div className="absolute left-5 top-5 z-10">{dragHandle}</div>
          <button
            type="button"
            className="w-full rounded-xl text-left outline-none ring-[#3558ff] ring-offset-2 focus-visible:ring-2"
            onClick={() => {
              ensureNodeSelection();
              setPopoverOpen(true);
            }}
          >
            <FeaturedEpisodeShowcase heading={block.heading || 'Listen to the linked episode'}>
              {episode ? (
                <EpisodeCard episode={episode} featured />
              ) : (
                <div className="rounded-2xl border border-dashed border-carnival-ink/20 bg-white p-5 text-sm text-carnival-ink/70">
                  No linked episode selected yet. Choose one in the “Episodes & Related” sidebar section.
                </div>
              )}
            </FeaturedEpisodeShowcase>
          </button>
          {popoverOpen ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-[#dfe3ef] bg-[#f9faff] p-3 shadow-[0_10px_26px_rgba(0,0,0,0.12)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6f7598]">Primary Episode Block</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-xs font-semibold text-[#4f567f] hover:bg-[#f4f6fc]"
                    onClick={() => setPopoverOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-xs font-semibold text-[#8b3d3d]"
                    onClick={() => deleteNode()}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="text-xs text-[#6f7598]">
                Primary episode is controlled by the first linked episode selected in the sidebar.
              </p>
            </div>
          ) : null}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="not-prose relative my-4" contentEditable={false} draggable="true">
      <div
        ref={containerRef}
        className={`rounded-2xl border bg-white p-3 shadow-[0_10px_26px_rgba(0,0,0,0.08)] ${selected ? 'border-[#3558ff]' : 'border-[#dfe3ef]'}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5">{dragHandle}</span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#6f7598]">{typeLabel}</p>
              <p className="truncate text-[15px] font-bold text-[#231d46]">{previewLines[0] || 'Structured block'}</p>
              {previewLines[1] ? <p className="mt-0.5 line-clamp-2 text-sm text-[#6f7598]">{previewLines[1]}</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded-md border border-[#dfe3ef] bg-white px-2 py-1 text-xs font-semibold text-[#4f567f] hover:bg-[#f4f6fc]"
              onClick={() => setPopoverOpen((current) => !current)}
            >
              {popoverOpen ? 'Close' : 'Edit'}
            </button>
            <button
              type="button"
              className="rounded-md border border-[#f0d9d9] bg-[#fff8f8] px-2 py-1 text-xs font-semibold text-[#8b3d3d]"
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
      episodes: [] as AdminEpisodeOption[],
      posts: [] as Array<{ id: string; title: string }>
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
      episodes: AdminEpisodeOption[];
      posts: Array<{ id: string; title: string }>;
    };
    return ReactNodeViewRenderer((props) => (
      <StructuredBlockNodeView
        {...props}
        episodes={options.episodes}
        posts={options.posts}
      />
    ));
  }
});

export function AdminPostEditor({
  initialPost,
  authors,
  categories,
  tags,
  series,
  topicClusters,
  labels,
  episodes,
  relatedPostOptions
}: {
  initialPost: any;
  authors: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
  series: Array<{ id: string; name: string }>;
  topicClusters: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string }>;
  episodes: AdminEpisodeOption[];
  relatedPostOptions: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPost.title);
  const [slug, setSlug] = useState(initialPost.slug);
  const [slugEditorOpen, setSlugEditorOpen] = useState(false);
  const [slugDraft, setSlugDraft] = useState(normalizeSlugInput(initialPost.slug || ''));
  const [slugCopyMessage, setSlugCopyMessage] = useState('');
  const [excerpt, setExcerpt] = useState(initialPost.excerpt || '');
  const [status, setStatus] = useState<BlogPostWriteInput['status']>(() => deriveInitialPostStatus(initialPost));
  const [featuredImageId, setFeaturedImageId] = useState(initialPost.featured_image_id || '');
  const [featuredMediaOptions, setFeaturedMediaOptions] = useState<MediaOption[]>(
    initialPost.featured_image?.id
      ? [{
          id: initialPost.featured_image.id,
          storage_path: initialPost.featured_image.storage_path,
          alt_text_default: initialPost.featured_image.alt_text_default,
          caption_default: initialPost.featured_image.caption_default,
          credit_source: initialPost.featured_image.credit_source,
          mime_type: initialPost.featured_image.mime_type
        }]
      : []
  );
  const [featuredUploadMessage, setFeaturedUploadMessage] = useState('');
  const [featuredAssetAlt, setFeaturedAssetAlt] = useState(initialPost.featured_image?.alt_text_default || '');
  const [featuredAssetCaption, setFeaturedAssetCaption] = useState(initialPost.featured_image?.caption_default || '');
  const [featuredAssetCredit, setFeaturedAssetCredit] = useState(initialPost.featured_image?.credit_source || '');
  const [featuredAssetMetaMessage, setFeaturedAssetMetaMessage] = useState('');
  const [featuredAssetMetaSaving, setFeaturedAssetMetaSaving] = useState(false);
  const [authorId, setAuthorId] = useState(initialPost.author_id);
  const [publishAt, setPublishAt] = useState(toLocalDateTimeInput(initialPost.scheduled_at || initialPost.published_at || null));
  const [primaryCategoryId, setPrimaryCategoryId] = useState(initialPost.primary_category_id || '');
  const [isFeatured, setIsFeatured] = useState(Boolean(initialPost.is_featured));
  const [seoTitle, setSeoTitle] = useState(initialPost.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(initialPost.seo_description || '');
  const [socialTitle, setSocialTitle] = useState(initialPost.social_title || '');
  const [socialDescription, setSocialDescription] = useState(initialPost.social_description || '');
  const [canonicalUrl, setCanonicalUrl] = useState(initialPost.canonical_url || '');
  const [focusKeyword, setFocusKeyword] = useState(initialPost.focus_keyword || '');
  const [ogImageId, setOgImageId] = useState(initialPost.og_image_id || '');
  const [schemaType, setSchemaType] = useState(initialPost.schema_type || 'BlogPosting');
  const [noindex, setNoindex] = useState(Boolean(initialPost.noindex));
  const [nofollow, setNofollow] = useState(Boolean(initialPost.nofollow));
  const [categoryIds, setCategoryIds] = useState<string[]>(initialPost.taxonomies.categories.map((item: { id: string }) => item.id));
  const [tagIds, setTagIds] = useState<string[]>(initialPost.taxonomies.tags.map((item: { id: string }) => item.id));
  const [seriesIds, setSeriesIds] = useState<string[]>(initialPost.taxonomies.series.map((item: { id: string }) => item.id));
  const [topicClusterIds, setTopicClusterIds] = useState<string[]>(initialPost.taxonomies.topicClusters.map((item: { id: string }) => item.id));
  const [labelIds, setLabelIds] = useState<string[]>(initialPost.taxonomies.labels.map((item: { id: string }) => item.id));
  const [linkedEpisodes, setLinkedEpisodes] = useState<Array<{ episodeId: string; isPrimary: boolean }>>(
    initialPost.linked_episodes.map((item: { episode: { id: string }; is_primary: boolean }) => ({
      episodeId: item.episode.id,
      isPrimary: item.is_primary
    }))
  );
  const [relatedPostIds, setRelatedPostIds] = useState<string[]>(initialPost.related_override_ids || []);
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editorBaseOrigin, setEditorBaseOrigin] = useState('');
  const [authorOptions, setAuthorOptions] = useState(authors);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [tagOptions, setTagOptions] = useState(tags);
  const [seriesOptions, setSeriesOptions] = useState(series);
  const [topicClusterOptions, setTopicClusterOptions] = useState(topicClusters);
  const [labelOptions, setLabelOptions] = useState(labels);
  const episodeSelectOptions = useMemo<SelectOption[]>(
    () => episodes.map((episode) => ({ id: episode.id, label: episode.title })),
    [episodes]
  );
  const relatedPostSelectOptions = useMemo<SelectOption[]>(
    () => relatedPostOptions.map((post) => ({ id: post.id, label: post.title })),
    [relatedPostOptions]
  );
  const structuredBlockExtension = useMemo(
    () => StructuredBlockNode.configure({ episodes, posts: relatedPostOptions }),
    [episodes, relatedPostOptions]
  );
  const linkedEpisodeIds = useMemo(() => linkedEpisodes.map((item) => item.episodeId), [linkedEpisodes]);
  const [hasPrimaryListenBlockInEditor, setHasPrimaryListenBlockInEditor] = useState<boolean>(
    () => hasPrimaryListenEpisodeBlock(normalizeBlogDocument(initialPost.content_json || []))
  );
  const [openPanels, setOpenPanels] = useState({
    url: true,
    settings: true,
    taxonomy: false,
    episodes: false,
    seo: false,
    revisions: false
  });
  const autosaveTimer = useRef<number | null>(null);
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const featuredQuickUploadInputRef = useRef<HTMLInputElement | null>(null);
  const linkedEpisodesLifecycleInitializedRef = useRef(false);
  const previousLinkedEpisodeCountRef = useRef(linkedEpisodeIds.length);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  function handleMediaLibraryPick(asset: MediaPickerAsset) {
    const option: MediaOption = {
      id: asset.id,
      storage_path: asset.storage_path,
      alt_text_default: asset.alt_text_default || '',
      caption_default: asset.caption_default || '',
      credit_source: asset.credit_source || '',
      mime_type: asset.mime_type || ''
    };
    upsertFeaturedMediaOption(option);
    setFeaturedImageId(option.id);
    setFeaturedUploadMessage('');
  }
  const taxonomyGroups: Array<{
    label: string;
    items: Array<{ id: string; name: string }>;
    values: string[];
    setter: (next: string[]) => void;
  }> = [
    { label: 'Categories', items: categoryOptions, values: categoryIds, setter: setCategoryIds },
    { label: 'Tags', items: tagOptions, values: tagIds, setter: setTagIds },
    { label: 'Series', items: seriesOptions, values: seriesIds, setter: setSeriesIds },
    { label: 'Topics', items: topicClusterOptions, values: topicClusterIds, setter: setTopicClusterIds },
    { label: 'Labels', items: labelOptions, values: labelIds, setter: setLabelIds }
  ];

  useEffect(() => {
    let active = true;
    type TaxonomyKind = 'blog_authors' | 'categories' | 'tags' | 'series' | 'topic_clusters' | 'post_labels';

    async function loadTaxonomyOptions(kind: TaxonomyKind) {
      try {
        const response = await fetch(`/api/admin/blog/taxonomies/${kind}`, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!active || !response.ok || !Array.isArray(data?.items)) return;
        const mapped = data.items
          .filter((item: any) => item?.id && item?.name)
          .map((item: any) => ({ id: item.id as string, name: item.name as string }));
        if (kind === 'blog_authors') setAuthorOptions(mapped);
        if (kind === 'categories') setCategoryOptions(mapped);
        if (kind === 'tags') setTagOptions(mapped);
        if (kind === 'series') setSeriesOptions(mapped);
        if (kind === 'topic_clusters') setTopicClusterOptions(mapped);
        if (kind === 'post_labels') setLabelOptions(mapped);
      } catch {
        // Keep server-provided props as fallback when the client refresh call fails.
      }
    }

    void Promise.all([
      loadTaxonomyOptions('blog_authors'),
      loadTaxonomyOptions('categories'),
      loadTaxonomyOptions('tags'),
      loadTaxonomyOptions('series'),
      loadTaxonomyOptions('topic_clusters'),
      loadTaxonomyOptions('post_labels')
    ]);

    return () => {
      active = false;
    };
  }, []);

  const selectedFeaturedAsset = useMemo(() => {
    if (!featuredImageId) return null;
    return featuredMediaOptions.find((asset) => asset.id === featuredImageId) || null;
  }, [featuredImageId, featuredMediaOptions]);

  const selectedFeaturedAssetUrl = selectedFeaturedAsset?.storage_path
    ? getStoragePublicUrl(selectedFeaturedAsset.storage_path)
    : null;

  useEffect(() => {
    if (!selectedFeaturedAsset) {
      setFeaturedAssetAlt('');
      setFeaturedAssetCaption('');
      setFeaturedAssetCredit('');
      setFeaturedAssetMetaMessage('');
      return;
    }
    setFeaturedAssetAlt(selectedFeaturedAsset.alt_text_default || '');
    setFeaturedAssetCaption(selectedFeaturedAsset.caption_default || '');
    setFeaturedAssetCredit(selectedFeaturedAsset.credit_source || '');
    setFeaturedAssetMetaMessage('');
  }, [selectedFeaturedAsset]);

  function toMediaOption(asset: any): MediaOption | null {
    if (!asset?.id || !asset?.storage_path) return null;
    return {
      id: asset.id,
      storage_path: asset.storage_path,
      alt_text_default: asset.alt_text_default || '',
      caption_default: asset.caption_default || '',
      credit_source: asset.credit_source || '',
      mime_type: asset.mime_type || ''
    };
  }

  function upsertFeaturedMediaOption(asset: MediaOption) {
    setFeaturedMediaOptions((current) => {
      const map = new Map<string, MediaOption>();
      for (const item of current) map.set(item.id, item);
      map.set(asset.id, asset);
      return [...map.values()];
    });
  }

  async function persistFeaturedImageMeta() {
    if (!selectedFeaturedAsset) return;
    const nextAlt = featuredAssetAlt.trim();
    const nextCaption = featuredAssetCaption.trim();
    const nextCredit = featuredAssetCredit.trim();
    const currentAlt = selectedFeaturedAsset.alt_text_default || '';
    const currentCaption = selectedFeaturedAsset.caption_default || '';
    const currentCredit = selectedFeaturedAsset.credit_source || '';

    if (nextAlt === currentAlt && nextCaption === currentCaption && nextCredit === currentCredit) return;

    setFeaturedAssetMetaSaving(true);
    setFeaturedAssetMetaMessage('');
    try {
      const response = await fetch(`/api/admin/blog/media/${selectedFeaturedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alt_text_default: nextAlt,
          caption_default: nextCaption,
          credit_source: nextCredit
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeaturedAssetMetaMessage(data?.error || 'Failed to update featured image details.');
        return;
      }
      const updated = toMediaOption(data);
      if (updated) {
        upsertFeaturedMediaOption(updated);
      }
      setFeaturedAssetMetaMessage('Image details saved.');
      window.setTimeout(() => setFeaturedAssetMetaMessage(''), 1800);
    } catch {
      setFeaturedAssetMetaMessage('Failed to update featured image details.');
    } finally {
      setFeaturedAssetMetaSaving(false);
    }
  }

  async function uploadFeaturedImage(file: File) {
    setFeaturedUploadMessage('');
    try {
      const formData = new FormData();
      formData.set('file', file);

      const response = await fetch('/api/admin/blog/media', {
        method: 'POST',
        body: formData
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFeaturedUploadMessage(data?.error || 'Failed to upload featured image.');
        return;
      }

      const uploaded = toMediaOption(data);
      if (uploaded) {
        upsertFeaturedMediaOption(uploaded);
        setFeaturedImageId(uploaded.id);
        setFeaturedUploadMessage('Image uploaded and selected.');
      } else {
        setFeaturedUploadMessage('Image uploaded.');
      }

    } catch {
      setFeaturedUploadMessage('Network error while uploading image.');
    }
  }

  function handleFeaturedQuickFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.currentTarget.files?.[0] || null;
    if (!nextFile) return;
    void uploadFeaturedImage(nextFile);
    event.currentTarget.value = '';
  }

  function handleRemoveFeaturedImage() {
    setFeaturedImageId('');
    setFeaturedUploadMessage('');
    setFeaturedAssetMetaMessage('');
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4, 5, 6] }
      }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Link.configure({ openOnClick: false }),
      Underline,
      structuredBlockExtension,
      Placeholder.configure({
        placeholder: 'Type / to add a block'
      })
    ],
    editorProps: {
      attributes: {
        class: 'min-h-[420px] w-full bg-transparent px-0 py-0 text-[14px] leading-6 outline-none'
      },
      handlePaste: (_view, event) => {
        const html = event.clipboardData?.getData('text/html')?.trim() ?? '';
        const text = event.clipboardData?.getData('text/plain')?.replace(/\r\n/g, '\n') ?? '';

        if (text && looksLikeMarkdown(text)) {
          const markdownHtml = marked.parse(text, {
            async: false,
            breaks: true,
            gfm: true
          });
          const sanitizedMarkdownHtml = sanitizePastedHtml(typeof markdownHtml === 'string' ? markdownHtml : '');
          if (sanitizedMarkdownHtml) {
            editor?.chain().focus().insertContent(sanitizedMarkdownHtml).run();
            return true;
          }
        }

        if (html && looksLikeHtml(html)) {
          const sanitizedHtml = sanitizePastedHtml(html);
          if (sanitizedHtml) {
            editor?.chain().focus().insertContent(sanitizedHtml).run();
            return true;
          }
        }

        if (text) {
          editor?.chain().focus().insertContent(plainTextToTiptapContent(text) as any).run();
          return true;
        }

        return false;
      }
    },
    content: blocksToTiptapJson(initialPost.content_json || []) as any
  });

  function getEditorBlocks() {
    return tiptapJsonToBlocks(editor?.getJSON() as any);
  }

  function setEditorBlocks(nextBlocks: BlogContentBlock[]) {
    if (!editor) return;
    editor.commands.setContent(blocksToTiptapJson(nextBlocks) as any);
    setHasPrimaryListenBlockInEditor(hasPrimaryListenEpisodeBlock(nextBlocks));
  }

  function replaceEditorBlocksIfChanged(nextBlocks: BlogContentBlock[]) {
    const current = getEditorBlocks();
    if (JSON.stringify(current) === JSON.stringify(nextBlocks)) return;
    setEditorBlocks(nextBlocks);
  }

  function insertPrimaryListenEpisodeAtCursor() {
    if (!editor || !linkedEpisodeIds.length || hasPrimaryListenBlockInEditor) return;
    const block = createPrimaryListenEpisodeBlock(linkedEpisodeIds[0]);
    const selection = lastSelectionRef.current;
    const chain = editor.chain().focus();
    if (selection) {
      chain.insertContentAt({ from: selection.from, to: selection.to }, { type: 'structuredBlock', attrs: { block } });
    } else {
      chain.insertContent({ type: 'structuredBlock', attrs: { block } });
    }
    chain.run();
  }

  const bodyWordCount = useMemo(() => {
    const text = editor?.getText().trim() || '';
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }, [editor]);

  const publishAtIso = useMemo(() => {
    if (!publishAt) return null;
    const date = new Date(publishAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }, [publishAt]);

  const temporalStatus = useMemo<BlogPostWriteInput['status']>(() => {
    if (!publishAtIso) return 'draft';
    const publishMs = new Date(publishAtIso).getTime();
    return publishMs > Date.now() ? 'scheduled' : 'published';
  }, [publishAtIso]);

  const effectiveStatus = useMemo<BlogPostWriteInput['status']>(() => {
    if (status === 'archived') return 'archived';
    if (status === 'draft') return 'draft';
    return temporalStatus;
  }, [status, temporalStatus]);

  const canonicalOrigin = useMemo(() => getCanonicalOrigin(canonicalUrl), [canonicalUrl]);
  const defaultPublicOrigin = useMemo(
    () => (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.thecompendiumpodcast.com').replace(/\/+$/, ''),
    []
  );
  const postSlug = useMemo(() => normalizeSlugInput(slug), [slug]);
  const postUrlBase = canonicalOrigin || editorBaseOrigin || defaultPublicOrigin;
  const postUrlPrefix = `${postUrlBase}/blog/`;
  const statusControlValue = status === 'scheduled' ? 'published' : status;

  function getPayload(): BlogPostWriteInput {
    const normalizedLinkedEpisodeIds = linkedEpisodes.map((item) => item.episodeId);
    const documentBlocks = normalizePrimaryListenEpisodeBlocksForSave(
      syncPrimaryListenEpisodeBlocksEpisode(getEditorBlocks(), normalizedLinkedEpisodeIds[0]),
      normalizedLinkedEpisodeIds
    );
    return {
      title,
      slug,
      status: effectiveStatus,
      excerpt: excerpt || null,
      contentJson: documentBlocks,
      featuredImageId: featuredImageId || null,
      authorId,
      publishedAt: effectiveStatus === 'published' ? publishAtIso : null,
      scheduledAt: effectiveStatus === 'scheduled' ? publishAtIso : null,
      archivedAt: effectiveStatus === 'archived' ? initialPost.archived_at || new Date().toISOString() : null,
      isFeatured,
      primaryCategoryId: primaryCategoryId || null,
      taxonomy: {
        categoryIds,
        tagIds,
        seriesIds,
        topicClusterIds,
        labelIds
      },
      linkedEpisodes: normalizedLinkedEpisodeIds.map((episodeId, index) => ({
        episodeId,
        sortOrder: index,
        isPrimary: index === 0
      })),
      relatedPostIds,
      seo: {
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        socialTitle: socialTitle || null,
        socialDescription: socialDescription || null,
        canonicalUrl: canonicalUrl || null,
        noindex,
        nofollow,
        focusKeyword: focusKeyword || null,
        schemaType: schemaType || 'BlogPosting',
        ogImageId: ogImageId || null
      },
      revisionReason: ''
    };
  }

  async function persist(autosave = false) {
    setSaving(true);

    if (!autosave && (effectiveStatus === 'published' || effectiveStatus === 'scheduled')) {
      const publishErrors: string[] = [];
      if (!seoTitle?.trim()) publishErrors.push('SEO title is required');
      if (!seoDescription?.trim()) publishErrors.push('Meta description is required');
      if (!focusKeyword?.trim()) publishErrors.push('Focus keyword is required');
      if (categoryIds.length === 0) publishErrors.push('At least one category is required');
      if (publishErrors.length > 0) {
        setSaveMessage(publishErrors.join('. ') + '.');
        setSaving(false);
        return;
      }
    }

    try {
      const endpoint = autosave
        ? `/api/admin/blog/posts/${initialPost.id}/autosave`
        : `/api/admin/blog/posts/${initialPost.id}`;
      const response = await fetch(endpoint, {
        method: autosave ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload())
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSaveMessage(data.error || 'Failed to save post.');
        return;
      }
      if (!autosave) {
        setAutosaveEnabled(true);
      }
      setSaveMessage(autosave ? `Autosaved at ${new Date().toLocaleTimeString()}` : 'Post saved.');
    } catch {
      setSaveMessage('Failed to save post.');
    } finally {
      setSaving(false);
    }
  }

  async function openPreview() {
    try {
      const response = await fetch(`/api/admin/blog/posts/${initialPost.id}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getPayload())
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setSaveMessage(data.error || 'Failed to build preview.');
        return;
      }

      window.open(`/api/admin/blog/posts/${initialPost.id}/preview`, '_blank', 'noopener,noreferrer');
    } catch {
      setSaveMessage('Failed to build preview.');
    }
  }

  useEffect(() => {
    if (!editor || !autosaveEnabled) return;
    const schedule = () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        void persist(true);
      }, 2500);
    };
    editor.on('update', schedule);
    return () => {
      editor.off('update', schedule);
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
    // `persist` is intentionally omitted to avoid re-binding editor listeners on every field change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosaveEnabled, editor]);

  useEffect(() => {
    if (!editor || !autosaveEnabled) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void persist(true);
    }, 2500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
    // `persist` is intentionally omitted so autosave is driven by field changes, not callback identity churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authorId,
    autosaveEnabled,
    canonicalUrl,
    categoryIds,
    editor,
    excerpt,
    featuredImageId,
    focusKeyword,
    isFeatured,
    labelIds,
    linkedEpisodes,
    nofollow,
    noindex,
    ogImageId,
    primaryCategoryId,
    publishAt,
    relatedPostIds,
    schemaType,
    seoDescription,
    seoTitle,
    seriesIds,
    slug,
    socialDescription,
    socialTitle,
    status,
    tagIds,
    title,
    topicClusterIds
  ]);

  useEffect(() => {
    if (!editor) return;

    const syncSelection = () => {
      const { from, to } = editor.state.selection;
      lastSelectionRef.current = { from, to };
    };

    syncSelection();
    editor.on('selectionUpdate', syncSelection);
    editor.on('focus', syncSelection);

    return () => {
      editor.off('selectionUpdate', syncSelection);
      editor.off('focus', syncSelection);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const syncPrimaryBlockState = () => {
      setHasPrimaryListenBlockInEditor(hasPrimaryListenEpisodeBlock(getEditorBlocks()));
    };
    syncPrimaryBlockState();
    editor.on('update', syncPrimaryBlockState);
    return () => {
      editor.off('update', syncPrimaryBlockState);
    };
    // `getEditorBlocks` comes from local closure over `editor`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const currentCount = linkedEpisodeIds.length;
    const previousCount = previousLinkedEpisodeCountRef.current;
    const firstEpisodeId = linkedEpisodeIds[0] || null;
    const currentBlocks = getEditorBlocks();

    if (!linkedEpisodesLifecycleInitializedRef.current) {
      linkedEpisodesLifecycleInitializedRef.current = true;
      previousLinkedEpisodeCountRef.current = currentCount;

      if (currentCount === 0 && hasPrimaryListenEpisodeBlock(currentBlocks)) {
        replaceEditorBlocksIfChanged(removePrimaryListenEpisodeBlocks(currentBlocks));
        return;
      }
      if (currentCount > 0 && hasPrimaryListenEpisodeBlock(currentBlocks)) {
        replaceEditorBlocksIfChanged(
          normalizePrimaryListenEpisodeBlocksForSave(
            syncPrimaryListenEpisodeBlocksEpisode(currentBlocks, firstEpisodeId),
            linkedEpisodeIds
          )
        );
      }
      return;
    }

    if (currentCount === 0) {
      replaceEditorBlocksIfChanged(removePrimaryListenEpisodeBlocks(currentBlocks));
      previousLinkedEpisodeCountRef.current = 0;
      return;
    }

    let nextBlocks = currentBlocks;
    if (previousCount === 0 && !hasPrimaryListenEpisodeBlock(currentBlocks)) {
      nextBlocks = [createPrimaryListenEpisodeBlock(firstEpisodeId), ...currentBlocks];
    }

    nextBlocks = normalizePrimaryListenEpisodeBlocksForSave(
      syncPrimaryListenEpisodeBlocksEpisode(nextBlocks, firstEpisodeId),
      linkedEpisodeIds
    );
    replaceEditorBlocksIfChanged(nextBlocks);
    previousLinkedEpisodeCountRef.current = currentCount;
    // We only react to linked episode ordering/selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, linkedEpisodeIds]);

  function insertStructuredBlock(type: BlogContentBlock['type']) {
    if (!editor) return;
    const block = createBlock(type);
    const selection = lastSelectionRef.current;
    const chain = editor.chain().focus();
    if (selection) {
      chain.insertContentAt({ from: selection.from, to: selection.to }, { type: 'structuredBlock', attrs: { block } });
    } else {
      chain.insertContent({ type: 'structuredBlock', attrs: { block } });
    }
    chain.run();
  }

  function toggleMultiValue(values: string[], setValues: (next: string[]) => void, value: string) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  function togglePanel(key: keyof typeof openPanels) {
    setOpenPanels((current) => ({ ...current, [key]: !current[key] }));
  }

  function setLinkedEpisodeIds(nextEpisodeIds: string[]) {
    setLinkedEpisodes(nextEpisodeIds.map((episodeId, index) => ({ episodeId, isPrimary: index === 0 })));
  }

  function focusVisualEditorAtEnd() {
    if (!editor) return;
    editor.commands.focus('end');
  }

  function handleVisualEditorPaste(event: React.ClipboardEvent<HTMLElement>) {
    if (!editor) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.ProseMirror')) return;
    if (target.closest('input, textarea, select, button, [contenteditable="false"]')) return;

    const text = event.clipboardData.getData('text/plain');
    if (!text) return;

    event.preventDefault();
    editor.chain().focus().insertContent(plainTextToTiptapContent(text) as any).run();
  }

  useEffect(() => {
    setEditorBaseOrigin(window.location.origin.replace(/\/+$/, ''));
  }, []);

  function openSlugEditor() {
    setSlugDraft(postSlug || '');
    setSlugCopyMessage('');
    setSlugEditorOpen(true);
  }

  function closeSlugEditor() {
    setSlugEditorOpen(false);
    setSlugCopyMessage('');
  }

  function applySlugDraft() {
    const normalized = normalizeSlugInput(slugDraft);
    setSlug(normalized);
    setSlugDraft(normalized);
    setSlugEditorOpen(false);
    setSlugCopyMessage('');
  }

  async function copySlugValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSlugCopyMessage('Copied');
      window.setTimeout(() => setSlugCopyMessage(''), 1500);
    } catch {
      setSlugCopyMessage('Copy failed');
      window.setTimeout(() => setSlugCopyMessage(''), 1500);
    }
  }

  return (
    <div className="full-bleed min-h-screen bg-[#f4f5f8] text-[14px] text-[#211b43]">
      <div className="sticky top-0 z-20 border-b border-[#dfe3ef] bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 overflow-x-auto px-3 py-2 whitespace-nowrap lg:overflow-visible">
          <div className="flex shrink-0 items-center gap-3 lg:min-w-0 lg:flex-1">
            <button
              type="button"
              onClick={() => {
                window.location.assign('/admin/blog');
              }}
              className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[12px] font-semibold text-[#2f295d] transition hover:bg-[#f3f5fb]"
            >
              <IconBack />
              Back
            </button>
            <div className="hidden h-6 w-px bg-[#e3e6f2] md:block" />
            {saveMessage || saving || autosaveEnabled ? (
              <div className="text-[12px] text-[#6b7197]">
                {saveMessage || (saving ? 'Saving…' : 'Autosave on')}
              </div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto lg:flex-none lg:overflow-visible">
            <div className="flex justify-start lg:justify-center">
              <InlineToolbar editor={editor} />
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 lg:flex-1 lg:justify-end">
            <select
              className="h-7 rounded-md border border-[#dfe3ef] bg-white px-2 text-[12px] font-semibold text-[#2f295d] outline-none transition hover:bg-[#f4f6fc]"
              defaultValue=""
              onChange={(event) => {
                const type = event.currentTarget.value as BlogContentBlock['type'];
                if (!type) return;
                insertStructuredBlock(type);
                event.currentTarget.value = '';
              }}
              aria-label="Structured blocks"
              title="Structured blocks"
            >
              <option value="">Structured blocks</option>
              {STRUCTURED_BLOCK_OPTIONS.map((option) => (
                <option key={option.type} value={option.type}>{option.label}</option>
              ))}
            </select>
            <div className="inline-flex h-7 items-center rounded-full border border-[#dfe3ef] bg-white px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#5f668d]">
              {bodyWordCount} words
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#dfe3ef] bg-white text-[12px] font-semibold text-[#2f295d] transition hover:bg-[#f4f6fc]"
              aria-label={sidebarOpen ? 'Hide settings' : 'Show settings'}
              title={sidebarOpen ? 'Hide settings' : 'Show settings'}
            >
              <IconSidebar />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#dfe3ef] bg-white text-[12px] font-semibold text-[#2f295d] transition hover:bg-[#f4f6fc]"
              onClick={() => void openPreview()}
              aria-label="Preview post"
              title="Preview post"
            >
              <IconPreview />
            </button>
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center rounded-md bg-[#3558ff] px-3.5 text-[12px] font-bold text-white transition hover:bg-[#2748ea]"
              onClick={() => void persist(false)}
              disabled={saving}
            >
              {saving ? 'Saving…' : effectiveStatus === 'published' ? 'Update' : effectiveStatus === 'scheduled' ? 'Schedule' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className={`grid min-h-[calc(100vh-3rem)] grid-cols-1 items-start xl:h-[calc(100vh-3rem)] xl:min-h-0 xl:overflow-hidden ${sidebarOpen ? 'xl:grid-cols-[minmax(0,1fr)_clamp(360px,36vw,520px)]' : ''}`}>
        <div className="flex min-h-0 flex-col xl:h-full xl:overflow-y-auto">
          <div className="flex-1 px-3 py-4 md:px-5">
            <div className={`mx-auto flex flex-col ${sidebarOpen ? 'max-w-[860px]' : 'max-w-[1180px]'}`}>
              <input
                ref={featuredQuickUploadInputRef}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={handleFeaturedQuickFileSelection}
              />
              <button
                type="button"
                className={`group mb-4 overflow-hidden rounded-2xl border border-[#dfe3ef] bg-white text-left shadow-[0_8px_30px_rgba(24,31,68,0.06)] transition hover:border-[#c7cfe8] ${
                  selectedFeaturedAssetUrl ? 'block' : 'hidden'
                }`}
                onClick={() => featuredQuickUploadInputRef.current?.click()}
                title="Click to replace featured image"
              >
                <div className="relative aspect-[16/8] w-full bg-[#f3f5fb]">
                  {selectedFeaturedAssetUrl ? (
                    <Image
                      src={selectedFeaturedAssetUrl}
                      alt={selectedFeaturedAsset?.alt_text_default || title || 'Featured image'}
                      fill
                      sizes="(max-width: 1200px) 100vw, 860px"
                      className="object-cover"
                    />
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-4 py-3 text-xs font-semibold text-white/90">
                    Featured image preview. Click to replace.
                  </div>
                </div>
              </button>
              <input
                className={`w-full border-0 bg-transparent px-0 text-[2.15rem] font-black tracking-tight outline-none placeholder:text-[#a6acbe] md:text-[2.4rem] ${
                  title.trim() ? 'text-[#231d46]' : 'text-[#9ca3b7]'
                }`}
                placeholder="Add post title..."
                value={title}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
              <div className="relative mt-4 flex flex-wrap items-start gap-3 text-[12px] text-[#6a7094]">
                <textarea
                  className="min-h-[3rem] min-w-[180px] flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[13px] leading-6 text-[#656d8f] outline-none placeholder:text-[#9ea7c0]"
                  placeholder="Post excerpt or dek"
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.currentTarget.value)}
                />
              </div>

              <div
                className="blog-editor-preview mt-6 min-h-[460px] cursor-text px-0 py-2"
                onMouseDown={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (target?.closest('.ProseMirror')) return;
                  event.preventDefault();
                  focusVisualEditorAtEnd();
                }}
                onPasteCapture={handleVisualEditorPaste}
              >
                <EditorContent editor={editor} />
              </div>

            </div>
          </div>
        </div>

        {sidebarOpen ? (
          <aside className="self-start border-t border-[#dfe3ef] bg-[#fbfbfd] px-3 py-3 xl:h-full xl:self-stretch xl:overflow-y-auto xl:border-l xl:border-t-0">
            <div className="space-y-1">
              <SidebarSection title="URL" open={openPanels.url} onToggle={() => togglePanel('url')}>
                <div className="space-y-2.5">
                  <div className="rounded-[14px] border border-[#e5e7f0] bg-[#f3f4f8] px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-words text-[0.92rem] font-semibold leading-[1.3] text-[#1f1d2f]">
                        <span className="font-medium text-[#666d8d]">{postUrlPrefix}</span>
                        <span className="font-extrabold text-[#1f1d2f]">{postSlug || 'your-post-slug'}</span>
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-[#5e6489] transition hover:border-[#d9ddec] hover:bg-white hover:text-[#2d2a4e]"
                        onClick={openSlugEditor}
                        aria-label="Edit slug"
                        title="Edit slug"
                      >
                        <IconPencil />
                      </button>
                    </div>
                  </div>
                  <p className="text-[13px] text-[#606789]">The URL slug for your post.</p>
                </div>

                {slugEditorOpen ? (
                  <div className="rounded-[14px] border border-[#d4d9e8] bg-[#f6f7fb] p-3.5 shadow-[0_8px_20px_rgba(23,30,66,0.08)]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-semibold text-[#2f295d]">Edit Slug:</p>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#687092] transition hover:bg-white hover:text-[#2f295d]"
                        onClick={closeSlugEditor}
                        aria-label="Close slug editor"
                        title="Close"
                      >
                        <IconClose />
                      </button>
                    </div>
                    <div className="relative mt-2.5">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-[#8187a6]">/</span>
                      <input
                        className="input h-12 rounded-xl border-[#3558ff] bg-white !pl-7 !pr-12 text-[1rem] font-medium"
                        value={slugDraft}
                        onChange={(event) => setSlugDraft(normalizeSlugInput(event.currentTarget.value))}
                        placeholder="post-slug"
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            applySlugDraft();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            closeSlugEditor();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md border border-[#d7dcef] bg-white text-[#61698d] transition hover:bg-[#f4f6fc] hover:text-[#2f295d]"
                        onClick={() => void copySlugValue(`/${normalizeSlugInput(slugDraft)}`)}
                        aria-label="Copy slug"
                        title="Copy slug"
                      >
                        <IconCopy />
                      </button>
                    </div>
                    <div className="mt-3.5 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-[#d5daea] bg-white px-3 py-1.5 text-xs font-semibold text-[#33305b] transition hover:bg-[#f4f6fc]"
                        onClick={closeSlugEditor}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-[#3558ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2748ea] disabled:opacity-60"
                        onClick={applySlugDraft}
                        disabled={!slugDraft.trim()}
                      >
                        Save slug
                      </button>
                    </div>
                    {slugCopyMessage ? (
                      <p className="mt-2 text-xs font-semibold text-[#5f668d]">{slugCopyMessage}</p>
                    ) : null}
                  </div>
                ) : null}
              </SidebarSection>

              <SidebarSection title="Post Settings" open={openPanels.settings} onToggle={() => togglePanel('settings')}>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#2b3150]">
                  <input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.currentTarget.checked)} />
                  Featured post
                </label>
                <div>
                  <label className="label text-sm">Date</label>
                  <input
                    className="input rounded-xl border-[#dfe3ef]"
                    type="datetime-local"
                    value={publishAt}
                    onChange={(event) => {
                      setPublishAt(event.currentTarget.value);
                      if (status === 'archived') {
                        setStatus('published');
                      }
                    }}
                  />
                  <p className="mt-1 text-xs text-[#7b819f]">
                    {publishAt
                      ? temporalStatus === 'scheduled'
                        ? 'Future date: this post will be scheduled.'
                        : 'Past/current date: this post will be published.'
                      : status === 'draft'
                        ? 'Leave empty to keep this as a draft.'
                        : 'Add a date to publish this post.'}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div>
                    <label className="label text-sm">Status</label>
                    <select
                      className="input rounded-xl border-[#dfe3ef]"
                      value={statusControlValue}
                      onChange={(event) => setStatus(event.currentTarget.value as BlogPostWriteInput['status'])}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                    {statusControlValue === 'published' && temporalStatus === 'scheduled' ? (
                      <p className="mt-1 text-xs text-[#7b819f]">With this date, status will publish as scheduled.</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="label text-sm">Author</label>
                    <select className="input rounded-xl border-[#dfe3ef]" value={authorId} onChange={(event) => setAuthorId(event.currentTarget.value)}>
                      {authorOptions.map((author) => (
                        <option key={author.id} value={author.id}>{author.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2.5 sm:col-span-2 xl:col-span-1">
                    <label className="label text-sm">Featured Image</label>
                    <ImageAssetPicker
                      selectedAsset={selectedFeaturedAsset}
                      onUploadFile={uploadFeaturedImage}
                      onOpenLibrary={() => setMediaPickerOpen(true)}
                      onRemove={handleRemoveFeaturedImage}
                      uploadMessage={featuredUploadMessage}
                      recommendedText="Recommended image size: 720 x 450 pixels"
                    />
                    {selectedFeaturedAsset ? (
                      <div className="space-y-2 rounded-xl border border-[#dfe3ef] bg-white p-2.5">
                        <input
                          className="input rounded-xl border-[#dfe3ef] !px-2 !py-1.5 text-xs"
                          value={featuredAssetAlt}
                          onChange={(event) => setFeaturedAssetAlt(event.currentTarget.value)}
                          onBlur={() => void persistFeaturedImageMeta()}
                          placeholder="Alt text"
                        />
                        <input
                          className="input rounded-xl border-[#dfe3ef] !px-2 !py-1.5 text-xs"
                          value={featuredAssetCaption}
                          onChange={(event) => setFeaturedAssetCaption(event.currentTarget.value)}
                          onBlur={() => void persistFeaturedImageMeta()}
                          placeholder="Caption"
                        />
                        <input
                          className="input rounded-xl border-[#dfe3ef] !px-2 !py-1.5 text-xs"
                          value={featuredAssetCredit}
                          onChange={(event) => setFeaturedAssetCredit(event.currentTarget.value)}
                          onBlur={() => void persistFeaturedImageMeta()}
                          placeholder="Credit/source"
                        />
                        {featuredAssetMetaMessage ? (
                          <p className={`text-xs ${featuredAssetMetaMessage === 'Image details saved.' ? 'text-[#3e7a50]' : 'text-[#9a2b2b]'}`}>
                            {featuredAssetMetaMessage}
                          </p>
                        ) : null}
                        {featuredAssetMetaSaving ? (
                          <p className="text-xs text-[#7b819f]">Saving image details…</p>
                        ) : null}
                      </div>
                    ) : null}
                    <MediaLibraryPickerModal
                      open={mediaPickerOpen}
                      onClose={() => setMediaPickerOpen(false)}
                      onSelect={handleMediaLibraryPick}
                    />
                  </div>
                </div>
                {/* Archive / Restore / Soft-delete buttons removed from editor sidebar.
                   API routes are still available at:
                     POST /api/admin/blog/posts/[id]/archive
                     POST /api/admin/blog/posts/[id]/restore
                     DELETE /api/admin/blog/posts/[id]
                */}
              </SidebarSection>

              <SidebarSection title="Taxonomy" open={openPanels.taxonomy} onToggle={() => togglePanel('taxonomy')}>
                <div>
                  <label className="label text-sm">Primary category</label>
                  <select className="input rounded-xl border-[#dfe3ef]" value={primaryCategoryId} onChange={(event) => setPrimaryCategoryId(event.currentTarget.value)}>
                    <option value="">None</option>
                    {categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <div className="space-y-4">
                  {taxonomyGroups.map(({ label, items, values, setter }) => (
                    <div key={label}>
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#72789b]">{label}</p>
                      <div className="max-h-44 space-y-2 overflow-auto rounded-xl border border-[#e2e6f2] bg-white p-3">
                        {items.length ? items.map((item) => (
                          <label key={item.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={values.includes(item.id)}
                              onChange={() => toggleMultiValue(values, setter, item.id)}
                            />
                            {item.name}
                          </label>
                        )) : <p className="text-xs text-[#7b819f]">No items yet.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </SidebarSection>

              <SidebarSection title="Episodes & Related" open={openPanels.episodes} onToggle={() => togglePanel('episodes')}>
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
                    The first linked episode powers the in-canvas primary card.
                  </p>
                </div>
                <SearchableOrderedMultiSelect
                  label="Linked episode IDs"
                  options={episodeSelectOptions}
                  selectedIds={linkedEpisodeIds}
                  onChange={setLinkedEpisodeIds}
                  buttonLabel="Select episodes"
                  searchPlaceholder="Search episodes by title or ID"
                  emptySearchLabel="No episodes match your search."
                  selectedListLabel="Selected episodes (save order)"
                  firstItemLabel="Primary episode"
                  emptySelectionLabel="No linked episodes selected."
                />
                <SearchableOrderedMultiSelect
                  label="Manual related post IDs"
                  options={relatedPostSelectOptions}
                  selectedIds={relatedPostIds}
                  onChange={setRelatedPostIds}
                  buttonLabel="Select posts"
                  searchPlaceholder="Search posts by title or ID"
                  emptySearchLabel="No posts match your search."
                  selectedListLabel="Selected posts (save order)"
                  emptySelectionLabel="No manual related posts selected."
                />
              </SidebarSection>

              <SidebarSection title="SEO" open={openPanels.seo} onToggle={() => togglePanel('seo')}>
                <div className="space-y-3">
                  <div>
                    <label className="label text-sm">SEO title</label>
                    <input className="input rounded-xl border-[#dfe3ef]" value={seoTitle} onChange={(event) => setSeoTitle(event.currentTarget.value)} />
                  </div>
                  <div>
                    <label className="label text-sm">SEO description</label>
                    <textarea className="input min-h-24 rounded-xl border-[#dfe3ef]" value={seoDescription} onChange={(event) => setSeoDescription(event.currentTarget.value)} />
                  </div>
                  <div>
                    <label className="label text-sm">Focus keyword</label>
                    <input className="input rounded-xl border-[#dfe3ef]" value={focusKeyword} onChange={(event) => setFocusKeyword(event.currentTarget.value)} />
                  </div>
                  <div>
                    <label className="label text-sm">Canonical URL</label>
                    <input className="input rounded-xl border-[#dfe3ef]" value={canonicalUrl} onChange={(event) => setCanonicalUrl(event.currentTarget.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <label className="label text-sm">Social title</label>
                      <input className="input rounded-xl border-[#dfe3ef]" value={socialTitle} onChange={(event) => setSocialTitle(event.currentTarget.value)} />
                    </div>
                    <div>
                      <label className="label text-sm">Social description</label>
                      <input className="input rounded-xl border-[#dfe3ef]" value={socialDescription} onChange={(event) => setSocialDescription(event.currentTarget.value)} />
                    </div>
                    <div>
                      <label className="label text-sm">OG image asset ID</label>
                      <input className="input rounded-xl border-[#dfe3ef]" value={ogImageId} onChange={(event) => setOgImageId(event.currentTarget.value)} />
                    </div>
                    <div>
                      <label className="label text-sm">Schema type</label>
                      <input className="input rounded-xl border-[#dfe3ef]" value={schemaType} onChange={(event) => setSchemaType(event.currentTarget.value)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm font-semibold text-[#2b3150]">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={noindex} onChange={(event) => setNoindex(event.currentTarget.checked)} />
                      Noindex
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={nofollow} onChange={(event) => setNofollow(event.currentTarget.checked)} />
                      Nofollow
                    </label>
                  </div>
                </div>
              </SidebarSection>

              <SidebarSection title="Revisions" open={openPanels.revisions} onToggle={() => togglePanel('revisions')}>
                <div className="space-y-2">
                  {initialPost.revisions?.length ? initialPost.revisions.map((revision: any) => (
                    <div key={revision.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e0e4f1] bg-white px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-[#231d46]">Revision {revision.revision_number}</p>
                        <p className="text-xs text-[#7b819f]">{new Date(revision.created_at).toLocaleString('en-GB')}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg bg-[#f3f5fb] px-3 py-1.5 text-xs font-bold text-[#2f295d]"
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/admin/blog/posts/${initialPost.id}/revisions/${revision.id}/restore`, { method: 'POST' });
                            if (!response.ok) {
                              const data = await response.json().catch(() => ({}));
                              window.alert(data?.error || 'Failed to restore revision.');
                              return;
                            }
                            setSaveMessage('Revision restored.');
                            router.refresh();
                          } catch {
                            window.alert('Failed to restore revision.');
                          }
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  )) : (
                    <p className="text-sm text-[#7b819f]">No revisions yet.</p>
                  )}
                </div>
              </SidebarSection>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
