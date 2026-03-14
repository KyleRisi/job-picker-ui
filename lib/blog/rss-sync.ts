import { XMLParser } from 'fast-xml-parser';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { slugifyBlogText } from './content';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return `${value}`.trim();
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return `${(value as Record<string, unknown>)['#text'] || ''}`.trim();
  }
  return '';
}

function htmlToPlainText(input: string) {
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

type RssEpisode = {
  rss_guid: string;
  title: string;
  slug: string;
  description_plain: string;
  description_html: string;
  published_at: string | null;
  audio_url: string;
  artwork_url: string | null;
  transcript: string;
  show_notes: string;
  last_synced_at: string;
};

export type EpisodeRssSyncMode = 'auto' | 'full' | 'metadata_without_content';

type SyncPodcastEpisodesOptions = {
  mode?: EpisodeRssSyncMode;
  episodeId?: string;
};

function parseFeedItem(item: Record<string, unknown>, usedSlugs: Set<string>): RssEpisode {
  const title = getText(item.title) || 'Untitled episode';
  const guid = getText(item.guid) || getText((item.enclosure as { url?: unknown } | undefined)?.url) || title;
  const htmlDescription = decodeEntities(getText(item['content:encoded']) || getText(item.description));
  const plainDescription = htmlToPlainText(htmlDescription);
  const audioUrl = getText((item.enclosure as { url?: unknown } | undefined)?.url);
  const imageNode = item['itunes:image'];
  const artworkUrl =
    (typeof imageNode === 'object' && imageNode ? getText((imageNode as { href?: unknown }).href) : '') ||
    getText((item['media:content'] as { url?: unknown } | undefined)?.url) ||
    null;
  const transcript = getText(item.transcript);
  const showNotes = getText(item['content:encoded']) || getText(item.description);
  const publishedAtRaw = getText(item.pubDate);
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw).toISOString() : null;
  let slug = slugifyBlogText(title);
  if (usedSlugs.has(slug)) {
    slug = `${slug}-${usedSlugs.size + 1}`;
  }
  usedSlugs.add(slug);
  return {
    rss_guid: guid,
    title,
    slug,
    description_plain: plainDescription,
    description_html: htmlDescription,
    published_at: publishedAt,
    audio_url: audioUrl,
    artwork_url: artworkUrl,
    transcript,
    show_notes: showNotes,
    last_synced_at: new Date().toISOString()
  };
}

function buildExistingEpisodeUpdatePayload(episode: RssEpisode, mode: EpisodeRssSyncMode) {
  if (mode === 'full') {
    return {
      ...episode,
      is_visible: true,
      is_archived: false
    };
  }

  if (mode === 'metadata_without_content') {
    return {
      published_at: episode.published_at,
      audio_url: episode.audio_url,
      artwork_url: episode.artwork_url,
      last_synced_at: episode.last_synced_at
    };
  }

  return {
    published_at: episode.published_at,
    audio_url: episode.audio_url,
    artwork_url: episode.artwork_url,
    last_synced_at: episode.last_synced_at
  };
}

export async function syncPodcastEpisodes(options: SyncPodcastEpisodesOptions = {}) {
  const mode = options.mode || 'auto';
  const supabase = createSupabaseAdminClient();
  const startedAt = new Date().toISOString();
  const { data: logRow, error: logError } = await supabase
    .from('episode_sync_logs')
    .insert({
      started_at: startedAt,
      status: 'running'
    })
    .select('*')
    .single();
  if (logError) throw logError;

  try {
    const response = await fetch(env.podcastRssFeedUrl || 'https://feeds.simplecast.com/Sci7Fqgp', {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml;q=0.9'
      },
      next: {
        revalidate: 0
      }
    });
    if (!response.ok) {
      throw new Error(`RSS sync failed with ${response.status}`);
    }
    const xml = await response.text();
    const parsed = parser.parse(xml) as {
      rss?: { channel?: { item?: Record<string, unknown> | Array<Record<string, unknown>> } };
    };
    const items = toArray(parsed.rss?.channel?.item);
    const usedSlugs = new Set<string>();
    const episodes = items.map((item) => parseFeedItem(item, usedSlugs));

    let targetRssGuid: string | null = null;
    if (options.episodeId) {
      const { data: existingEpisode, error: existingEpisodeError } = await supabase
        .from('podcast_episodes')
        .select('id, rss_guid')
        .eq('id', options.episodeId)
        .maybeSingle();
      if (existingEpisodeError) throw existingEpisodeError;
      if (!existingEpisode) {
        throw new Error('Episode not found.');
      }
      targetRssGuid = existingEpisode.rss_guid;
    }

    const episodesToSync = targetRssGuid
      ? episodes.filter((item) => item.rss_guid === targetRssGuid)
      : episodes;

    if (targetRssGuid && episodesToSync.length === 0) {
      throw new Error('Episode was not found in the current RSS feed.');
    }

    let recordsAdded = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;
    const errors: string[] = [];

    for (const episode of episodesToSync) {
      try {
        const { data: existing, error: existingError } = await supabase
          .from('podcast_episodes')
          .select('id, slug')
          .eq('rss_guid', episode.rss_guid)
          .maybeSingle();
        if (existingError) throw existingError;

        if (!existing) {
          const payload = {
            ...episode,
            is_visible: true,
            is_archived: false
          };
          const insert = await supabase.from('podcast_episodes').insert(payload);
          if (insert.error) throw insert.error;
          recordsAdded += 1;
          continue;
        }

        const payload = buildExistingEpisodeUpdatePayload(episode, mode);
        const update = await supabase.from('podcast_episodes').update(payload).eq('id', existing.id);
        if (update.error) throw update.error;
        recordsUpdated += 1;
      } catch (episodeError) {
        errors.push(`${episode.title}: ${episodeError instanceof Error ? episodeError.message : 'Unknown error'}`);
        recordsSkipped += 1;
      }
    }

    const syncResult = await supabase
      .from('episode_sync_logs')
      .update({
        completed_at: new Date().toISOString(),
        status: errors.length ? 'failed' : 'succeeded',
        records_added: recordsAdded,
        records_updated: recordsUpdated,
        records_skipped: recordsSkipped,
        error_summary: errors.length ? errors.join('; ') : ''
      })
      .eq('id', logRow.id);
    if (syncResult.error) throw syncResult.error;

    return {
      recordsAdded,
      recordsUpdated,
      recordsSkipped,
      mode
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSS sync failed.';
    await supabase
      .from('episode_sync_logs')
      .update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        error_summary: message
      })
      .eq('id', logRow.id);
    throw error;
  }
}
