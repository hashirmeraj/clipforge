import React from 'react';
import {
  Play,
  Trash2,
  CheckSquare,
  Square,
  AudioWaveform,
  Eye,
  Mic,
  Film,
  Scissors,
} from 'lucide-react';
import type { Highlight } from '../../types';
import { formatTime } from '../../utils/format';

interface HighlightCardProps {
  highlight: Highlight;
  thumbnailUrl?: string;
  isPreviewing: boolean;
  onToggleSelect: () => void;
  onPreview: () => void;
  onRemove: () => void;
  onQuickCreateClip: () => void;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  highlight,
  thumbnailUrl,
  isPreviewing,
  onToggleSelect,
  onPreview,
  onRemove,
  onQuickCreateClip,
}) => {
  const scoreColor =
    highlight.score >= 85
      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
      : highlight.score >= 65
      ? 'bg-violet-500/15 text-violet-300 ring-violet-500/30'
      : 'bg-sky-500/15 text-sky-300 ring-sky-500/30';

  return (
    <div
      className={`studio-panel overflow-hidden transition ${
        isPreviewing
          ? 'ring-2 ring-violet-500'
          : highlight.selected
          ? 'border-violet-500/40'
          : 'opacity-85 hover:opacity-100'
      }`}
    >
      {/* Thumbnail Header */}
      <div className="relative aspect-video w-full bg-[#090b10]">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={highlight.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-600">
            <Film className="h-7 w-7" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />

        {/* Top Badges */}
        <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between">
          <button
            onClick={onToggleSelect}
            className="inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-black/90"
          >
            {highlight.selected ? (
              <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
            ) : (
              <Square className="h-3.5 w-3.5 text-zinc-400" />
            )}
            #{String(highlight.index).padStart(2, '0')}
          </button>

          <span
            className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold ring-1 backdrop-blur-xs ${scoreColor}`}
          >
            {highlight.score}/100
          </span>
        </div>

        {/* Center Play Preview */}
        <button
          onClick={onPreview}
          className="absolute inset-0 flex items-center justify-center group"
          aria-label={`Preview ${highlight.title}`}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white ring-1 ring-white/25 transition group-hover:scale-105 group-hover:bg-violet-600">
            <Play className="h-5 w-5 fill-current ml-0.5" />
          </span>
        </button>

        {/* Bottom Timestamp */}
        <div className="absolute right-2.5 bottom-2 left-2.5 flex items-center justify-between text-[11px]">
          <span className="rounded bg-black/75 px-1.5 py-0.5 font-mono text-zinc-200">
            {formatTime(highlight.start)} – {formatTime(highlight.end)}
          </span>
          <span className="rounded bg-black/75 px-1.5 py-0.5 font-mono text-zinc-300">
            {Math.round(highlight.duration)}s
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="inline-block rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
              {highlight.category}
            </span>
            <h3 className="mt-1 truncate text-sm font-bold text-white" title={highlight.title}>
              {highlight.title}
            </h3>
          </div>
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
            title="Remove highlight"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">{highlight.reason}</p>

        {/* Signal Breakdown */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] text-zinc-400">
          <span className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5">
            <AudioWaveform className="h-3 w-3 text-sky-400" />
            Audio {highlight.signals.audioScore}
          </span>
          <span className="inline-flex items-center gap-1 rounded bg-white/[0.04] px-1.5 py-0.5">
            <Eye className="h-3 w-3 text-violet-400" />
            Motion {highlight.signals.motionIntensity}
          </span>
          {highlight.signals.speechScore > 0 && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
              <Mic className="h-3 w-3" />
              Speech {highlight.signals.speechScore}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t border-white/[0.06] pt-2.5">
          <button
            onClick={onPreview}
            className="flex-1 rounded-lg bg-white/[0.06] py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.12]"
          >
            Preview
          </button>
          <button
            onClick={onQuickCreateClip}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-600/90 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <Scissors className="h-3 w-3" />
            Edit Clip
          </button>
        </div>
      </div>
    </div>
  );
};
