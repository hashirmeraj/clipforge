import React, { useState } from 'react';
import { Youtube, AlertTriangle, ExternalLink, CheckCircle2, Upload, Info } from 'lucide-react';
import { parseYouTubeUrl } from '../../utils/format';

interface YouTubeUrlInputProps {
  onSwitchToLocalUpload: () => void;
}

export const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({ onSwitchToLocalUpload }) => {
  const [urlInput, setUrlInput] = useState('');
  const parsed = parseYouTubeUrl(urlInput);

  const kindLabel =
    parsed.kind === 'shorts'
      ? 'YouTube Shorts Link'
      : parsed.kind === 'short-link'
      ? 'youtu.be Short Link'
      : 'Standard YouTube Link';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-300">
          YouTube Video URL (watch, youtu.be, or /shorts)
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <Youtube className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-red-400" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... or /shorts/..."
              className="w-full rounded-lg border border-white/10 bg-[#0b0d12] py-2.5 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          {urlInput && (
            <button
              onClick={() => setUrlInput('')}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.08]"
            >
              Clear
            </button>
          )}
        </div>

        {urlInput.trim() !== '' && !parsed.valid && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Unrecognized YouTube URL. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, or
            youtube.com/shorts/ID.
          </p>
        )}

        {parsed.valid && (
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Recognized: {kindLabel} (ID: <span className="font-mono">{parsed.videoId}</span>)
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
        )}
      </div>

      {/* YouTube Embedded Preview */}
      {parsed.valid && parsed.embedUrl && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          <div className="aspect-video w-full">
            <iframe
              src={parsed.embedUrl}
              title="YouTube video preview"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Honest Browser Cross-Origin Limitation Notice */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-xs leading-relaxed text-zinc-300">
            <div className="font-semibold text-amber-200">
              Browser Cross-Origin Limitation (Why Direct YouTube Analysis Is Disabled)
            </div>
            <p>
              ClipForge runs 100% locally in your browser with no backend server. Standard browser
              security policies (CORS &amp; cross-origin iframe isolation) prevent web apps from
              reading raw video frames or audio buffers from an embedded YouTube player.
            </p>
            <p className="text-zinc-400">
              <strong className="text-zinc-200">Authorized Workflow:</strong> Export or download
              your own gameplay recording from YouTube Studio (or your local OBS/ShadowPlay
              captures folder) as an MP4, MOV, or WebM file, then upload it directly in the{' '}
              <span className="text-violet-300 font-medium">Local Video Upload</span> tab for full
              audio/visual AI analysis, captions, and MP4 export.
            </p>
            <div className="pt-1">
              <button
                onClick={onSwitchToLocalUpload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
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
