import React, { useRef, useState } from 'react';
import {
  Activity,
  AudioWaveform,
  Eye,
  Mic,
  Play,
  Square,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  SlidersHorizontal,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { GAME_CATEGORIES, getGameConfig } from '../../constants/gaming';
import type { AnalysisDensity, AnalysisSamplePoint, GameCategory, SpeechSegment } from '../../types';
import { analyzeVideoAudio } from '../../services/audioAnalyzerService';
import { analyzeVideoFrames } from '../../services/frameAnalyzerService';
import { detectHighlights } from '../../services/highlightDetectorService';
import { transcribeVideoSegment } from '../../services/speechService';
import { captureVideoFrameBlobUrl } from '../../services/videoLoaderService';
import { EmptyProjectGuard } from '../common/EmptyProjectGuard';
import { formatDurationHuman, formatTime } from '../../utils/format';

export const VideoAnalyzer: React.FC = () => {
  const {
    activeProject,
    activeMedia,
    settings,
    capabilities,
    updateProject,
    saveAnalysisResults,
    setPage,
  } = useClipForge();

  const [density, setDensity] = useState<AnalysisDensity>(settings.analysisDensity);
  const [runSpeechScan, setRunSpeechScan] = useState<boolean>(settings.enableLocalWhisper);

  const [running, setRunning] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [audioProgress, setAudioProgress] = useState(0);
  const [frameProgress, setFrameProgress] = useState(0);
  const [speechProgress, setSpeechProgress] = useState(0);
  const [liveSamples, setLiveSamples] = useState<{ motion: number; flash: number }[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  if (!activeProject || !activeMedia || !activeProject.videoMeta) {
    return (
      <EmptyProjectGuard
        title="No Gameplay Video Loaded for Analysis"
        description="Import a local MP4, MOV, or WebM gameplay recording first so ClipForge can analyze its real audio peaks, motion, scene cuts, and speech."
      />
    );
  }

  const gameCfg = getGameConfig(activeProject.gameCategory);
  const videoMeta = activeProject.videoMeta;

  const setGameCategory = (cat: GameCategory) => {
    updateProject(activeProject.id, (p) => ({
      ...p,
      gameCategory: cat,
      momentFilters: [],
    }));
  };

  const toggleMomentFilter = (label: string) => {
    updateProject(activeProject.id, (p) => {
      const exists = p.momentFilters.includes(label);
      return {
        ...p,
        momentFilters: exists
          ? p.momentFilters.filter((f) => f !== label)
          : [...p.momentFilters, label],
      };
    });
  };

  const setCustomInstructions = (text: string) => {
    updateProject(activeProject.id, (p) => ({ ...p, customInstructions: text }));
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleRunAnalysis = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    const startTs = performance.now();

    setRunning(true);
    setError(null);
    setWarnings([]);
    setOverallProgress(2);
    setAudioProgress(0);
    setFrameProgress(0);
    setSpeechProgress(0);
    setLiveSamples([]);

    const collectedWarnings: string[] = [];

    try {
      // 1. Real Web Audio API Analysis
      setStatusMessage('Step 1/4: Analyzing gameplay audio waveform & voice activity...');
      const binStep = Math.max(0.5, Math.min(2.5, videoMeta.duration / 180));
      const audioRes = await analyzeVideoAudio(
        activeMedia.file,
        videoMeta.duration,
        binStep,
        (pct, stage) => {
          setAudioProgress(pct);
          setOverallProgress(Math.round(pct * 0.28));
          setStatusMessage(`Step 1/4: ${stage}`);
        },
        controller.signal
      );
      if (audioRes.warning) {
        collectedWarnings.push(audioRes.warning);
        setWarnings([...collectedWarnings]);
      }

      // 2. Real HTML5 Canvas Frame-Motion, Scene-Cut & Flash Analysis
      setStatusMessage('Step 2/4: Sampling gameplay frames for motion, scene cuts & flashes...');
      const frameRes = await analyzeVideoFrames(
        activeMedia.objectUrl,
        videoMeta.duration,
        density,
        (pct, stage, sample) => {
          setFrameProgress(pct);
          setOverallProgress(28 + Math.round(pct * 0.44));
          setStatusMessage(`Step 2/4: ${stage}`);
          if (sample) {
            setLiveSamples((prev) => [
              ...prev.slice(-120),
              { motion: sample.motionScore, flash: sample.flashScore },
            ]);
          }
        },
        controller.signal
      );

      // 3. Optional Local Whisper Speech Analysis (Transformers.js)
      let speechSegments: SpeechSegment[] = [];
      let webgpuUsed = false;

      if (runSpeechScan) {
        // Scan up to 180s for long VODs (or full video if <= 180s) so local CPU/WebGPU stays responsive
        const scanEnd = Math.min(videoMeta.duration, 180);
        if (videoMeta.duration > 180) {
          collectedWarnings.push(
            `Local Whisper speech scan analyzed the first 3 minutes (${formatTime(
              scanEnd
            )}) during full-video discovery to keep browser memory responsive. You can still auto-transcribe any individual clip in the Clip Editor.`
          );
          setWarnings([...collectedWarnings]);
        }

        try {
          setStatusMessage('Step 3/4: Running local Whisper speech recognition (Transformers.js)...');
          const speechRes = await transcribeVideoSegment({
            file: activeMedia.file,
            startSec: 0,
            endSec: scanEnd,
            modelId: settings.whisperModel,
            preferWebGPU: settings.preferWebGPU,
            onProgress: (info) => {
              setSpeechProgress(info.progress);
              setOverallProgress(72 + Math.round(info.progress * 0.18));
              setStatusMessage(`Step 3/4: ${info.stage}`);
            },
            signal: controller.signal,
          });
          speechSegments = speechRes.segments;
          webgpuUsed = speechRes.deviceUsed === 'webgpu';
        } catch (spErr) {
          if (controller.signal.aborted) throw spErr;
          const spMsg = spErr instanceof Error ? spErr.message : String(spErr);
          collectedWarnings.push(
            `Local Whisper speech scan was skipped (${spMsg}). Highlights were scored using heuristic audio & visual signals.`
          );
          setWarnings([...collectedWarnings]);
        }
      } else {
        setSpeechProgress(100);
        setOverallProgress(88);
      }

      // 4. Deterministic Highlight Scoring & Real Thumbnail Extraction
      setStatusMessage('Step 4/4: Scoring highlights & capturing real frame thumbnails...');
      const detection = detectHighlights({
        audio: audioRes,
        frames: frameRes,
        speechSegments,
        duration: videoMeta.duration,
        gameCategory: activeProject.gameCategory,
        momentFilters: activeProject.momentFilters,
        customInstructions: activeProject.customInstructions,
      });

      const thumbs: Record<string, string> = {};
      const thumbVideo = document.createElement('video');
      thumbVideo.src = activeMedia.objectUrl;
      thumbVideo.muted = true;
      thumbVideo.playsInline = true;

      try {
        await new Promise<void>((resolve, reject) => {
          thumbVideo.onloadedmetadata = () => resolve();
          thumbVideo.onerror = () => reject(new Error('Could not open video for highlight thumbnails'));
        });

        for (let i = 0; i < detection.highlights.length; i++) {
          if (controller.signal.aborted) throw new Error('Analysis cancelled');
          const hl = detection.highlights[i];
          try {
            thumbs[hl.id] = await captureVideoFrameBlobUrl(thumbVideo, hl.peakTime, 420);
          } catch {
            // Skip individual thumbnail failure safely
          }
          setOverallProgress(90 + Math.round(((i + 1) / Math.max(1, detection.highlights.length)) * 10));
        }
      } finally {
        thumbVideo.src = '';
        thumbVideo.load();
      }

      const elapsedMs = Math.round(performance.now() - startTs);
      const timelineSamples: AnalysisSamplePoint[] = detection.timeline;

      saveAnalysisResults({
        projectId: activeProject.id,
        summary: {
          analyzedAt: new Date().toISOString(),
          method: speechSegments.length > 0 ? 'heuristic-plus-whisper' : 'heuristic-audio-visual',
          audioAnalysisMode: audioRes.mode,
          sampleCount: frameRes.samples.length,
          durationAnalyzed: videoMeta.duration,
          highlightCount: detection.highlights.length,
          speechSegmentsCount: speechSegments.length,
          webgpuUsed,
          processingTimeMs: elapsedMs,
        },
        highlights: detection.highlights,
        timelineSamples,
        speechSegments,
        highlightThumbnails: thumbs,
      });

      setOverallProgress(100);
      setStatusMessage(
        `Complete! Found ${detection.highlights.length} ranked highlights in ${(elapsedMs / 1000).toFixed(1)}s.`
      );
    } catch (err) {
      if ((err as Error).message === 'Analysis cancelled') {
        setStatusMessage('Analysis cancelled by user.');
      } else {
        setError(err instanceof Error ? err.message : 'Unexpected error during video analysis.');
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Video Analysis</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure gaming signals, moment filters, and local inference to scan{' '}
            <span className="font-medium text-zinc-200">{videoMeta.filename}</span> (
            {formatDurationHuman(videoMeta.duration)}).
          </p>
        </div>

        {activeProject.highlights.length > 0 && !running && (
          <button
            onClick={() => setPage('highlights')}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-300 ring-1 ring-sky-500/30 hover:bg-sky-500/25"
          >
            View {activeProject.highlights.length} Highlights
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Configuration */}
        <div className="space-y-5 lg:col-span-7">
          {/* Gaming Category */}
          <div className="studio-panel p-5">
            <h2 className="text-sm font-semibold text-white">1. Gaming Category</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Tunes audio onset, voice reaction, motion speed, and explosion flash weights.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {GAME_CATEGORIES.map((g) => {
                const active = activeProject.gameCategory === g.id;
                return (
                  <button
                    key={g.id}
                    disabled={running}
                    onClick={() => setGameCategory(g.id)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                      active
                        ? 'border-violet-500 bg-violet-500/15 text-violet-200'
                        : 'border-white/[0.07] bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                    }`}
                  >
                    {g.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Gaming Moment Detection Filters */}
          <div className="studio-panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  2. {gameCfg.label} Moment Priorities
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Detection preferences that adjust heuristic signal weighting and speech keyword matching.
                </p>
              </div>
              {activeProject.momentFilters.length > 0 && (
                <button
                  disabled={running}
                  onClick={() => updateProject(activeProject.id, (p) => ({ ...p, momentFilters: [] }))}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {gameCfg.momentFilters.map((filter) => {
                const selected = activeProject.momentFilters.includes(filter);
                return (
                  <button
                    key={filter}
                    disabled={running}
                    onClick={() => toggleMomentFilter(filter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      selected
                        ? 'border-sky-400/60 bg-sky-500/15 text-sky-200'
                        : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User-Guided Custom Instructions */}
          <div className="studio-panel p-5">
            <h2 className="text-sm font-semibold text-white">3. Custom Analysis Instructions</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Describe what you want prioritized. Keywords adjust audio/visual weights and match local speech phrases.
            </p>
            <textarea
              rows={2}
              disabled={running}
              value={activeProject.customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={`e.g., ${gameCfg.samplePrompts[0]}`}
              className="mt-3 w-full rounded-lg border border-white/10 bg-[#0b0d12] p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {gameCfg.samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  disabled={running}
                  onClick={() => setCustomInstructions(prompt)}
                  className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-400 hover:bg-white/[0.09] hover:text-zinc-200"
                >
                  “{prompt}”
                </button>
              ))}
            </div>
          </div>

          {/* Processing Engine Options */}
          <div className="studio-panel p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="h-4 w-4 text-violet-400" />
              4. Local Signal &amp; AI Engine Options
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  { id: 'fast', label: 'Fast', desc: '~70 frame samples' },
                  { id: 'balanced', label: 'Balanced', desc: '~140 frame samples' },
                  { id: 'thorough', label: 'Thorough', desc: '~260 frame samples' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  disabled={running}
                  onClick={() => setDensity(opt.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    density === opt.id
                      ? 'border-violet-500 bg-violet-500/15'
                      : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{opt.label}</div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{opt.desc}</div>
                </button>
              ))}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.07] bg-[#0d1017] p-3.5">
              <input
                type="checkbox"
                disabled={running}
                checked={runSpeechScan}
                onChange={(e) => setRunSpeechScan(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-violet-500"
              />
              <div className="text-xs">
                <div className="flex items-center gap-2 font-semibold text-zinc-100">
                  <Mic className="h-3.5 w-3.5 text-sky-400" />
                  Enable Local Whisper Speech Reaction Detection (Transformers.js)
                </div>
                <p className="mt-1 leading-relaxed text-zinc-400">
                  Downloads &amp; caches <span className="font-mono text-zinc-300">{settings.whisperModel}</span>{' '}
                  locally to detect spoken reactions like “Oh my God!”, “No way!”, “Let’s go!”, and
                  custom prompt keywords. Runs on{' '}
                  <span className="text-sky-300">
                    {capabilities?.hasWebGPU && settings.preferWebGPU ? 'WebGPU' : 'CPU WASM fallback'}
                  </span>
                  . Uncheck for instant heuristic audio + visual scanning.
                </p>
              </div>
            </label>

            <div className="flex items-start gap-2 rounded-lg bg-white/[0.025] p-3 text-[11px] text-zinc-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
              <span>
                <strong className="text-zinc-200">Engine Transparency:</strong> Audio loudness/onset
                and frame motion/scene-cut/flash detection are deterministic heuristic signal
                analyzers. Genuine local semantic speech detection activates when Whisper is enabled
                above (or per-clip in Clip Editor).
              </span>
            </div>
          </div>
        </div>

        {/* Right: Run Panel & Live Telemetry */}
        <div className="space-y-5 lg:col-span-5">
          <div className="studio-panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Analysis Runner</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] text-zinc-300">
                <Cpu className="h-3 w-3 text-sky-400" />
                {capabilities?.hasWebGPU ? 'WebGPU Available' : 'CPU Fallback'}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[#0d1017] p-3">
              <img
                src={activeMedia.thumbnailUrl}
                alt="Source"
                className="h-12 w-20 rounded object-cover"
              />
              <div className="min-w-0 text-xs">
                <div className="truncate font-semibold text-zinc-100">{videoMeta.filename}</div>
                <div className="mt-0.5 text-zinc-400">
                  {videoMeta.width}×{videoMeta.height} • {formatTime(videoMeta.duration)}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-5">
              {running ? (
                <button
                  onClick={handleCancel}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/90 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
                >
                  <Square className="h-4 w-4 fill-current" />
                  Cancel Analysis
                </button>
              ) : (
                <button
                  onClick={handleRunAnalysis}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  <Play className="h-4 w-4 fill-current" />
                  {activeProject.analysisSummary ? 'Re-Analyze Gameplay' : 'Start Gameplay Analysis'}
                </button>
              )}
            </div>

            {/* Real Progress Meters */}
            {(running || overallProgress > 0) && (
              <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200">{statusMessage}</span>
                  <span className="font-mono font-semibold text-violet-300">{overallProgress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-150"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="rounded-lg bg-white/[0.03] p-2">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <AudioWaveform className="h-3 w-3 text-sky-400" />
                      Audio
                    </div>
                    <div className="mt-1 font-mono font-semibold text-zinc-100">{audioProgress}%</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Eye className="h-3 w-3 text-violet-400" />
                      Visual
                    </div>
                    <div className="mt-1 font-mono font-semibold text-zinc-100">{frameProgress}%</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-2">
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Mic className="h-3 w-3 text-emerald-400" />
                      Speech
                    </div>
                    <div className="mt-1 font-mono font-semibold text-zinc-100">
                      {runSpeechScan ? `${speechProgress}%` : 'Off'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Live Motion Signal Visualization */}
            {liveSamples.length > 2 && (
              <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#0b0d12] p-3">
                <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-violet-400" />
                    Live Frame Motion &amp; Flash Telemetry
                  </span>
                  <span className="font-mono">{liveSamples.length} frames</span>
                </div>
                <div className="flex h-16 items-end gap-[2px]">
                  {liveSamples.map((s, idx) => (
                    <div key={idx} className="flex flex-1 flex-col justify-end h-full">
                      <div
                        className="w-full rounded-t-xs transition-all"
                        style={{
                          height: `${Math.max(8, Math.round(s.motion * 100))}%`,
                          backgroundColor: s.flash > 0.5 ? '#f59e0b' : '#8b5cf6',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-200"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Summary Result Card */}
            {activeProject.analysisSummary && !running && (
              <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Analysis Complete — {activeProject.highlights.length} Highlights Ready
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                  <div>
                    Engine:{' '}
                    <span className="font-medium text-white">
                      {activeProject.analysisSummary.method === 'heuristic-plus-whisper'
                        ? 'Heuristic + Local Whisper'
                        : 'Heuristic Audio & Visual'}
                    </span>
                  </div>
                  <div>
                    Frames Sampled:{' '}
                    <span className="font-mono text-white">
                      {activeProject.analysisSummary.sampleCount}
                    </span>
                  </div>
                  <div>
                    Audio Mode:{' '}
                    <span className="font-mono text-white">
                      {activeProject.analysisSummary.audioAnalysisMode}
                    </span>
                  </div>
                  <div>
                    Elapsed:{' '}
                    <span className="font-mono text-white">
                      {(activeProject.analysisSummary.processingTimeMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setPage('highlights')}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Explore Ranked Highlights &amp; Generate Clips
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
