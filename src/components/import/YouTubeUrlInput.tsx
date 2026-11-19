import React, { useState, useRef } from 'react';
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
  Download,
  FileVideo,
  Sparkles,
} from 'lucide-react';
import { parseYouTubeUrl } from '../../utils/format';

interface YouTubeUrlInputProps {
  onSwitchToLocalUpload: () => void;
  onFileSelect: (file: File) => void;
}

export const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({
  onSwitchToLocalUpload,
  onFileSelect,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [previewMode, setPreviewMode] = useState<'embed' | 'thumbnail'>('embed');
  const [thumbError, setThumbError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = parseYouTubeUrl(urlInput);

  const kindLabel =
    parsed.kind === 'shorts'
      ? 'YouTube Shorts Link'
      : parsed.kind === 'short-link'
      ? 'youtu.be Short Link'
      : parsed.kind === 'live'
      ? 'YouTube Live / VOD Link'
      : 'Standard YouTube Video Link';

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name))) {
      onFileSelect(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  // Safe external helper link to download MP4 without ad popups
  const cobaltHelperUrl = parsed.valid
    ? `https://cobalt.tools/#${encodeURIComponent(parsed.watchUrl || urlInput)}`
    : 'https://cobalt.tools/';

  return (
    <div className="space-y-4">
      {/* URL Input Bar */}
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
            <div className="flex items-center gap-2">
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

      {/* Video Preview & Download Helper */}
      {parsed.valid && parsed.videoId && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#0e1118] p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200">Video Preview</span>
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
                Thumbnail
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-black shadow-lg">
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <a
                    href={parsed.watchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-2xl transition hover:scale-110 hover:bg-red-500"
                    title="Watch video on YouTube"
                  >
                    <Play className="ml-1 h-5 w-5 fill-current" />
                  </a>
                  <p className="mt-2 text-xs font-medium text-white/90 drop-shadow">
                    Click to watch on YouTube
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 1-Click Fast Workflow */}
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-violet-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                  Step 1: Download Clean MP4
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-400">
                  Open clean downloader or grab from YouTube Studio
                </p>
              </div>
              <a
                href={cobaltHelperUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-500"
              >
                <Download className="h-3.5 w-3.5" />
                1-Click Download MP4
                <ExternalLink className="h-3 w-3 opacity-70" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Integrated Dropzone directly in YouTube Tab */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => dropInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition ${
          isDragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-white/15 bg-white/[0.02] hover:border-violet-500/50 hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={dropInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <FileVideo className="h-6 w-6" />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">
          Step 2: Drop your downloaded video file here
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Drop the <span className="text-zinc-200 font-medium">MP4 or WebM</span> file here or click
          to browse
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 group-hover:bg-violet-600 group-hover:text-white transition">
          <Upload className="h-3.5 w-3.5" />
          Choose Local Video File
        </div>
      </div>

      {/* Honest Technical Explanation (Why this 2-step flow exists) */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
          <div className="space-y-1 text-[11px] leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-300">
              Why can't browsers clip directly from an embedded YouTube player?
            </span>
            <p>
              An embedded player only lets you <em>watch</em> a video. For ClipForge's AI to detect
              kills/explosions, read audio waveforms, and burn local Whisper subtitles, the browser
              must access raw video pixels and audio bytes. All browsers block web apps from
              inspecting video data across different domains (CORS security). Loading the MP4 into
              the dropzone runs 100% locally in your browser with zero server costs, zero quality
              loss, and total privacy!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};