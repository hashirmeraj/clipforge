import React, { useRef, useState } from 'react';
import {
  Upload,
  FileVideo,
  Youtube,
  Globe,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Trash2,
  HardDrive,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { GAME_CATEGORIES } from '../../constants/gaming';
import type { GameCategory } from '../../types';
import {
  loadCorsDirectVideoUrl,
  loadLocalVideoFile,
  type LoadedVideoResult,
} from '../../services/videoLoaderService';
import { formatBytes, formatDurationHuman, formatTime } from '../../utils/format';
import { YouTubeUrlInput } from './YouTubeUrlInput';
import { VideoPreview } from '../common/VideoPreview';

type ImportTab = 'local' | 'youtube' | 'cors-url';

export const VideoImporter: React.FC = () => {
  const { settings, createProjectWithVideo, setPage } = useClipForge();

  const [tab, setTab] = useState<ImportTab>('local');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState('');

  const [loadedVideo, setLoadedVideo] = useState<LoadedVideoResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [gameCategory, setGameCategory] = useState<GameCategory>(settings.defaultGameCategory);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clearLoadedVideo = () => {
    if (loadedVideo) {
      URL.revokeObjectURL(loadedVideo.objectUrl);
      URL.revokeObjectURL(loadedVideo.thumbnailUrl);
      setLoadedVideo(null);
    }
    setError(null);
    setProgress(0);
    setStage('');
  };

  const handleFile = async (file: File) => {
    clearLoadedVideo();
    setLoading(true);
    setError(null);
    setProgress(5);
    setStage('Validating video file...');

    try {
      const result = await loadLocalVideoFile(file, (pct, msg) => {
        setProgress(pct);
        setStage(msg);
      });
      setLoadedVideo(result);
      setProjectName(file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load video file.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleCorsImport = async () => {
    if (!directUrl.trim()) return;
    clearLoadedVideo();
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await loadCorsDirectVideoUrl(
        directUrl,
        (pct, msg) => {
          setProgress(pct);
          setStage(msg);
        },
        controller.signal
      );
      setLoadedVideo(result);
      setProjectName(result.metadata.filename.replace(/\.[^.]+$/, ''));
    } catch (err) {
      if ((err as Error).message !== 'Cancelled') {
        setError(err instanceof Error ? err.message : 'Failed to fetch direct video URL.');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCreateAndAnalyze = () => {
    if (!loadedVideo) return;
    createProjectWithVideo({
      name: projectName.trim() || loadedVideo.metadata.filename.replace(/\.[^.]+$/, ''),
      gameCategory,
      file: loadedVideo.file,
      objectUrl: loadedVideo.objectUrl,
      thumbnailUrl: loadedVideo.thumbnailUrl,
      metadata: loadedVideo.metadata,
    });
    // Ownership of objectUrl/thumbnailUrl moved to ClipForgeContext — do NOT revoke here
    setLoadedVideo(null);
    setPage('analyze');
  };

  const isLargeFile =
    loadedVideo && loadedVideo.metadata.size > settings.largeFileWarningMB * 1024 * 1024;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">New Project — Import Video</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Import a local gameplay recording (MP4, MOV, WebM). All processing runs locally in browser
          memory.
        </p>
      </div>

      {/* Source Tabs */}
      <div className="inline-flex rounded-xl border border-white/[0.08] bg-[#10131b] p-1">
        <button
          onClick={() => setTab('local')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            tab === 'local'
              ? 'bg-violet-600 text-white'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          Local Video Upload
          <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px]">Recommended</span>
        </button>

        <button
          onClick={() => setTab('youtube')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            tab === 'youtube'
              ? 'bg-violet-600 text-white'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Youtube className="h-3.5 w-3.5" />
          YouTube URL
        </button>

        <button
          onClick={() => setTab('cors-url')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
            tab === 'cors-url'
              ? 'bg-violet-600 text-white'
              : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          Direct CORS URL
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Import Zone */}
        <div className="studio-panel p-6 lg:col-span-7">
          {tab === 'local' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
                className="hidden"
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
                  dragging
                    ? 'border-violet-400 bg-violet-500/10'
                    : 'border-white/15 bg-white/[0.015] hover:border-violet-500/50 hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-400">
                  <FileVideo className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">
                  Drop your gameplay recording here
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  Supports <span className="font-medium text-zinc-200">MP4, MOV, WebM</span> — click
                  to browse local files
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2 text-xs font-medium text-zinc-200">
                  <Upload className="h-3.5 w-3.5" />
                  Select Gameplay Video
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
                  <HardDrive className="h-3 w-3" />
                  Processed directly in browser memory — never uploaded to any server
                </p>
              </div>
            </div>
          )}

          {tab === 'youtube' && (
            <YouTubeUrlInput onSwitchToLocalUpload={() => setTab('local')} />
          )}

          {tab === 'cors-url' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300">
                  Direct Video File URL (CORS-enabled MP4 / WebM / MOV)
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="url"
                    value={directUrl}
                    onChange={(e) => setDirectUrl(e.target.value)}
                    placeholder="https://example.com/gameplay-clip.mp4"
                    className="flex-1 rounded-lg border border-white/10 bg-[#0b0d12] px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
                  />
                  {loading ? (
                    <button
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-lg bg-red-600/80 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={handleCorsImport}
                      disabled={!directUrl.trim()}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                    >
                      Fetch Video
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Works only if the hosting server explicitly permits cross-origin access via
                  <code className="mx-1 rounded bg-white/[0.06] px-1 py-0.5 text-[11px]">
                    Access-Control-Allow-Origin
                  </code>
                  headers.
                </p>
              </div>
            </div>
          )}

          {/* Initialization Progress */}
          {loading && (
            <div className="mt-5 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-violet-200">{stage || 'Initializing...'}</span>
                <span className="font-mono text-violet-300">{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Box */}
          {error && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div className="space-y-1">
                <div className="font-semibold text-red-200">Video Import Error</div>
                <p className="text-red-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Loaded Video Preview */}
          {loadedVideo && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Video Verified &amp; Loaded into Browser Memory
                </div>
                <button
                  onClick={clearLoadedVideo}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>

              <VideoPreview src={loadedVideo.objectUrl} />

              {isLargeFile && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div>
                    <div className="font-semibold">Large Video Detected ({formatBytes(loadedVideo.metadata.size)})</div>
                    <p className="mt-0.5 text-amber-200/80">
                      ClipForge will automatically protect browser memory during analysis (using
                      adaptive frame sampling &amp; safe audio limits). For exports, 720p Standard/High
                      is recommended if your device has &le; 8 GB RAM.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Video Metadata & Project Setup */}
        <div className="studio-panel flex flex-col justify-between p-6 lg:col-span-5">
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-white">Project Configuration</h2>
              <p className="text-xs text-zinc-500">
                Name your project and pick your game category to tune highlight detection weights.
              </p>
            </div>

            {/* Metadata Card */}
            {loadedVideo ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={loadedVideo.thumbnailUrl}
                    alt="Video thumbnail"
                    className="h-14 w-24 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {loadedVideo.metadata.filename}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                        {loadedVideo.metadata.width}×{loadedVideo.metadata.height}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                        {formatTime(loadedVideo.metadata.duration)}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono">
                        {formatBytes(loadedVideo.metadata.size)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-xs">
                  <div>
                    <span className="text-zinc-500">Duration:</span>{' '}
                    <span className="font-medium text-zinc-200">
                      {formatDurationHuman(loadedVideo.metadata.duration)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Format:</span>{' '}
                    <span className="font-medium text-zinc-200">
                      {loadedVideo.metadata.mimeType}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-xs text-zinc-500">
                Upload a video on the left to inspect its real resolution, duration, file size, and
                thumbnail frame.
              </div>
            )}

            {/* Project Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-300">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., GTA 6 Chaotic Police Chase Session"
                className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            {/* Game Category */}
            <div>
              <label className="block text-xs font-medium text-zinc-300">Gaming Category</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {GAME_CATEGORIES.map((g) => {
                  const selected = gameCategory === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGameCategory(g.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                        selected
                          ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                          : 'border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-white/[0.07] pt-4">
            <button
              onClick={handleCreateAndAnalyze}
              disabled={!loadedVideo || loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Create Project &amp; Go to Analysis</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
