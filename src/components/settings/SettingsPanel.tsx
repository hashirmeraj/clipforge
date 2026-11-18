import React, { useState } from 'react';
import {
  Cpu,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  Sliders,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { CLIP_DURATION_PRESETS, GAME_CATEGORIES } from '../../constants/gaming';
import { CAPTION_PRESETS } from '../../constants/captions';
import type {
  AnalysisDensity,
  AspectRatio,
  CaptionPresetId,
  ExportFps,
  ExportQuality,
  ExportResolution,
  GameCategory,
  VerticalLayout,
} from '../../types';
import { getLocalStorageUsageBytes } from '../../services/capabilitiesService';
import { isFFmpegLoaded, loadFFmpegEngine } from '../../services/ffmpegService';
import { formatBytes } from '../../utils/format';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings, resetSettings, capabilities } = useClipForge();
  const [ffmpegStatus, setFfmpegStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isFFmpegLoaded() ? 'ready' : 'idle'
  );
  const [ffmpegMsg, setFfmpegMsg] = useState<string>(
    isFFmpegLoaded() ? 'FFmpeg.wasm core is loaded and ready in Web Worker.' : ''
  );

  const storageBytes = getLocalStorageUsageBytes();

  const toggleDefaultDuration = (sec: number) => {
    const exists = settings.defaultClipDurations.includes(sec);
    const next = exists
      ? settings.defaultClipDurations.filter((d) => d !== sec)
      : [...settings.defaultClipDurations, sec].sort((a, b) => a - b);
    if (next.length > 0) {
      updateSettings({ defaultClipDurations: next });
    }
  };

  const handleTestFFmpeg = async () => {
    setFfmpegStatus('loading');
    setFfmpegMsg('Initializing FFmpeg.wasm worker...');
    try {
      await loadFFmpegEngine((stage) => setFfmpegMsg(stage));
      setFfmpegStatus('ready');
      setFfmpegMsg('FFmpeg.wasm verified & ready for local MP4 exporting.');
    } catch (err) {
      setFfmpegStatus('error');
      setFfmpegMsg(err instanceof Error ? err.message : 'Failed to initialize FFmpeg.wasm.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure defaults for analysis, vertical conversion, captions, and FFmpeg.wasm export.
            All preferences persist in LocalStorage.
          </p>
        </div>

        <button
          onClick={resetSettings}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.08]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Workflow Defaults */}
        <div className="space-y-5 lg:col-span-7">
          <div className="studio-panel p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sliders className="h-4 w-4 text-violet-400" />
              Project &amp; Clip Defaults
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <label className="text-zinc-400">Default Gaming Category</label>
                <select
                  value={settings.defaultGameCategory}
                  onChange={(e) =>
                    updateSettings({ defaultGameCategory: e.target.value as GameCategory })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  {GAME_CATEGORIES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Default Aspect Ratio</label>
                <select
                  value={settings.defaultAspectRatio}
                  onChange={(e) =>
                    updateSettings({ defaultAspectRatio: e.target.value as AspectRatio })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="9:16">9:16 Vertical (Shorts / TikTok)</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="1:1">1:1 Square</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Default Vertical Layout</label>
                <select
                  value={settings.defaultLayout}
                  onChange={(e) =>
                    updateSettings({ defaultLayout: e.target.value as VerticalLayout })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="smart-crop">Smart Crop (Motion-anchored)</option>
                  <option value="center-crop">Center Crop</option>
                  <option value="blurred-bg">Blurred Background</option>
                  <option value="stacked">Stacked (Gameplay + Facecam)</option>
                  <option value="full-gameplay">Full Gameplay</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Default Caption Style Preset</label>
                <select
                  value={settings.defaultCaptionPreset}
                  onChange={(e) =>
                    updateSettings({ defaultCaptionPreset: e.target.value as CaptionPresetId })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  {CAPTION_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-1 text-xs">
              <label className="text-zinc-400">Default Auto-Clip Durations</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CLIP_DURATION_PRESETS.map((d) => {
                  const active = settings.defaultClipDurations.includes(d.seconds);
                  return (
                    <button
                      key={d.seconds}
                      type="button"
                      onClick={() => toggleDefaultDuration(d.seconds)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                          : 'border-white/10 bg-[#0b0d12] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Export & Local AI Preferences */}
          <div className="studio-panel p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-sky-400" />
              Export &amp; Local AI Processing
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
              <div>
                <label className="text-zinc-400">Default Resolution</label>
                <select
                  value={settings.defaultExportResolution}
                  onChange={(e) =>
                    updateSettings({
                      defaultExportResolution: e.target.value as ExportResolution,
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (Faster / Low RAM)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Default FPS</label>
                <select
                  value={settings.defaultExportFps}
                  onChange={(e) =>
                    updateSettings({ defaultExportFps: Number(e.target.value) as ExportFps })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Default Quality</label>
                <select
                  value={settings.defaultExportQuality}
                  onChange={(e) =>
                    updateSettings({ defaultExportQuality: e.target.value as ExportQuality })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="maximum">Maximum</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <label className="text-zinc-400">Default Analysis Density</label>
                <select
                  value={settings.analysisDensity}
                  onChange={(e) =>
                    updateSettings({ analysisDensity: e.target.value as AnalysisDensity })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="fast">Fast (~70 samples)</option>
                  <option value="balanced">Balanced (~140 samples)</option>
                  <option value="thorough">Thorough (~260 samples)</option>
                </select>
              </div>

              <div>
                <label className="text-zinc-400">Local Whisper Model (Transformers.js)</label>
                <select
                  value={settings.whisperModel}
                  onChange={(e) =>
                    updateSettings({
                      whisperModel: e.target.value as 'Xenova/whisper-tiny.en' | 'Xenova/whisper-base.en',
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-zinc-100"
                >
                  <option value="Xenova/whisper-tiny.en">Whisper Tiny EN (~40 MB • Fastest)</option>
                  <option value="Xenova/whisper-base.en">Whisper Base EN (~75 MB • Higher Accuracy)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5 pt-1 text-xs">
              <label className="flex items-center gap-2.5 text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.preferWebGPU}
                  onChange={(e) => updateSettings({ preferWebGPU: e.target.checked })}
                  className="h-4 w-4 accent-violet-500"
                />
                Prefer WebGPU acceleration for local Whisper when supported (auto-falls back to CPU WASM)
              </label>

              <label className="flex items-center gap-2.5 text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableLocalWhisper}
                  onChange={(e) => updateSettings({ enableLocalWhisper: e.target.checked })}
                  className="h-4 w-4 accent-violet-500"
                />
                Enable local Whisper speech scan by default during full-video analysis
              </label>

              <div className="flex items-center gap-3 pt-1">
                <span className="text-zinc-400">Large File Warning Threshold:</span>
                <input
                  type="range"
                  min={200}
                  max={2048}
                  step={50}
                  value={settings.largeFileWarningMB}
                  onChange={(e) => updateSettings({ largeFileWarningMB: Number(e.target.value) })}
                  className="w-36"
                />
                <span className="font-mono text-zinc-200">{settings.largeFileWarningMB} MB</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: System Capabilities & FFmpeg Diagnostics */}
        <div className="space-y-5 lg:col-span-5">
          <div className="studio-panel p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Cpu className="h-4 w-4 text-sky-400" />
              Browser Capabilities &amp; Diagnostics
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="text-zinc-400">WebGPU Acceleration</span>
                <span
                  className={
                    capabilities?.hasWebGPU
                      ? 'font-semibold text-emerald-400'
                      : 'font-medium text-amber-300'
                  }
                >
                  {capabilities?.hasWebGPU ? 'Supported' : 'Unavailable (CPU Fallback Active)'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="text-zinc-400">Web Audio API</span>
                <span className="font-semibold text-emerald-400">
                  {capabilities?.hasWebAudio ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="text-zinc-400">Web Workers</span>
                <span className="font-semibold text-emerald-400">
                  {capabilities?.hasWorkers ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="text-zinc-400">CPU Logical Cores</span>
                <span className="font-mono text-zinc-200">
                  {capabilities?.hardwareConcurrency ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="text-zinc-400">Reported Device Memory</span>
                <span className="font-mono text-zinc-200">
                  {capabilities?.deviceMemoryGB ? `${capabilities.deviceMemoryGB} GB` : 'Not exposed'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-[#0d1017] px-3 py-2">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <HardDrive className="h-3.5 w-3.5" />
                  LocalStorage Metadata Usage
                </span>
                <span className="font-mono text-zinc-200">{formatBytes(storageBytes)}</span>
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">FFmpeg.wasm Export Engine</span>
                <span className="text-[11px] text-zinc-500">Single-Thread Worker Core</span>
              </div>

              <button
                onClick={handleTestFFmpeg}
                disabled={ffmpegStatus === 'loading'}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 py-2.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
              >
                {ffmpegStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading FFmpeg Core...
                  </>
                ) : ffmpegStatus === 'ready' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    FFmpeg.wasm Loaded &amp; Verified
                  </>
                ) : (
                  'Pre-load & Verify FFmpeg.wasm Engine'
                )}
              </button>

              {ffmpegMsg && (
                <div
                  className={`flex items-start gap-2 rounded-lg p-2.5 text-[11px] ${
                    ffmpegStatus === 'error'
                      ? 'bg-red-500/10 text-red-300'
                      : 'bg-white/[0.03] text-zinc-400'
                  }`}
                >
                  {ffmpegStatus === 'error' && <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <span>{ffmpegMsg}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
