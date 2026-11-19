export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/** Formats seconds into HH:MM:SS or MM:SS */
export function formatTime(seconds: number, forceHours = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) return forceHours ? '00:00:00' : '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0 || forceHours) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/** Formats seconds with tenths (MM:SS.d) for precise clip editing */
export function formatTimePrecise(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}.${tenths}`;
  return `${pad(m)}:${pad(s)}.${tenths}`;
}

export function formatDurationHuman(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[i]}`;
}

export interface ParsedYouTubeUrl {
  valid: boolean;
  videoId?: string;
  kind?: 'standard' | 'short-link' | 'shorts' | 'live';
  embedUrl?: string;
  watchUrl?: string;
  thumbnailUrl?: string;
  hqThumbnailUrl?: string;
}

export function parseYouTubeUrl(input: string): ParsedYouTubeUrl {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false };
  try {
    const normalized = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    let videoId: string | null = null;
    let kind: ParsedYouTubeUrl['kind'];

    if (host === 'youtu.be') {
      const seg = url.pathname.split('/').filter(Boolean)[0];
      if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
        videoId = seg;
        kind = 'short-link';
      }
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'gaming.youtube.com'
    ) {
      if (url.pathname === '/watch') {
        const v = url.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) {
          videoId = v;
          kind = 'standard';
        }
      } else if (url.pathname.startsWith('/shorts/')) {
        const seg = url.pathname.split('/').filter(Boolean)[1];
        if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
          videoId = seg;
          kind = 'shorts';
        }
      } else if (url.pathname.startsWith('/live/')) {
        const seg = url.pathname.split('/').filter(Boolean)[1];
        if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
          videoId = seg;
          kind = 'live';
        }
      } else if (url.pathname.startsWith('/embed/')) {
        const seg = url.pathname.split('/').filter(Boolean)[1];
        if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
          videoId = seg;
          kind = 'standard';
        }
      } else if (url.pathname.startsWith('/v/')) {
        const seg = url.pathname.split('/').filter(Boolean)[1];
        if (seg && /^[a-zA-Z0-9_-]{11}$/.test(seg)) {
          videoId = seg;
          kind = 'standard';
        }
      }
    }

    if (!videoId || !kind) return { valid: false };
    return {
      valid: true,
      videoId,
      kind,
      // Use youtube-nocookie.com to avoid 3rd-party cookie blocks across modern browsers
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      hqThumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return { valid: false };
  }
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64) || 'clipforge_clip';
}
