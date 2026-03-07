import { z } from 'zod';

export const BLOG_POST_STATUSES = ['draft', 'scheduled', 'published', 'archived'] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_ANALYTICS_EVENT_TYPES = [
  'pageview',
  'scroll_depth',
  'cta_click',
  'platform_click',
  'patreon_click',
  'listen_start',
  'search_result_click'
] as const;
export type BlogAnalyticsEventType = (typeof BLOG_ANALYTICS_EVENT_TYPES)[number];

export const richTextMarkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bold') }),
  z.object({ type: z.literal('italic') }),
  z.object({ type: z.literal('underline') }),
  z.object({ type: z.literal('strike') }),
  z.object({ type: z.literal('code') }),
  z.object({
    type: z.literal('color'),
    value: z.string().min(1)
  }),
  z.object({
    type: z.literal('font_size'),
    value: z.string().min(1)
  }),
  z.object({
    type: z.literal('link'),
    href: z.string().min(1),
    target: z.enum(['_blank', '_self']).optional(),
    rel: z.string().optional()
  })
]);

export type RichTextMark = z.infer<typeof richTextMarkSchema>;

export const richTextInlineNodeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    text: z.string(),
    marks: z.array(richTextMarkSchema).default([])
  }),
  z.object({
    type: z.literal('hard_break')
  })
]);

export type RichTextInlineNode = z.infer<typeof richTextInlineNodeSchema>;

const richTextSchema = z.array(richTextInlineNodeSchema);

const blockBaseSchema = z.object({
  id: z.string().min(1)
});

const textAlignSchema = z.enum(['left', 'center', 'right']).default('left');

const paragraphBlockSchema = blockBaseSchema.extend({
  type: z.literal('paragraph'),
  align: textAlignSchema,
  content: richTextSchema.default([])
});

const headingBlockSchema = blockBaseSchema.extend({
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  align: textAlignSchema,
  content: richTextSchema.default([])
});

const listItemSchema = z.object({
  id: z.string().min(1),
  content: richTextSchema.default([])
});

const listBlockSchema = blockBaseSchema.extend({
  type: z.literal('list'),
  style: z.enum(['bullet', 'ordered']),
  items: z.array(listItemSchema).default([])
});

const blockquoteBlockSchema = blockBaseSchema.extend({
  type: z.literal('blockquote'),
  quote: richTextSchema.default([]),
  attribution: z.string().default('')
});

const ctaButtonBlockSchema = blockBaseSchema.extend({
  type: z.literal('cta_button'),
  label: z.string().default('Listen now'),
  href: z.string().default(''),
  align: textAlignSchema.default('center'),
  variant: z.enum(['primary', 'secondary']).default('primary'),
  note: z.string().default('')
});

const imageBlockSchema = blockBaseSchema.extend({
  type: z.literal('image'),
  assetId: z.string().nullable().default(null),
  src: z.string().optional(),
  alt: z.string().default(''),
  caption: z.string().default(''),
  credit: z.string().default(''),
  size: z.enum(['narrow', 'wide', 'full']).default('wide')
});

const videoEmbedBlockSchema = blockBaseSchema.extend({
  type: z.literal('video_embed'),
  url: z.string().default(''),
  title: z.string().default('')
});

const youtubeEmbedBlockSchema = blockBaseSchema.extend({
  type: z.literal('youtube_embed'),
  url: z.string().default(''),
  title: z.string().default(''),
  size: z.enum(['narrow', 'wide', 'full']).default('wide')
});

const podcastPlayerBlockSchema = blockBaseSchema.extend({
  type: z.literal('podcast_player'),
  episodeId: z.string().nullable().default(null),
  titleOverride: z.string().default('')
});

const tableBlockSchema = blockBaseSchema.extend({
  type: z.literal('table'),
  headers: z.array(z.string()).default([]),
  rows: z.array(z.array(z.string())).default([])
});

const dividerBlockSchema = blockBaseSchema.extend({
  type: z.literal('divider')
});

const codeBlockSchema = blockBaseSchema.extend({
  type: z.literal('code_block'),
  language: z.string().default(''),
  code: z.string().default('')
});

const listenEpisodeBlockSchema = blockBaseSchema.extend({
  type: z.literal('listen_episode'),
  episodeId: z.string().nullable().default(null),
  heading: z.string().default('Listen to the episode'),
  description: z.string().default(''),
  platform: z.enum(['spotify', 'apple', 'patreon', 'generic']).default('generic')
});

const resourceItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().default(''),
  href: z.string().default(''),
  description: z.string().default('')
});

const resourcesBlockSchema = blockBaseSchema.extend({
  type: z.literal('resources'),
  heading: z.string().default('Further resources'),
  items: z.array(resourceItemSchema).default([])
});

const relatedEpisodesBlockSchema = blockBaseSchema.extend({
  type: z.literal('related_episodes'),
  heading: z.string().default('Related episodes'),
  episodeIds: z.array(z.string()).default([])
});

const relatedPostsBlockSchema = blockBaseSchema.extend({
  type: z.literal('related_posts'),
  heading: z.string().default('Related posts'),
  postIds: z.array(z.string()).default([])
});

const faqItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().default(''),
  answer: richTextSchema.default([])
});

const faqBlockSchema = blockBaseSchema.extend({
  type: z.literal('faq'),
  heading: z.string().default('FAQ'),
  items: z.array(faqItemSchema).default([])
});

export const blogContentBlockSchema = z.discriminatedUnion('type', [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  blockquoteBlockSchema,
  ctaButtonBlockSchema,
  imageBlockSchema,
  videoEmbedBlockSchema,
  youtubeEmbedBlockSchema,
  podcastPlayerBlockSchema,
  tableBlockSchema,
  dividerBlockSchema,
  codeBlockSchema,
  listenEpisodeBlockSchema,
  resourcesBlockSchema,
  relatedEpisodesBlockSchema,
  relatedPostsBlockSchema,
  faqBlockSchema
]);

export type BlogContentBlock = z.infer<typeof blogContentBlockSchema>;
export const blogContentDocumentSchema = z.array(blogContentBlockSchema);
export type BlogContentDocument = z.infer<typeof blogContentDocumentSchema>;

export const linkedEpisodeSchema = z.object({
  episodeId: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false)
});

export const seoFieldsSchema = z.object({
  seoTitle: z.string().nullable().default(null),
  seoDescription: z.string().nullable().default(null),
  socialTitle: z.string().nullable().default(null),
  socialDescription: z.string().nullable().default(null),
  canonicalUrl: z.string().nullable().default(null),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  focusKeyword: z.string().nullable().default(null),
  schemaType: z.string().nullable().default('BlogPosting'),
  ogImageId: z.string().nullable().default(null)
});

export const blogPostWriteSchema = z.object({
  title: z.string().min(1).max(180),
  slug: z.string().min(1).max(180),
  status: z.enum(BLOG_POST_STATUSES).default('draft'),
  excerpt: z.string().nullable().default(null),
  contentJson: blogContentDocumentSchema.default([]),
  featuredImageId: z.string().nullable().default(null),
  authorId: z.string().min(1),
  publishedAt: z.string().datetime().nullable().default(null),
  scheduledAt: z.string().datetime().nullable().default(null),
  archivedAt: z.string().datetime().nullable().default(null),
  isFeatured: z.boolean().default(false),
  primaryCategoryId: z.string().nullable().default(null),
  taxonomy: z.object({
    categoryIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),
    seriesIds: z.array(z.string()).default([]),
    topicClusterIds: z.array(z.string()).default([]),
    labelIds: z.array(z.string()).default([])
  }),
  linkedEpisodes: z.array(linkedEpisodeSchema).default([]),
  relatedPostIds: z.array(z.string()).default([]),
  seo: seoFieldsSchema.default({}),
  revisionReason: z.string().optional().default('')
});

export type BlogPostWriteInput = z.infer<typeof blogPostWriteSchema>;

export const taxonomyTermWriteSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(180),
  description: z.string().optional().default(''),
  parentId: z.string().nullable().optional(),
  pillarPostId: z.string().nullable().optional(),
  bio: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  imageAssetId: z.string().nullable().optional()
});

export const blogAnalyticsEventInputSchema = z.object({
  eventType: z.enum(BLOG_ANALYTICS_EVENT_TYPES),
  postId: z.string().nullable().optional(),
  episodeId: z.string().nullable().optional(),
  path: z.string().min(1),
  referrer: z.string().optional().default(''),
  searchQuery: z.string().optional().default(''),
  metadata: z.record(z.any()).optional().default({})
});

export type BlogAnalyticsEventInput = z.infer<typeof blogAnalyticsEventInputSchema>;
