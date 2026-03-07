import { env } from '@/lib/env';

export type BlogAiTask =
  | 'draft_from_episode'
  | 'seo_title'
  | 'meta_description'
  | 'excerpt'
  | 'keyword_suggestions'
  | 'internal_link_suggestions'
  | 'faq_candidates';

export type BlogAiSuggestion = {
  task: BlogAiTask;
  content: string;
  provider: string;
};

export function getBlogAiProviderConfig() {
  if (!env.blogAiProvider || !env.blogAiApiKey) return null;
  return {
    provider: env.blogAiProvider,
    apiKeyPresent: true
  };
}

export async function generateBlogAiSuggestion(_task: BlogAiTask, _context: Record<string, unknown>): Promise<BlogAiSuggestion | null> {
  const provider = getBlogAiProviderConfig();
  if (!provider) return null;

  // Provider integration is intentionally behind config and always returns editable draft content.
  return {
    task: _task,
    content: '',
    provider: provider.provider
  };
}
