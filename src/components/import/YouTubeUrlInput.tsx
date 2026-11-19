import React, { useState, useRef, useEffect } from 'react';
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
  Radio,
  Square,
  Clock,
  Volume2,
  Zap,
  Loader2,
} from 'lucide-react';
import { parseYouTubeUrl } from '../../utils/format';

interface YouTubeUrlInputProps {
  onSwitchToLocalUpload: () => void;
  onFileSelect: (file: File) => void;
}

export const YouTubeUrlInput: React.FC<YouTubeUrlInputProps> = ({
  onFileSelect,
}) => {
  const [urlInput, setUrlInput] = useState('https://www.youtube.com/watch?v=iSDePGJ6Dmg');
  const [previewMode, setPreviewMode] = useState<'embed' | 'thumbnail'>('embed');
  const [thumbError, setThumbError] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  // 1-Click Server Stream state (Solution 1)
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState('');
  const [streamError, setStreamError] = useState<string | null>(null);

  // Live Screen / Tab Recording state (Solution 2)
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [targetDuration, setTargetDuration] = useState<number>(30); // default 30s clip
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingWarning, setRecordingWarning] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const parsed = parseYouTubeUrl(urlInput);

  const kindLabel =
    parsed.kind === 'shorts'
      ? 'YouTube Shorts Link'
      : parsed.kind === 'short-link'
      ? 'youtu.be Short Link'
      : parsed.kind === 'live'
      ? 'YouTube Live / VOD Link'
      : 'Standard YouTube Video Link';

  // Cleanup active streams on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

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

  // Solution 1: 1-Click Server Stream directly into browser memory
  const handle1ClickStream = async () => {
    if (!parsed.valid || !urlInput.trim()) return;
    setIsStreaming(true);
    setStreamError(null);
    setStreamProgress('Connecting to Railway stream engine...');

    try {
      const endpoint = window.location.origin.includes('railway')
        ? `/api/stream?url=${encodeURIComponent(urlInput)}&duration=${targetDuration || 60}`
        : `https://clipforge-production-1b2a5d93.up.railway.app/api/stream?url=${encodeURIComponent(urlInput)}&duration=${targetDuration || 60}`;

      setStreamProgress('Extracting video stream (720p H.264 / AAC)...');
      const response = await fetch(endpoint);

      if (!response.ok) {
        let errMessage = 'Stream extraction failed.';
        try {
          const errJson = await response.json();
          errMessage = errJson.details || errJson.error || errMessage;
        } catch {
          errMessage = `Server error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errMessage);
      }

      setStreamProgress('Receiving video buffer into browser memory...');
      const blob = await response.blob();

      if (blob.size < 1024) {
        throw new Error('Received an empty video stream from the server.');
      }

      setStreamProgress('Loading into ClipForge AI engine...');
      const cleanName = parsed.videoId
        ? `YouTube_${parsed.videoId}_${Date.now()}.mp4`
        : `YouTube_Clip_${Date.now()}.mp4`;

      const videoFile = new File([blob], cleanName, { type: 'video/mp4' });
      (videoFile as any)._customDuration = targetDuration || 60;
      setIsStreaming(false);
      setStreamProgress('');
      onFileSelect(videoFile);
    } catch (err) {
      console.error('[1-Click Stream Error]', err);
      setStreamError(
        err instanceof Error
          ? err.message
          : 'Stream server is starting up or video is restricted. You can also use live recording below.'
      );
      setIsStreaming(false);
      setStreamProgress('');
    }
  };

  // Solution 2: Start direct browser tab recording of the embedded YouTube player
  const startEmbeddedTabCapture = async () => {
    setRecordingError(null);
    setRecordingWarning(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setRecordingError('Your browser does not support Tab / Screen Capture API. Please use Chrome, Edge, or Brave.');
      return;
    }

    try {
      // Prompt user to select current tab (with audio)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
        },
        audio: true,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        systemAudio: 'include',
      } as any);

      activeStreamRef.current = stream;

      const hasAudio = stream.getAudioTracks().length > 0;
      if (!hasAudio) {
        setRecordingWarning(
          'Note: Tab audio was not captured. In the share prompt, make sure "Also share tab audio" is checked for speech captions.'
        );
      }

      // Determine best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      const selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        stream.getTracks().forEach((track) => track.stop());

        if (recordedChunksRef.current.length === 0) {
          setRecordingError('No video data recorded. Please try again.');
          setIsRecording(false);
          return;
        }

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });

        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const cleanName = parsed.videoId
          ? `YouTube_Clip_${parsed.videoId}_${Date.now()}.${extension}`
          : `YouTube_Clip_${Date.now()}.${extension}`;

        const capturedFile = new File([blob], cleanName, { type: blob.type });
        (capturedFile as any)._customDuration = recordSeconds > 0 ? recordSeconds : targetDuration || 30;

        setIsRecording(false);
        setRecordSeconds(0);

        // Immediately pass captured video file to ClipForge engine!
        onFileSelect(capturedFile);
      };

      // Listen for when user clicks "Stop sharing" in the native browser bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopRecording();
        };
      }

      recorder.start(1000); // 1-second timeslices
      setIsRecording(true);
      setRecordSeconds(0);

      // Start counter timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          // Auto-stop when reached target duration (if configured > 0)
          if (targetDuration > 0 && next >= targetDuration) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        setRecordingError(err instanceof Error ? err.message : 'Failed to start screen capture.');
      }
      setIsRecording(false);
    }
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

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

      {/* Video Preview & Actions */}
      {parsed.valid && parsed.videoId && (
        <div className="space-y-4 rounded-xl border border-violet-500/30 bg-[#0e1118] p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-200">YouTube Video Preview</span>
              <span className="rounded bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" /> 1-Click Ready
              </span>
            </div>
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

          {/* Embedded YouTube Player Container */}
          <div className="relative overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl">
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

            {/* Live Recording HUD Overlay */}
            {isRecording && (
              <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-red-500/30 bg-black/85 p-3.5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="flex h-3.5 w-3.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500"></span>
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide uppercase">
                        Capturing Embedded Video:
                      </span>
                      <span className="font-mono text-sm font-extrabold text-red-400">
                        {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:
                        {String(recordSeconds % 60).padStart(2, '0')}
                        {targetDuration > 0 && (
                          <span className="text-zinc-400 text-xs font-normal">
                            {' '}/ {targetDuration}s
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Recording player directly. Play the video now to capture the moment!
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Finish &amp; Start AI Clipper
                </button>
              </div>
            )}
          </div>

          {/* PRIMARY: 1-Click Stream & Clip Box */}
          <div className="rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-950/40 to-fuchsia-950/20 p-4 shadow-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    1-Click Direct Stream &amp; Clip (Recommended)
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Extracts &amp; pipes video directly into browser memory — zero downloads, zero prompts!
                  </p>
                </div>
              </div>

              {/* Duration Picker */}
              <div className="flex items-center gap-1 text-xs text-zinc-300">
                <Clock className="h-3 w-3 text-zinc-400" />
                <span className="text-[10px] text-zinc-400">Clip:</span>
                {[15, 30, 60, 90].map((dur) => (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setTargetDuration(dur)}
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
                      targetDuration === dur
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {dur}s
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Click Stream Action Button */}
            <button
              type="button"
              disabled={isStreaming}
              onClick={handle1ClickStream}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/30 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {isStreaming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{streamProgress || 'Streaming Video...'}</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 fill-amber-300 text-amber-300" />
                  <span>⚡ 1-Click Stream &amp; Clip Video Now</span>
                </>
              )}
            </button>

            {streamError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-red-300">Stream Connection Notice</p>
                  <p className="text-[11px] leading-relaxed">{streamError}</p>
                  <p className="text-[11px] text-zinc-400">
                    You can also use the Live Player Capture below or drop a local file.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECONDARY: Live In-Browser Player Recording (Solution 2) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs font-semibold text-zinc-300">
                  Alternative: Live Player Screen Capture
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">100% In-Browser</span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Play the embedded video above and record the live segment directly into browser memory.
            </p>

            <button
              type="button"
              onClick={startEmbeddedTabCapture}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
            >
              <Radio className="h-3.5 w-3.5 text-red-400 animate-pulse" />
              Capture from Player
            </button>

            <div className="flex items-center gap-1 text-[11px] text-zinc-500 pt-1">
              <Volume2 className="h-3 w-3 text-emerald-400" />
              Tip: Keep "Share tab audio" checked in browser prompt for speech captions
            </div>
          </div>

          {/* Error / Warning feedback for recording */}
          {recordingError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{recordingError}</span>
            </div>
          )}

          {recordingWarning && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0" />
              <span>{recordingWarning}</span>
            </div>
          )}

          {/* 1-Click External Download helper */}
          <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[11px] text-zinc-400">
            <span>Need the entire uncompressed file?</span>
            <a
              href={cobaltHelperUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-violet-400 hover:text-violet-300"
            >
              <Download className="h-3 w-3" />
              1-Click Download via Cobalt
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
          </div>
        </div>
      )}

      {/* Direct Dropzone (If user already has an MP4 or prefers dragging) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => dropInputRef.current?.click()}
        className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${
          isDragging
            ? 'border-violet-500 bg-violet-500/10'
            : 'border-white/10 bg-white/[0.01] hover:border-violet-500/40 hover:bg-white/[0.03]'
        }`}
      >
        <input
          ref={dropInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition">
          <FileVideo className="h-5 w-5" />
        </div>
        <p className="mt-2 text-xs font-semibold text-zinc-300">
          Already have a video file? Drop it here to import directly
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-zinc-300 group-hover:bg-violet-600 group-hover:text-white transition">
          <Upload className="h-3 w-3" />
          Browse Local Video File
        </div>
      </div>
    </div>
  );
};