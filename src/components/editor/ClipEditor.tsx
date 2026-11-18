import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Volume2,
  VolumeX,
  Music,
  Crop,
  MessageSquareText,
  Sparkles,
  Sliders,
  Upload,
  X,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import type { AspectRatio, Clip, GamingClipPresetId, VerticalLayout } from '../../types';
import { GAMING_CLIP_PRESETS } from '../../constants/gaming';
import { getCaptionPresetStyle } from '../../constants/captions';
import { createClipFromRange } from '../../services/clipGeneratorService';
import { drawOverlaysToCanvas } from '../../services/captionRendererService';
import { EmptyProjectGuard } from '../common/EmptyProjectGuard';
import { VideoCropper } from './VideoCropper';
import { CaptionEditor } from './CaptionEditor';
import { ClipTimeline } from './ClipTimeline';
import { clamp, formatTimePrecise } from '../../utils/format';

type EditorTab = 'layout' | 'captions' | 'presets' | 'audio';

const LAYOUT_OPTIONS: { id: VerticalLayout; label: string; desc: string }[] = [
  { id: 'smart-crop', label: 'Smart Crop', desc: 'Action-focused vertical framing with drag control' },
  { id: 'center-crop', label: 'Center Crop', desc: 'Clean centered crop of gameplay' },
  { id: 'blurred-bg', label: 'Blurred BG', desc: 'Full landscape gameplay over blurred fill' },
  { id: 'stacked', label: 'Stacked + Cam', desc: 'Gameplay on top, facecam crop on bottom' },
  { id: 'full-gameplay', label: 'Full Gameplay', desc: 'Entire landscape frame with dark studio fill' },
];

