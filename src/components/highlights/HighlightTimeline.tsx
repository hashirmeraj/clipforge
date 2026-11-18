import React from 'react';
import type { AnalysisSamplePoint, Highlight } from '../../types';
import { formatTime } from '../../utils/format';

interface HighlightTimelineProps {
  duration: number;
  samples: AnalysisSamplePoint[];
  highlights: Highlight[];
  activeHighlightId: string | null;
  onSelectHighlight: (hl: Highlight) => void;
}

export const HighlightTimeline: React.FC<HighlightTimelineProps> = ({
  duration,
  samples,
  highlights,
  activeHighlightId,
  onSelectHighlight,
}) => {
  if (duration <= 0) return null;

  return (
    <div className="studio-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Signal &amp; Highlight Timeline</h3>
          <p className="text-xs text-zinc-500">
            Click any highlighted band to preview that gameplay moment.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-sky-400/80" />
            Audio Intensity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-violet-500/80" />
            Visual Motion
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs border border-amber-400 bg-amber-400/25" />
            Detected Highlights
          </span>
        </div>
      </div>

      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-[#0b0d12]">
        {/* Audio & Motion Signal Bars */}
        {samples.length > 0 ? (
          <div className="absolute inset-0 flex items-end gap-px px-0.5 pt-3 pb-1">
            {samples.map((pt, idx) => (
              <div key={idx} className="relative flex h-full flex-1 flex-col justify-end">
                <div
                  className="w-full rounded-t-xs bg-violet-500/45"
                  style={{ height: `${Math.max(4, Math.round(pt.motionScore * 95))}%` }}
                />
                {pt.audioRms > 0 && (
                  <div
                    className="absolute right-0 bottom-0 left-0 rounded-t-xs bg-sky-400/50"
                    style={{ height: `${Math.max(3, Math.round(pt.audioRms * 85))}%` }}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">
            Re-analyze video to display full signal waveform
          </div>
        )}

        {/* Highlight Marker Bands */}
        {highlights.map((hl) => {
          const leftPct = (hl.start / duration) * 100;
          const widthPct = Math.max(1.2, ((hl.end - hl.start) / duration) * 100);
          const isActive = hl.id === activeHighlightId;
          return (
            <button
              key={hl.id}
              onClick={() => onSelectHighlight(hl)}
              title={`#${hl.index} ${hl.title} (${formatTime(hl.start)}–${formatTime(hl.end)}) • Score ${hl.score}/100`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              className={`absolute top-0 bottom-0 border-x transition ${
                isActive
                  ? 'z-20 border-amber-300 bg-amber-400/30'
                  : hl.selected
                  ? 'z-10 border-violet-400/70 bg-violet-500/20 hover:bg-violet-500/35'
                  : 'z-10 border-white/20 bg-white/10 hover:bg-white/20'
              }`}
            >
              <span className="absolute top-1 left-1 rounded bg-black/75 px-1 py-0.5 font-mono text-[9px] font-bold text-white">
                #{hl.index}
              </span>
            </button>
          );
        })}
      </div>

      {/* Timecode ruler */}
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-zinc-500">
        <span>00:00</span>
        <span>{formatTime(duration * 0.25)}</span>
        <span>{formatTime(duration * 0.5)}</span>
        <span>{formatTime(duration * 0.75)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};
