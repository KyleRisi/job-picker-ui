const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

function isYouTubeHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  return normalized === 'youtu.be' || normalized.endsWith('.youtu.be') || normalized === 'youtube.com' || normalized.endsWith('.youtube.com');
}

function normalizeInputUrl(input: string) {
  const value = input.trim();
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    if (/^(www\.)?(youtube\.com|youtu\.be)\//i.test(value)) {
      try {
        return new URL(`https://${value}`);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeVideoId(input: string | null | undefined) {
  const value = `${input || ''}`.trim();
  return YOUTUBE_ID_REGEX.test(value) ? value : null;
}

export function isYouTubeUrl(input: string) {
  const url = normalizeInputUrl(input);
  if (!url) return false;
  return isYouTubeHost(url.hostname);
}

export function extractYouTubeVideoId(input: string): string | null {
  const url = normalizeInputUrl(input);
  if (!url || !isYouTubeHost(url.hostname)) return null;

  const hostname = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
    return normalizeVideoId(segments[0] || null);
  }

  if (segments[0] === 'watch') {
    return normalizeVideoId(url.searchParams.get('v'));
  }

  if (segments[0] === 'shorts' || segments[0] === 'live' || segments[0] === 'embed' || segments[0] === 'v') {
    return normalizeVideoId(segments[1] || null);
  }

  return normalizeVideoId(url.searchParams.get('v'));
}

export function toYouTubeEmbedUrl(input: string): string | null {
  const id = extractYouTubeVideoId(input);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}`;
}
