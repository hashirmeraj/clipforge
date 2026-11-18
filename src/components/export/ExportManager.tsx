import React, { useRef, useState } from 'react';
import {
  Download,
  Package,
  Play,
  Square,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  Scissors,
  RefreshCw,
  X,
  Film,
  Loader2,
  FileText,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import type {
  AspectRatio,
  Clip,
  ExportFps,
  ExportQuality,
  ExportResolution,
  ExportSettings,
} from '../../types';
import {
  cancelActiveFFmpegExport,
  createExportsZipBlob,
  exportClipWithFFmpeg,
} from '../../services/ffmpegService';
import { generateClipThumbnailBlob } from '../../services/captionRendererService';
import { EmptyProjectGuard } from '../common/EmptyProjectGuard';
import { ClipDataModal } from './ClipDataModal';
import { formatBytes, formatTime, generateId, sanitizeFilename } from '../../utils/format';

export const ExportManager: React.FC = () => {
  const {
    activeProject,
    activeMedia,
    settings,
    exportJobs,
    setExportJob,
    updateClip,
    recordExportHistory,
    setActiveClipId,
    setPage,
  } = useClipForge();

  const [resolution, setResolution] = useState<ExportResolution>(settings.defaultExportResolution);
  const [fps, setFps] = useState<ExportFps>(settings.defaultExportFps);
  const [quality, setQuality] = useState<ExportQuality>(settings.defaultExportQuality);
  const [aspectOverride, setAspectOverride] = useState<AspectRatio | 'clip'>('clip');

  const [isExporting, setIsExporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; title: string } | null>(null);
  const [thumbBusyId, setThumbBusyId] = useState<string | null>(null);
  const [dataModalClipId, setDataModalClipId] = useState<string | null>(null);

  const cancelledRef = useRef(false);

  if (!activeProject || !activeMedia || !activeProject.videoMeta) {
    return (
      <EmptyProjectGuard
        title="No Video Loaded in Export Center"
        description="Import a gameplay recording and create clips to render real MP4 Shorts locally via FFmpeg.wasm."
      />
    );
  }

  const clips = activeProject.clips;
  if (clips.length === 0) {
    return (
      <div className="studio-panel mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <Film className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">No Clips Ready for Export</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Generate clips from AI Highlights or create one in the Clip Editor before rendering MP4s.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => setPage('highlights')}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Go to AI Highlights
          </button>
          <button
            onClick={() => setPage('editor')}
            className="rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.1]"
          >
            Open Clip Editor
          </button>
        </div>
      </div>
    );
  }

  const currentExportSettings: ExportSettings = {
    resolution,
    fps,
    quality,
    overrideAspectRatio: aspectOverride === 'clip' ? undefined : aspectOverride,
  };

  const selectedClips = clips.filter((c) => c.selected);
  const allSelected = clips.every((c) => c.selected);

  const completedJobs = clips
    .map((c) => exportJobs[c.id])
    .filter((j): j is NonNullable<typeof j> => Boolean(j && j.status === 'done' && j.outputUrl && j.outputFilename));

  const toggleAllClips = () => {
    const next = !allSelected;
    clips.forEach((c) => updateClip(activeProject.id, c.id, (prev) => ({ ...prev, selected: next })));
  };

  const runBatchExport = async (targetClips: Clip[], customSettings?: ExportSettings) => {
    if (targetClips.length === 0 || isExporting) return;
    const cfg = customSettings ?? currentExportSettings;
    cancelledRef.current = false;
    setIsExporting(true);
    setBatchProgress({ current: 0, total: targetClips.length });

    // Mark queued
    for (const c of targetClips) {
      setExportJob(c.id, {
        id: generateId('exp'),
        clipId: c.id,
        clipTitle: c.title,
        status: 'queued',
        progress: 0,
        stageText: 'Queued for FFmpeg.wasm...',
        settings: cfg,
      });
    }

    for (let i = 0; i < targetClips.length; i++) {
      if (cancelledRef.current) break;
      const clip = targetClips[i];
      setBatchProgress({ current: i + 1, total: targetClips.length });

      setExportJob(clip.id, {
        id: generateId('exp'),
        clipId: clip.id,
        clipTitle: clip.title,
        status: 'rendering',
        progress: 2,
        stageText: 'Starting FFmpeg.wasm render...',
        settings: cfg,
      });

      try {
        const bgFile = activeMedia.bgMusicFiles[clip.id]?.file;
        const result = await exportClipWithFFmpeg({
          sourceFile: activeMedia.file,
          sourceMeta: activeProject.videoMeta!,
          clip,
          settings: cfg,
          bgMusicFile: bgFile,
          onProgress: (pct, stageText) => {
            if (cancelledRef.current) return;
            setExportJob(clip.id, {
              id: generateId('exp'),
              clipId: clip.id,
              clipTitle: clip.title,
              status: pct < 15 ? 'loading-ffmpeg' : 'rendering',
              progress: pct,
              stageText,
              settings: cfg,
            });
          },
        });

        if (cancelledRef.current) {
          URL.revokeObjectURL(result.objectUrl);
          break;
        }

        const now = new Date().toISOString();
        setExportJob(clip.id, {
          id: generateId('exp'),
          clipId: clip.id,
          clipTitle: clip.title,
          status: 'done',
          progress: 100,
          stageText: 'MP4 ready to download',
          outputUrl: result.objectUrl,
          outputFilename: result.filename,
          outputSize: result.sizeBytes,
          completedAt: now,
          settings: cfg,
        });

        recordExportHistory(activeProject.id, {
          id: generateId('rec'),
          clipId: clip.id,
          clipTitle: clip.title,
          filename: result.filename,
          resolution: cfg.resolution,
          aspectRatio: result.aspectRatio,
          fps: cfg.fps,
          quality: cfg.quality,
          sizeBytes: result.sizeBytes,
          exportedAt: now,
        });
      } catch (err) {
        if (cancelledRef.current) {
          setExportJob(clip.id, {
            id: generateId('exp'),
            clipId: clip.id,
            clipTitle: clip.title,
            status: 'cancelled',
            progress: 0,
            stageText: 'Cancelled by user',
            settings: cfg,
          });
          break;
        }
        const msg = err instanceof Error ? err.message : 'FFmpeg rendering error.';
        setExportJob(clip.id, {
          id: generateId('exp'),
          clipId: clip.id,
          clipTitle: clip.title,
          status: 'error',
          progress: 0,
          stageText: 'Export failed',
          error: msg,
          fallbackSuggestion:
            'Try compatible fallback: 720p resolution, 30 FPS, Standard quality (lower browser WASM memory footprint).',
          settings: cfg,
        });
      }
    }

    setIsExporting(false);
    setBatchProgress(null);
  };

  const handleCancelExport = () => {
    cancelledRef.current = true;
    cancelActiveFFmpegExport();
    setIsExporting(false);
    setBatchProgress(null);
  };

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadZip = async () => {
    if (completedJobs.length === 0) return;
    setZipProgress(5);
    try {
      const zipBlob = await createExportsZipBlob(
        completedJobs.map((j) => ({ filename: j.outputFilename!, url: j.outputUrl! })),
        (pct) => setZipProgress(pct)
      );
      const url = URL.createObjectURL(zipBlob);
      triggerDownload(url, `${sanitizeFilename(activeProject.name)}_clips.zip`);
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } finally {
      setZipProgress(null);
    }
  };

  const handleDownloadThumbnail = async (clip: Clip) => {
    setThumbBusyId(clip.id);
    try {
      const blob = await generateClipThumbnailBlob(
        activeMedia.objectUrl,
        clip,
        resolution,
        true
      );
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `${sanitizeFilename(clip.title)}_thumbnail.jpg`);
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate thumbnail image.');
    } finally {
      setThumbBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Export Center</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Render finished H.264 MP4 Shorts locally via FFmpeg.wasm with burned captions, layout
            framing, and mixed audio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {completedJobs.length > 0 && (
            <button
              onClick={handleDownloadZip}
              disabled={zipProgress !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <Package className="h-4 w-4" />
              {zipProgress !== null
                ? `Packaging ZIP (${zipProgress}%)...`
                : `Download All (${completedJobs.length}) as ZIP`}
            </button>
          )}
        </div>
      </div>

      {/* Export Configuration Panel */}
      <div className="studio-panel p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400">Resolution</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(['720p', '1080p'] as const).map((r) => (
                <button
                  key={r}
                  disabled={isExporting}
                  onClick={() => setResolution(r)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition ${
                    resolution === r
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-[#0b0d12] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Aspect Ratio</label>
            <select
              disabled={isExporting}
              value={aspectOverride}
              onChange={(e) => setAspectOverride(e.target.value as AspectRatio | 'clip')}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-xs text-zinc-100"
            >
              <option value="clip">Keep per-clip ratio</option>
              <option value="9:16">Force 9:16 Vertical</option>
              <option value="16:9">Force 16:9 Landscape</option>
              <option value="1:1">Force 1:1 Square</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Frame Rate</label>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {([30, 60] as const).map((f) => (
                <button
                  key={f}
                  disabled={isExporting}
                  onClick={() => setFps(f)}
                  className={`rounded-lg border py-2 text-xs font-semibold transition ${
                    fps === f
                      ? 'border-violet-500 bg-violet-500/20 text-white'
                      : 'border-white/10 bg-[#0b0d12] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {f} FPS
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Encoding Quality</label>
            <select
              disabled={isExporting}
              value={quality}
              onChange={(e) => setQuality(e.target.value as ExportQuality)}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-xs text-zinc-100"
            >
              <option value="standard">Standard (Fastest • CRF 28)</option>
              <option value="high">High (Balanced • CRF 23)</option>
              <option value="maximum">Maximum (Crisp • CRF 18)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400">Output Format</label>
            <div className="mt-1.5 flex h-[34px] items-center justify-between rounded-lg border border-white/10 bg-[#0b0d12] px-3 text-xs text-zinc-300">
              <span className="font-mono font-semibold text-sky-300">MP4</span>
              <span className="text-[11px] text-zinc-500">H.264 / AAC</span>
            </div>
          </div>
        </div>

        {/* Batch Action Bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
          <div className="flex items-center gap-3 text-xs text-zinc-400">
            <button
              onClick={toggleAllClips}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 font-medium text-zinc-200 hover:bg-white/[0.08]"
            >
              <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span>
              {selectedClips.length} of {clips.length} clips selected
            </span>
            {batchProgress && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-0.5 font-mono text-violet-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                Rendering clip {batchProgress.current} of {batchProgress.total}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isExporting ? (
              <button
                onClick={handleCancelExport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Cancel Render
              </button>
            ) : (
              <>
                <button
                  onClick={() => runBatchExport(selectedClips)}
                  disabled={selectedClips.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Selected ({selectedClips.length})
                </button>
                <button
                  onClick={() => runBatchExport(clips)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-white/[0.12]"
                >
                  Export All ({clips.length})
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Export Queue List */}
      <div className="space-y-3">
        {clips.map((clip, idx) => {
          const job = exportJobs[clip.id];
          const isBusy =
            job && (job.status === 'queued' || job.status === 'loading-ffmpeg' || job.status === 'rendering');
          const effAspect = aspectOverride === 'clip' ? clip.aspectRatio : aspectOverride;

          return (
            <div key={clip.id} className="studio-panel p-4">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex items-start gap-3 min-w-0">
                  <input
                    type="checkbox"
                    disabled={isExporting}
                    checked={clip.selected}
                    onChange={(e) =>
                      updateClip(activeProject.id, clip.id, (c) => ({
                        ...c,
                        selected: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-violet-500"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-violet-400">#{idx + 1}</span>
                      <h3 className="truncate text-sm font-semibold text-white">{clip.title}</h3>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
                        {effAspect} • {resolution} • {fps}fps
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                        {formatTime(clip.start)} – {formatTime(clip.end)} ({(clip.end - clip.start).toFixed(1)}s)
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>Layout: {clip.layout}</span>
                      <span>
                        Captions:{' '}
                        {clip.captionsEnabled && clip.captions.length > 0
                          ? `${clip.captions.length} lines (${clip.captionStyle.presetId})`
                          : 'Off'}
                      </span>
                      <span>
                        Audio:{' '}
                        {clip.muted
                          ? 'Muted'
                          : `${Math.round(clip.originalVolume * 100)}%${
                              clip.bgMusicName ? ` + BGM` : ''
                            }`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setActiveClipId(clip.id);
                      setPage('editor');
                    }}
                    disabled={isExporting}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08]"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => setDataModalClipId(clip.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-500/35 bg-violet-500/15 px-2.5 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25"
                    title="View generated video title, description, trending hashtags & SEO keywords"
                  >
                    <FileText className="h-3.5 w-3.5 text-violet-300" />
                    View Data
                  </button>

                  <button
                    onClick={() => handleDownloadThumbnail(clip)}
                    disabled={thumbBusyId === clip.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08]"
                    title="Generate & download high-res thumbnail image"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-sky-400" />
                    {thumbBusyId === clip.id ? 'Saving...' : 'Thumbnail'}
                  </button>

                  {job?.status === 'done' && job.outputUrl && job.outputFilename ? (
                    <>
                      <button
                        onClick={() =>
                          setPreviewUrl({ url: job.outputUrl!, title: job.outputFilename! })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-white/[0.07] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/[0.14]"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Preview MP4
                      </button>
                      <button
                        onClick={() => triggerDownload(job.outputUrl!, job.outputFilename!)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download ({formatBytes(job.outputSize || 0)})
                      </button>
                      <button
                        onClick={() => runBatchExport([clip])}
                        disabled={isExporting}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
                        title="Re-render with current settings"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => runBatchExport([clip])}
                      disabled={isExporting}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export MP4
                    </button>
                  )}
                </div>
              </div>

              {/* Real Rendering Progress Bar */}
              {isBusy && job && (
                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-violet-200">{job.stageText}</span>
                    <span className="font-mono font-semibold text-violet-300">{job.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-200"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Completed Badge */}
              {job?.status === 'done' && (
                <div className="mt-2.5 flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Rendered <span className="font-mono text-emerald-300">{job.outputFilename}</span>{' '}
                    ({formatBytes(job.outputSize || 0)})
                  </span>
                </div>
              )}

              {/* Error + Compatible Fallback */}
              {job?.status === 'error' && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div className="space-y-1.5">
                      <div className="font-semibold">Render Error: {job.error}</div>
                      {job.fallbackSuggestion && (
                        <p className="text-red-200/80">{job.fallbackSuggestion}</p>
                      )}
                      <button
                        onClick={() =>
                          runBatchExport([clip], {
                            resolution: '720p',
                            fps: 30,
                            quality: 'standard',
                            overrideAspectRatio: aspectOverride === 'clip' ? undefined : aspectOverride,
                          })
                        }
                        disabled={isExporting}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry with Compatible 720p / 30fps Standard
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Clip SEO & Publishing Data Modal */}
      {(() => {
        const modalClip = dataModalClipId ? clips.find((c) => c.id === dataModalClipId) : null;
        if (!modalClip) return null;
        const linkedHighlight = modalClip.highlightId
          ? activeProject.highlights.find((h) => h.id === modalClip.highlightId)
          : undefined;
        return (
          <ClipDataModal
            clip={modalClip}
            project={activeProject}
            highlight={linkedHighlight}
            onSaveMetadata={(publishingMeta) =>
              updateClip(activeProject.id, modalClip.id, (c) => ({ ...c, publishingMeta }))
            }
            onClose={() => setDataModalClipId(null)}
          />
        );
      })()}

      {/* Rendered MP4 Verification Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="studio-panel-elevated w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <div className="truncate font-mono text-xs font-semibold text-white">
                {previewUrl.title}
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-black p-4">
              <video
                src={previewUrl.url}
                controls
                autoPlay
                className="max-h-[70vh] max-w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