export const ClipEditor: React.FC = () => {
  const {
    activeProject,
    activeMedia,
    activeClipId,
    setActiveClipId,
    settings,
    setProjectClips,
    updateClip,
    deleteClip,
    attachClipBgMusic,
    setPage,
  } = useClipForge();

  const [tab, setTab] = useState<EditorTab>('layout');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);

  const clips = activeProject?.clips ?? [];
  const activeClip = clips.find((c) => c.id === activeClipId) ?? clips[0] ?? null;
  const activeClipRef = useRef<Clip | null>(activeClip);
  activeClipRef.current = activeClip;

  // Ensure activeClipId tracks valid clip
  useEffect(() => {
    if (activeClip && activeClip.id !== activeClipId) {
      setActiveClipId(activeClip.id);
    }
  }, [activeClip, activeClipId, setActiveClipId]);

  // Seek video to clip start when switching clips
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    v.pause();
    setPlaying(false);
    v.currentTime = activeClip.start;
    setCurrentTime(activeClip.start);
    if (bgAudioRef.current) {
      bgAudioRef.current.pause();
      bgAudioRef.current.currentTime = 0;
    }
  }, [activeClip?.id]);

  // Sync audio volumes live
  useEffect(() => {
    const v = videoRef.current;
    if (v && activeClip) {
      v.muted = activeClip.muted;
      v.volume = clamp(activeClip.originalVolume, 0, 1);
    }
    const bg = bgAudioRef.current;
    if (bg && activeClip) {
      bg.volume = clamp(activeClip.bgMusicVolume, 0, 1);
    }
  }, [activeClip?.muted, activeClip?.originalVolume, activeClip?.bgMusicVolume]);

  // Real-time Canvas composition loop matching FFmpeg.wasm layout & captions 1:1
  useEffect(() => {
    let rafId = 0;

    const renderFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const clip = activeClipRef.current;

      if (video && canvas && clip && video.readyState >= 2) {
        const w =
          clip.aspectRatio === '9:16' ? 540 : clip.aspectRatio === '1:1' ? 640 : 854;
        const h =
          clip.aspectRatio === '9:16' ? 960 : clip.aspectRatio === '1:1' ? 640 : 480;

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const vw = video.videoWidth || 1280;
          const vh = video.videoHeight || 720;

          ctx.fillStyle = '#0b0d12';
          ctx.fillRect(0, 0, w, h);

          const filterCss = `contrast(${clip.colorGrade.contrast}) saturate(${clip.colorGrade.saturation}) brightness(${
            1 + clip.colorGrade.brightness
          })`;
          ctx.filter = filterCss;

          if (clip.layout === 'blurred-bg' || clip.layout === 'full-gameplay') {
            if (clip.layout === 'blurred-bg') {
              ctx.save();
              ctx.filter = `${filterCss} blur(18px) brightness(0.65)`;
              const bgScale = Math.max(w / vw, h / vh) * 1.08;
              const bw = vw * bgScale;
              const bh = vh * bgScale;
              ctx.drawImage(video, (w - bw) / 2, (h - bh) / 2, bw, bh);
              ctx.restore();
            }
            ctx.filter = filterCss;
            const fgScale = Math.min(w / vw, h / vh);
            const fw = vw * fgScale;
            const fh = vh * fgScale;
            ctx.drawImage(video, (w - fw) / 2, (h - fh) / 2, fw, fh);
          } else if (clip.layout === 'stacked' && clip.aspectRatio === '9:16') {
            const topH = Math.round(h * 0.65);
            const botH = h - topH;
            const topAspect = w / topH;

            let srcTopH = vh / clip.crop.zoom;
            let srcTopW = srcTopH * topAspect;
            if (srcTopW > vw) {
              srcTopW = vw;
              srcTopH = srcTopW / topAspect;
            }
            const sx = clamp(clip.crop.x * vw - srcTopW / 2, 0, Math.max(0, vw - srcTopW));
            const sy = clamp(clip.crop.y * vh - srcTopH / 2, 0, Math.max(0, vh - srcTopH));
            ctx.drawImage(video, sx, sy, srcTopW, srcTopH, 0, 0, w, topH);

            const fcW = clamp(clip.crop.facecamWidth * vw, 32, vw);
            const fcH = clamp(clip.crop.facecamHeight * vh, 32, vh);
            const fcX = clamp(clip.crop.facecamX * vw - fcW / 2, 0, Math.max(0, vw - fcW));
            const fcY = clamp(clip.crop.facecamY * vh - fcH / 2, 0, Math.max(0, vh - fcH));
            ctx.drawImage(video, fcX, fcY, fcW, fcH, 0, topH, w, botH);
          } else {
            const targetAspect = w / h;
            const srcAspect = vw / vh;
            let cropW: number;
            let cropH: number;
            if (srcAspect > targetAspect) {
              cropH = vh / clip.crop.zoom;
              cropW = cropH * targetAspect;
            } else {
              cropW = vw / clip.crop.zoom;
              cropH = cropW / targetAspect;
            }
            cropW = Math.min(vw, cropW);
            cropH = Math.min(vh, cropH);
            const cx = clip.layout === 'center-crop' ? 0.5 : clip.crop.x;
            const cy = clip.layout === 'center-crop' ? 0.5 : clip.crop.y;
            const sx = clamp(cx * vw - cropW / 2, 0, Math.max(0, vw - cropW));
            const sy = clamp(cy * vh - cropH / 2, 0, Math.max(0, vh - cropH));
            ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, w, h);
          }

          ctx.filter = 'none';

          // Composite captions + intro/outro from shared renderer
          if (!overlayCanvasRef.current) {
            overlayCanvasRef.current = document.createElement('canvas');
          }
          const ov = overlayCanvasRef.current;
          if (ov.width !== w || ov.height !== h) {
            ov.width = w;
            ov.height = h;
          }
          const ovCtx = ov.getContext('2d');
          if (ovCtx) {
            const relTime = Math.max(0, video.currentTime - clip.start);
            drawOverlaysToCanvas(ovCtx, w, h, clip, relTime);
            ctx.drawImage(ov, 0, 0);
          }
        }
      }

      rafId = window.requestAnimationFrame(renderFrame);
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  if (!activeProject || !activeMedia || !activeProject.videoMeta) {
    return (
      <EmptyProjectGuard
        title="No Video Loaded in Clip Editor"
        description="Import a gameplay video and generate clips (or create a manual clip) to customize aspect ratio, crop, captions, and audio."
      />
    );
  }

  const videoMeta = activeProject.videoMeta;

  const handleCreateManualClip = () => {
    const dur = Math.min(30, videoMeta.duration);
    const clip = createClipFromRange({
      title: `Manual Clip #${clips.length + 1}`,
      start: 0,
      end: dur,
      targetDuration: Math.round(dur),
      videoDuration: videoMeta.duration,
      speechSegments: activeMedia.speechSegments,
      settings,
    });
    setProjectClips(activeProject.id, [clip], false);
    setActiveClipId(clip.id);
  };

  if (!activeClip) {
    return (
      <div className="studio-panel mx-auto max-w-xl p-8 text-center">
        <h2 className="text-lg font-semibold text-white">No Clips Created Yet</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Generate clips automatically from AI Highlights, or create a manual clip right now.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setPage('highlights')}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Sparkles className="h-4 w-4" />
            Go to AI Highlights
          </button>
          <button
            onClick={handleCreateManualClip}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-white/[0.1]"
          >
            <Plus className="h-4 w-4" />
            Create Manual Clip
          </button>
        </div>
      </div>
    );
  }

  const mutateActiveClip = (updater: (c: Clip) => Clip) => {
    updateClip(activeProject.id, activeClip.id, updater);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < activeClip.start || v.currentTime >= activeClip.end - 0.05) {
        v.currentTime = activeClip.start;
      }
      v.play().then(() => {
        setPlaying(true);
        if (bgAudioRef.current && activeMedia.bgMusicFiles[activeClip.id]) {
          bgAudioRef.current.currentTime = Math.max(0, v.currentTime - activeClip.start) % Math.max(1, bgAudioRef.current.duration || 100);
          bgAudioRef.current.play().catch(() => {});
        }
      }).catch(() => {});
    } else {
      v.pause();
      bgAudioRef.current?.pause();
      setPlaying(false);
    }
  };

  const seekAbsolute = (absSec: number) => {
    const v = videoRef.current;
    const clamped = clamp(absSec, activeClip.start, activeClip.end);
    if (v) v.currentTime = clamped;
    setCurrentTime(clamped);
    if (bgAudioRef.current && activeMedia.bgMusicFiles[activeClip.id]) {
      bgAudioRef.current.currentTime = Math.max(0, clamped - activeClip.start);
    }
  };

  const applyGamingPreset = (presetId: GamingClipPresetId) => {
    const preset = GAMING_CLIP_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    mutateActiveClip((c) => ({
      ...c,
      gamingPreset: presetId,
      layout: preset.layout,
      captionStyle: getCaptionPresetStyle(preset.captionPreset),
      colorGrade: { ...preset.colorGrade },
      introOverlay: preset.introText
        ? { ...c.introOverlay, enabled: true, text: preset.introText }
        : { ...c.introOverlay, enabled: false },
      outroOverlay: preset.outroText
        ? { ...c.outroOverlay, enabled: true, text: preset.outroText }
        : { ...c.outroOverlay, enabled: false },
    }));
  };

  const bgMusicObj = activeMedia.bgMusicFiles[activeClip.id];
  const clipDuration = Math.max(0.5, activeClip.end - activeClip.start);

  return (
    <div className="space-y-5">
      {/* Hidden Source Video & Optional BGM Audio */}
      <video
        ref={videoRef}
        src={activeMedia.objectUrl}
        playsInline
        preload="auto"
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setCurrentTime(t);
          if (t >= activeClip.end) {
            e.currentTarget.currentTime = activeClip.start;
            if (bgAudioRef.current) bgAudioRef.current.currentTime = 0;
          }
        }}
        className="hidden"
      />
      {bgMusicObj && <audio ref={bgAudioRef} src={bgMusicObj.objectUrl} loop className="hidden" />}

      {/* Top Bar: Clip Switcher & Export CTA */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {clips.map((c, idx) => {
            const selected = c.id === activeClip.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveClipId(c.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? 'border-violet-500 bg-violet-500/20 text-white'
                    : 'border-white/[0.08] bg-[#12151e] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="font-mono text-[10px] text-violet-300">#{idx + 1}</span>
                <span className="max-w-[140px] truncate">{c.title}</span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {Math.round(c.end - c.start)}s
                </span>
              </button>
            );
          })}
          <button
            onClick={handleCreateManualClip}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-zinc-400 hover:border-violet-500/50 hover:text-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" />
            New Clip
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => deleteClip(activeProject.id, activeClip.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400 hover:border-red-500/40 hover:text-red-300"
            title="Delete current clip"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
          <button
            onClick={() => setPage('export')}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <Download className="h-3.5 w-3.5" />
            Export Clip(s)
          </button>
        </div>
      </div>

      {/* Main Editor Grid */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left: Live Rendered Preview Stage */}
        <div className="space-y-4 xl:col-span-5">
          <div className="studio-panel flex flex-col items-center p-4">
            {/* Clip Title Input */}
            <div className="mb-3 flex w-full items-center gap-2">
              <input
                type="text"
                value={activeClip.title}
                onChange={(e) => mutateActiveClip((c) => ({ ...c, title: e.target.value }))}
                className="flex-1 rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-1.5 text-sm font-semibold text-white focus:border-violet-500 focus:outline-none"
              />
              <span className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[11px] text-sky-300">
                {activeClip.aspectRatio}
              </span>
            </div>

            {/* Aspect-Aware Live Canvas Stage */}
            <div className="flex w-full items-center justify-center rounded-xl bg-[#07080c] p-3 border border-white/[0.06]">
              <canvas
                ref={canvasRef}
                onClick={togglePlay}
                className={`cursor-pointer rounded-lg shadow-2xl ring-1 ring-white/10 ${
                  activeClip.aspectRatio === '9:16'
                    ? 'h-[470px] w-auto max-w-full'
                    : activeClip.aspectRatio === '1:1'
                    ? 'h-[380px] w-[380px] max-w-full'
                    : 'w-full max-h-[360px] object-contain'
                }`}
              />
            </div>

            {/* Playback Bar */}
            <div className="mt-3 flex w-full items-center gap-3">
              <button
                onClick={togglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <button
                onClick={() => seekAbsolute(activeClip.start)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                title="Restart clip"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <span className="font-mono text-xs text-zinc-300">
                {formatTimePrecise(Math.max(0, currentTime - activeClip.start))}
              </span>

              <input
                type="range"
                min={activeClip.start}
                max={activeClip.end}
                step={0.05}
                value={clamp(currentTime, activeClip.start, activeClip.end)}
                onChange={(e) => seekAbsolute(Number(e.target.value))}
                className="flex-1"
              />

              <span className="font-mono text-xs text-zinc-500">
                {formatTimePrecise(clipDuration)}
              </span>

              <button
                onClick={() => mutateActiveClip((c) => ({ ...c, muted: !c.muted }))}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white"
                title={activeClip.muted ? 'Unmute' : 'Mute'}
              >
                {activeClip.muted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Tabbed Inspector Controls */}
        <div className="studio-panel flex flex-col overflow-hidden xl:col-span-7">
          {/* Inspector Tabs */}
          <div className="grid grid-cols-4 border-b border-white/[0.07] bg-[#0e1017]">
            {(
              [
                { id: 'layout', label: 'Trim & Layout', icon: Crop },
                { id: 'captions', label: 'Captions', icon: MessageSquareText },
                { id: 'presets', label: 'Gaming Presets', icon: Sparkles },
                { id: 'audio', label: 'Audio & BGM', icon: Music },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 border-b-2 py-3 text-xs font-semibold transition ${
                    active
                      ? 'border-violet-500 bg-violet-500/10 text-violet-200'
                      : 'border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="max-h-[560px] overflow-y-auto p-5">
            {/* TAB 1: TRIM, ASPECT RATIO, VERTICAL LAYOUT & MANUAL CROP */}
            {tab === 'layout' && (
              <div className="space-y-5">
                {/* Exact Trim Controls */}
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/[0.07] bg-[#0d1017] p-3.5 text-xs">
                  <div>
                    <label className="text-[11px] text-zinc-400">Start (sec)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={Math.max(0, activeClip.end - 0.5)}
                      value={activeClip.start}
                      onChange={(e) => {
                        const nextStart = clamp(Number(e.target.value), 0, Math.max(0, activeClip.end - 0.5));
                        mutateActiveClip((c) => ({ ...c, start: Number(nextStart.toFixed(2)) }));
                        seekAbsolute(nextStart);
                      }}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151e] px-2.5 py-1.5 font-mono text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">End (sec)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={activeClip.start + 0.5}
                      max={videoMeta.duration}
                      value={activeClip.end}
                      onChange={(e) => {
                        const nextEnd = clamp(
                          Number(e.target.value),
                          Math.min(videoMeta.duration, activeClip.start + 0.5),
                          videoMeta.duration
                        );
                        mutateActiveClip((c) => ({ ...c, end: Number(nextEnd.toFixed(2)) }));
                      }}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151e] px-2.5 py-1.5 font-mono text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400">Quick Duration</label>
                    <select
                      value=""
                      onChange={(e) => {
                        const dur = Number(e.target.value);
                        if (!dur) return;
                        const nextEnd = clamp(activeClip.start + dur, activeClip.start + 1, videoMeta.duration);
                        mutateActiveClip((c) => ({
                          ...c,
                          end: Number(nextEnd.toFixed(2)),
                          targetDuration: dur,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151e] px-2.5 py-1.5 text-zinc-100"
                    >
                      <option value="">Set length ({clipDuration.toFixed(1)}s)</option>
                      {[15, 30, 45, 60, 90, 120, 180].map((s) => (
                        <option key={s} value={s}>
                          {s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s}s`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="text-xs font-semibold text-zinc-200">Output Aspect Ratio</label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: '9:16', label: '9:16 Vertical', sub: 'Shorts / TikTok / Reels' },
                        { id: '16:9', label: '16:9 Landscape', sub: 'YouTube Original' },
                        { id: '1:1', label: '1:1 Square', sub: 'Feed / Social' },
                      ] as { id: AspectRatio; label: string; sub: string }[]
                    ).map((ar) => (
                      <button
                        key={ar.id}
                        type="button"
                        onClick={() => mutateActiveClip((c) => ({ ...c, aspectRatio: ar.id }))}
                        className={`rounded-lg border p-2.5 text-left transition ${
                          activeClip.aspectRatio === ar.id
                            ? 'border-violet-500 bg-violet-500/15 text-white'
                            : 'border-white/[0.08] bg-[#0d1017] text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xs font-semibold">{ar.label}</div>
                        <div className="text-[10px] text-zinc-500">{ar.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vertical Conversion Layout */}
                <div>
                  <label className="text-xs font-semibold text-zinc-200">Framing Layout</label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {LAYOUT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => mutateActiveClip((c) => ({ ...c, layout: opt.id }))}
                        className={`rounded-lg border p-2.5 text-left transition ${
                          activeClip.layout === opt.id
                            ? 'border-sky-400/70 bg-sky-500/15 text-white'
                            : 'border-white/[0.08] bg-[#0d1017] text-zinc-400 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xs font-semibold">{opt.label}</div>
                        <div className="mt-0.5 text-[10px] text-zinc-500">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interactive Manual Crop Tool */}
                <VideoCropper
                  videoUrl={activeMedia.objectUrl}
                  sourceMeta={videoMeta}
                  clip={activeClip}
                  currentTime={currentTime}
                  onUpdateCrop={(patch) =>
                    mutateActiveClip((c) => ({ ...c, crop: { ...c.crop, ...patch } }))
                  }
                  onChangeLayout={(layout) => mutateActiveClip((c) => ({ ...c, layout }))}
                />
              </div>
            )}

            {/* TAB 2: CAPTIONS */}
            {tab === 'captions' && (
              <CaptionEditor
                clip={activeClip}
                sourceFile={activeMedia.file}
                onUpdateClip={mutateActiveClip}
                onSeekRelative={(rel) => seekAbsolute(activeClip.start + rel)}
              />
            )}

            {/* TAB 3: GAMING PRESETS, INTRO/OUTRO & COLOR */}
            {tab === 'presets' && (
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs font-semibold text-zinc-200">
                    Gaming-Specific Clip Presets
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {GAMING_CLIP_PRESETS.map((preset) => {
                      const active = activeClip.gamingPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyGamingPreset(preset.id)}
                          className={`rounded-lg border p-3 text-left transition ${
                            active
                              ? 'border-violet-500 bg-violet-500/15'
                              : 'border-white/[0.08] bg-[#0d1017] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white">{preset.name}</span>
                            <span className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10px] text-sky-300">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-zinc-400">{preset.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Intro Text */}
                <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 font-semibold text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClip.introOverlay.enabled}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            introOverlay: { ...c.introOverlay, enabled: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 accent-violet-500"
                      />
                      Custom Intro Hook Text
                    </label>
                    <span className="font-mono text-[11px] text-zinc-400">
                      First {activeClip.introOverlay.duration}s
                    </span>
                  </div>
                  <input
                    type="text"
                    value={activeClip.introOverlay.text}
                    onChange={(e) =>
                      mutateActiveClip((c) => ({
                        ...c,
                        introOverlay: { ...c.introOverlay, text: e.target.value, enabled: true },
                      }))
                    }
                    placeholder="e.g., WAIT FOR THIS ENDING..."
                    className="w-full rounded-lg border border-white/10 bg-[#12151e] px-3 py-2 text-xs text-white placeholder-zinc-500"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[11px] text-zinc-400">Duration (s)</span>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        step={0.5}
                        value={activeClip.introOverlay.duration}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            introOverlay: { ...c.introOverlay, duration: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-400">Size ({activeClip.introOverlay.fontSize})</span>
                      <input
                        type="range"
                        min={28}
                        max={76}
                        value={activeClip.introOverlay.fontSize}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            introOverlay: { ...c.introOverlay, fontSize: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <label className="flex items-center justify-between rounded border border-white/10 bg-[#12151e] px-2 py-1">
                      <span className="text-[11px] text-zinc-400">Color</span>
                      <input
                        type="color"
                        value={activeClip.introOverlay.color}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            introOverlay: { ...c.introOverlay, color: e.target.value },
                          }))
                        }
                        className="h-5 w-7 bg-transparent"
                      />
                    </label>
                  </div>
                </div>

                {/* Custom Outro Text */}
                <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 font-semibold text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeClip.outroOverlay.enabled}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            outroOverlay: { ...c.outroOverlay, enabled: e.target.checked },
                          }))
                        }
                        className="h-4 w-4 accent-violet-500"
                      />
                      Custom Ending Text
                    </label>
                    <span className="font-mono text-[11px] text-zinc-400">
                      Last {activeClip.outroOverlay.duration}s
                    </span>
                  </div>
                  <input
                    type="text"
                    value={activeClip.outroOverlay.text}
                    onChange={(e) =>
                      mutateActiveClip((c) => ({
                        ...c,
                        outroOverlay: { ...c.outroOverlay, text: e.target.value, enabled: true },
                      }))
                    }
                    placeholder="e.g., SUBSCRIBE FOR PART 2!"
                    className="w-full rounded-lg border border-white/10 bg-[#12151e] px-3 py-2 text-xs text-white placeholder-zinc-500"
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[11px] text-zinc-400">Duration (s)</span>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        step={0.5}
                        value={activeClip.outroOverlay.duration}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            outroOverlay: { ...c.outroOverlay, duration: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-zinc-400">Size ({activeClip.outroOverlay.fontSize})</span>
                      <input
                        type="range"
                        min={28}
                        max={76}
                        value={activeClip.outroOverlay.fontSize}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            outroOverlay: { ...c.outroOverlay, fontSize: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <label className="flex items-center justify-between rounded border border-white/10 bg-[#12151e] px-2 py-1">
                      <span className="text-[11px] text-zinc-400">Color</span>
                      <input
                        type="color"
                        value={activeClip.outroOverlay.color}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            outroOverlay: { ...c.outroOverlay, color: e.target.value },
                          }))
                        }
                        className="h-5 w-7 bg-transparent"
                      />
                    </label>
                  </div>
                </div>

                {/* Color Grade Fine Tuning */}
                <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
                      <Sliders className="h-3.5 w-3.5 text-sky-400" />
                      Visual Color Punch (Applied in FFmpeg Export)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        mutateActiveClip((c) => ({
                          ...c,
                          colorGrade: { contrast: 1, saturation: 1, brightness: 0 },
                        }))
                      }
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Contrast</span>
                        <span className="font-mono">{activeClip.colorGrade.contrast.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={1.35}
                        step={0.02}
                        value={activeClip.colorGrade.contrast}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            colorGrade: { ...c.colorGrade, contrast: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Saturation</span>
                        <span className="font-mono">{activeClip.colorGrade.saturation.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={1.5}
                        step={0.02}
                        value={activeClip.colorGrade.saturation}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            colorGrade: { ...c.colorGrade, saturation: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-400">
                        <span>Brightness</span>
                        <span className="font-mono">{activeClip.colorGrade.brightness.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={-0.15}
                        max={0.15}
                        step={0.01}
                        value={activeClip.colorGrade.brightness}
                        onChange={(e) =>
                          mutateActiveClip((c) => ({
                            ...c,
                            colorGrade: { ...c.colorGrade, brightness: Number(e.target.value) },
                          }))
                        }
                        className="mt-1 w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AUDIO & BACKGROUND MUSIC */}
            {tab === 'audio' && (
              <div className="space-y-5 text-xs">
                <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">Original Gameplay Audio</span>
                    <button
                      type="button"
                      onClick={() => mutateActiveClip((c) => ({ ...c, muted: !c.muted }))}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                        activeClip.muted
                          ? 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
                          : 'bg-white/[0.06] text-zinc-200 hover:bg-white/[0.12]'
                      }`}
                    >
                      {activeClip.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                      {activeClip.muted ? 'Muted' : 'Mute Audio'}
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Original Volume (up to 200% boost in export)</span>
                      <span className="font-mono font-semibold text-zinc-100">
                        {Math.round(activeClip.originalVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      disabled={activeClip.muted}
                      value={activeClip.originalVolume}
                      onChange={(e) =>
                        mutateActiveClip((c) => ({ ...c, originalVolume: Number(e.target.value) }))
                      }
                      className="mt-2 w-full"
                    />
                  </div>
                </div>

                {/* Local Background Audio Track */}
                <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-4 space-y-4">
                  <div>
                    <div className="font-semibold text-white">Optional Background Music Track</div>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      Attach a local MP3, WAV, OGG, or M4A track. Mixed locally into the exported MP4
                      using FFmpeg <code className="text-zinc-300">amix</code>.
                    </p>
                  </div>

                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) attachClipBgMusic(activeProject.id, activeClip.id, f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />

                  {bgMusicObj ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Music className="h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="truncate font-medium text-emerald-200">
                          {bgMusicObj.file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => attachClipBgMusic(activeProject.id, activeClip.id, null)}
                        className="rounded p-1 text-emerald-200 hover:bg-black/20"
                        title="Remove background music"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => bgFileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] py-4 text-xs font-medium text-zinc-300 hover:border-violet-500/50 hover:bg-white/[0.04]"
                    >
                      <Upload className="h-4 w-4 text-violet-400" />
                      Choose Local Audio Track (MP3 / WAV / OGG / M4A)
                    </button>
                  )}

                  <div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Background Music Volume</span>
                      <span className="font-mono font-semibold text-zinc-100">
                        {Math.round(activeClip.bgMusicVolume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      disabled={!bgMusicObj}
                      value={activeClip.bgMusicVolume}
                      onChange={(e) =>
                        mutateActiveClip((c) => ({ ...c, bgMusicVolume: Number(e.target.value) }))
                      }
                      className="mt-2 w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Interactive Multi-Track Timeline */}
      <ClipTimeline
        videoDuration={videoMeta.duration}
        clip={activeClip}
        currentTime={currentTime}
        samples={activeMedia.timelineSamples}
        onSeek={seekAbsolute}
        onTrimChange={(start, end) =>
          mutateActiveClip((c) => ({ ...c, start, end }))
        }
      />
    </div>
  );
};
