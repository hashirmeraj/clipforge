import React, { useState } from 'react';
import {
  Youtube,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Upload,
  Info,
  Play,
  Image as ImageIcon,
  Video,
  ShieldCheck,
} from 'lucide-react';
import { parseYouTubeUrl } from '../../utils/format';

interface YouTubeUrlInputProps {
  onSwitchToLocalUpload: () => void;
}

export const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({ onSwitchToLocalUpload }) => {
  const [urlInput, setUrlInput] = useState('');
  const [previewMode, setPreviewMode] = useState<'embed' | 'thumbnail'>('embed');
  const [thumbError, setThumbError] = useState(false);
  const parsed = parseYouTubeUrl(urlInput);

  const kindLabel =
    parsed.kind === 'shorts'
      ? 'YouTube Shorts Link'
      : parsed.kind === 'short-link'
      ? 'youtu.be Short Link'
      : parsed.kind === 'live'
      ? 'YouTube Live / VOD Link'
      : 'Standard YouTube Video Link';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-300">
          YouTube Video URL (watch, youtu.be, /shorts, or /live)
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Youtube className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-red-400" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setThumbError(false);
              }}
              placeholder="e.g. https://www.youtube.com/watch?v=... or https://youtu.be/... or /shorts/..."
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] py-2.5 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          {urlInput && (
            <button
              onClick={() => {
                setUrlInput('');
                setThumbError(false);
              }}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.08]"
            >
              Clear
            </button>
          )}
        </div>

        {urlInput.trim() !== '' && !parsed.valid && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Unrecognized YouTube URL. Supported formats: youtube.com/watch?v=ID, youtu.be/ID,
            youtube.com/shorts/ID, or youtube.com/live/ID.
          </p>
        )}

        {parsed.valid && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Recognized: <span className="text-zinc-200">{kindLabel}</span> (ID:{' '}
              <span className="font-mono text-zinc-300">{parsed.videoId}</span>)
            </span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                <ShieldCheck className="h-3 w-3 text-emerald-400" /> No-Cookie Sandbox
              </span>
              <a
                href={parsed.watchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:underline"
              >
                Open on YouTube <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* YouTube Embedded Preview / Thumbnail Card */}
      {parsed.valid && parsed.videoId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
              Video Preview
            </span>
            <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
              <button
                type="button"
                onClick={() => setPreviewMode('embed')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  previewMode === 'embed'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Video className="h-3 w-3" />
                Player Embed
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('thumbnail')}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  previewMode === 'thumbnail'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ImageIcon className="h-3 w-3" />
                Thumbnail Card
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
            {previewMode === 'embed' && parsed.embedUrl ? (
              <div className="relative aspect-video w-full bg-zinc-950">
                <iframe
                  src={parsed.embedUrl}
                  title="YouTube video preview"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className="group relative aspect-video w-full overflow-hidden bg-zinc-950">
                <img
                  src={thumbError ? parsed.hqThumbnailUrl : parsed.thumbnailUrl}
                  onError={() => setThumbError(true)}
                  alt="YouTube video thumbnail preview"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] transition group-hover:bg-black/25">
                  <a
                    href={parsed.watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl transition hover:scale-110 hover:bg-red-500"
                    title="Watch video on YouTube"
                  >
                    <Play className="ml-1 h-6 w-6 fill-current" />
                  </a>
                  <p className="mt-3 text-xs font-medium text-white/90 drop-shadow">
                    Click to watch on YouTube
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-zinc-500">
            {previewMode === 'embed' ? (
              <span>
                Note: Some video owners disable external embedding on YouTube. If the player says
                "Video unavailable", switch to{' '}
                <button
                  type="button"
                  onClick={() => setPreviewMode('thumbnail')}
                  className="text-violet-400 underline hover:text-violet-300"
                >
                  Thumbnail Card
                </button>{' '}
                or open directly on YouTube.
              </span>
            ) : (
              <span>High-resolution thumbnail extracted from YouTube CDN.</span>
            )}
          </p>
        </div>
      )}

      {/* Cross-Origin Analysis Explanation & Solutions */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2.5 text-xs leading-relaxed text-zinc-300">
            <div className="font-semibold text-amber-200">
              Why Direct YouTube Video Clipping Requires a Local Video File
            </div>
            <p>
              ClipForge runs <strong className="text-zinc-100">100% locally in your browser</strong>{' '}
              with zero backend servers. Browsers strictly block client-side JavaScript (Canvas &amp;
              Web Audio) from reading raw pixels or audio samples from cross-origin YouTube players
              due to browser CORS and iframe security policies.
            </p>
            <div className="rounded-lg border border-white/5 bg-black/30 p-2.5 space-y-1.5 text-zinc-400">
              <p className="font-medium text-zinc-200">To clip gameplay highlights right now:</p>
              <ul className="list-inside list-disc space-y-1 pl-1">
                <li>
                  <strong className="text-zinc-200">Option 1 (Fastest &amp; Best Quality):</strong>{' '}
                  Download your gameplay recording via YouTube Studio (or use your local OBS /
                  ShadowPlay file) and upload it in the{' '}
                  <span className="text-violet-300 font-semibold">Local Video Upload</span> tab.
                </li>
                <li>
                  <strong className="text-zinc-200">Option 2 (Direct Web Stream):</strong> If your
                  video is hosted on a CORS-enabled server (e.g. Discord, Cloudflare R2, Google
                  Drive direct MP4 link), use the{' '}
                  <span className="text-violet-300 font-semibold">Direct CORS URL</span> tab.
                </li>
              </ul>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={onSwitchToLocalUpload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-500"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Local Video File Instead
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};