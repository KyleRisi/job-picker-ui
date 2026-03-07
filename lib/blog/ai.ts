import { env } from '@/lib/env';
import { trackMixpanelServer } from '@/lib/mixpanel-server';

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

function getPromptText(context: Record<string, unknown>): string {
  const candidates = ['prompt', 'text', 'query', 'input'];
  for (const key of candidates) {
    const value = context[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function getBlogAiProviderConfig() {
  if (!env.blogAiProvider || !env.blogAiApiKey) return null;
  return {
    provider: env.blogAiProvider,
    apiKeyPresent: true
  };
}

export async function generateBlogAiSuggestion(_task: BlogAiTask, _context: Record<string, unknown>): Promise<BlogAiSuggestion | null> {
  const startedAt = Date.now();
  const promptText = getPromptText(_context);
  void trackMixpanelServer('Launch AI');
  void trackMixpanelServer('AI Prompt Sent and Prompt Text', {
    'Prompt Text': promptText
  });

  const provider = getBlogAiProviderConfig();
  if (!provider) {
    void trackMixpanelServer('AI Response Sent', {
      'API Cost': null,
      'API Tokens Used': null,
      'API Response Time': Date.now() - startedAt
    });
    return null;
  }

  // Provider integration is intentionally behind config and always returns editable draft content.
  const result = {
    task: _task,
    content: '',
    provider: provider.provider
  };

  void trackMixpanelServer('AI Response Sent', {
    'API Cost': null,
    'API Tokens Used': null,
    'API Response Time': Date.now() - startedAt
  });

  return result;
}
