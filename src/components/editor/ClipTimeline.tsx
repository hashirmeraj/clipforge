import React, { useEffect, useRef, useState } from 'react';
import { Film, MessageSquareText, Volume2 } from 'lucide-react';
import type { AnalysisSamplePoint, Clip } from '../../types';
import { clamp, formatTimePrecise } from '../../utils/format';

interface ClipTimelineProps {
  videoDuration: number;
  clip: Clip;
  currentTime: number; // absolute time in source video
  samples: AnalysisSamplePoint[];
  onSeek: (absTime: number) => void;
  onTrimChange: (start: number, end: number) => void;
}

export const ClipTimeline: React.FC<ClipTimelineProps> = ({
  videoDuration,
  clip,
  currentTime,
  samples,
  onSeek,
  onTrimChange,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | 'playhead' | null>(null);

  // Show a contextual zoom window around the clip so trimming is comfortable even on a 2-hour video
  const clipLen = Math.max(1, clip.end - clip.start);
  const margin = Math.min(Math.max(10, clipLen * 0.6), videoDuration * 0.25);
  const viewStart = clamp(clip.start - margin, 0, Math.max(0, videoDuration - 2));
  const viewEnd = clamp(clip.end + margin, Math.min(videoDuration, viewStart + 2), videoDuration);
  const viewSpan = Math.max(1, viewEnd - viewStart);

  const toPct = (t: number) => clamp(((t - viewStart) / viewSpan) * 100, 0, 100);

  const clientXToTime = (clientX: number): number => {
    const el = trackRef.current;
    if (!el) return clip.start;
    const rect = el.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Number((viewStart + ratio * viewSpan).toFixed(2));
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const t = clientXToTime(e.clientX);
      if (dragging === 'start') {
        const nextStart = clamp(t, 0, Math.max(0, clip.end - 1));
        onTrimChange(nextStart, clip.end);
      } else if (dragging === 'end') {
        const nextEnd = clamp(t, Math.min(videoDuration, clip.start + 1), videoDuration);
        onTrimChange(clip.start, nextEnd);
      } else {
        onSeek(clamp(t, clip.start, clip.end));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const visibleSamples = samples.filter((s) => s.time >= viewStart && s.time <= viewEnd);
  const startPct = toPct(clip.start);
  const endPct = toPct(clip.end);
  const playPct = toPct(clamp(currentTime, viewStart, viewEnd));

  return (
    <div className="studio-panel p-4 select-none">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">Clip Timeline</span>
          <span className="font-mono text-zinc-400">
            In: <strong className="text-zinc-200">{formatTimePrecise(clip.start)}</strong>
          </span>
          <span className="font-mono text-zinc-400">
            Out: <strong className="text-zinc-200">{formatTimePrecise(clip.end)}</strong>
          </span>
          <span className="rounded bg-violet-500/15 px-2 py-0.5 font-mono font-semibold text-violet-300">
            {clipLen.toFixed(1)}s
          </span>
        </div>
        <div className="font-mono text-[11px] text-zinc-500">
          Window: {formatTimePrecise(viewStart)} – {formatTimePrecise(viewEnd)}
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={(e) => {
          const t = clientXToTime(e.clientX);
          setDragging('playhead');
          onSeek(clamp(t, clip.start, clip.end));
        }}
        className="relative space-y-1.5 rounded-lg border border-white/[0.08] bg-[#0b0d12] p-2 cursor-pointer"
      >
        {/* Video Track */}
        <div className="relative flex h-9 items-center overflow-hidden rounded bg-white/[0.03]">
          <span className="pointer-events-none z-10 ml-2 flex items-center gap-1 text-[10px] font-medium text-zinc-400">
            <Film className="h-3 w-3" /> Video
          </span>

          {/* Active Trimmed Region */}
          <div
            style={{ left: `${startPct}%`, width: `${Math.max(1, endPct - startPct)}%` }}
            className="absolute top-0 bottom-0 bg-violet-600/30 border-y border-violet-500/60"
          />

          {/* Draggable Start Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragging('start');
            }}
            style={{ left: `${startPct}%` }}
            title="Drag to trim clip start"
            className="absolute top-0 bottom-0 z-20 -ml-1.5 flex w-3 cursor-ew-resize items-center justify-center rounded-l bg-violet-500 hover:bg-violet-400"
          >
            <div className="h-4 w-0.5 rounded bg-white" />
          </div>

          {/* Draggable End Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              setDragging('end');
            }}
            style={{ left: `${endPct}%` }}
            title="Drag to trim clip end"
            className="absolute top-0 bottom-0 z-20 -ml-1.5 flex w-3 cursor-ew-resize items-center justify-center rounded-r bg-violet-500 hover:bg-violet-400"
          >
            <div className="h-4 w-0.5 rounded bg-white" />
          </div>
        </div>

        {/* Caption Track */}
        <div className="relative flex h-7 items-center overflow-hidden rounded bg-white/[0.025]">
          <span className="pointer-events-none z-10 ml-2 flex items-center gap-1 text-[10px] font-medium text-zinc-500">
            <MessageSquareText className="h-3 w-3" /> Captions
          </span>
          {clip.captionsEnabled &&
            clip.captions.map((seg) => {
              const l = toPct(clip.start + seg.start);
              const r = toPct(clip.start + seg.end);
              return (
                <div
                  key={seg.id}
                  style={{ left: `${l}%`, width: `${Math.max(0.8, r - l)}%` }}
                  title={seg.text}
                  className="absolute top-1 bottom-1 truncate rounded bg-amber-400/35 px-1 text-[9px] leading-5 text-amber-100 ring-1 ring-amber-400/50"
                >
                  {seg.text}
                </div>
              );
            })}
        </div>

        {/* Audio Track */}
        <div className="relative flex h-8 items-end overflow-hidden rounded bg-white/[0.025]">
          <span className="pointer-events-none absolute top-1 left-2 z-10 flex items-center gap-1 text-[10px] font-medium text-zinc-500">
            <Volume2 className="h-3 w-3" />
            {clip.muted ? 'Audio Muted' : `Audio ${Math.round(clip.originalVolume * 100)}%`}
            {clip.bgMusicName ? ` + BGM (${clip.bgMusicName})` : ''}
          </span>

          {visibleSamples.length > 0 && (
            <div className="flex h-full w-full items-end gap-px px-1 pt-2 opacity-60">
              {visibleSamples.map((s, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t-xs bg-sky-400/70"
                  style={{
                    height: `${Math.max(8, Math.round((s.audioRms || s.motionScore * 0.5) * 90))}%`,
                  }}
                />
              ))}
            </div>
          )}

          {clip.bgMusicName && (
            <div
              style={{ left: `${startPct}%`, width: `${Math.max(1, endPct - startPct)}%` }}
              className="pointer-events-none absolute bottom-0 h-2 bg-emerald-400/50"
            />
          )}
        </div>

        {/* Playhead Needle */}
        <div
          style={{ left: `${playPct}%` }}
          className="pointer-events-none absolute top-0 bottom-0 z-30 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
        >
          <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
};
