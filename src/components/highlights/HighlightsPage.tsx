import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpDown,
  CheckSquare,
  Square,
  Filter,
  Sparkles,
  X,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import type { Highlight, HighlightCategory } from '../../types';
import { createClipFromRange } from '../../services/clipGeneratorService';
import { EmptyProjectGuard } from '../common/EmptyProjectGuard';
import { VideoPreview } from '../common/VideoPreview';
import { HighlightTimeline } from './HighlightTimeline';
import { HighlightCard } from './HighlightCard';
import { ClipGenerator } from './ClipGenerator';
import { formatTime } from '../../utils/format';

type SortMode = 'score' | 'timestamp';

export const HighlightsPage: React.FC = () => {
  const {
    activeProject,
    activeMedia,
    settings,
    updateProject,
    setProjectClips,
    setActiveClipId,
    setPage,
  } = useClipForge();

  const [sortBy, setSortBy] = useState<SortMode>('score');
  const [categoryFilter, setCategoryFilter] = useState<HighlightCategory | 'ALL'>('ALL');
  const [previewHighlightId, setPreviewHighlightId] = useState<string | null>(null);

  const highlights = activeProject?.highlights ?? [];

  const categories = useMemo(() => {
    const set = new Set<HighlightCategory>();
    highlights.forEach((h) => set.add(h.category));
    return Array.from(set);
  }, [highlights]);

  const filteredHighlights = useMemo(() => {
    const list =
      categoryFilter === 'ALL'
        ? [...highlights]
        : highlights.filter((h) => h.category === categoryFilter);
    if (sortBy === 'score') {
      list.sort((a, b) => b.score - a.score);
    } else {
      list.sort((a, b) => a.start - b.start);
    }
    return list;
  }, [highlights, categoryFilter, sortBy]);

  if (!activeProject || !activeMedia || !activeProject.videoMeta) {
    return (
      <EmptyProjectGuard
        title="No Video Loaded for Highlights"
        description="Import a gameplay video and run analysis to discover ranked highlights."
      />
    );
  }

  if (highlights.length === 0) {
    return (
      <div className="studio-panel mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">No Highlights Detected Yet</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Run the local audio, visual motion, and optional speech analyzer on{' '}
          <span className="font-medium text-zinc-200">{activeProject.videoMeta.filename}</span> to
          rank exciting gameplay moments.
        </p>
        <button
          onClick={() => setPage('analyze')}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
        >
          <Activity className="h-4 w-4" />
          Go to Video Analysis
        </button>
      </div>
    );
  }

  const previewHighlight = highlights.find((h) => h.id === previewHighlightId) ?? null;
  const allSelected = highlights.length > 0 && highlights.every((h) => h.selected);

  const toggleSelect = (id: string) => {
    updateProject(activeProject.id, (p) => ({
      ...p,
      highlights: p.highlights.map((h) => (h.id === id ? { ...h, selected: !h.selected } : h)),
    }));
  };

  const toggleSelectAll = () => {
    const nextVal = !allSelected;
    updateProject(activeProject.id, (p) => ({
      ...p,
      highlights: p.highlights.map((h) => ({ ...h, selected: nextVal })),
    }));
  };

  const removeHighlight = (id: string) => {
    if (previewHighlightId === id) setPreviewHighlightId(null);
    updateProject(activeProject.id, (p) => ({
      ...p,
      highlights: p.highlights.filter((h) => h.id !== id),
    }));
  };

  const quickCreateSingleClip = (hl: Highlight) => {
    const clip = createClipFromRange({
      title: hl.title,
      start: hl.start,
      end: hl.end,
      targetDuration: Math.round(hl.duration),
      videoDuration: activeProject.videoMeta!.duration,
      highlight: hl,
      speechSegments: activeMedia.speechSegments,
      settings,
    });
    setProjectClips(activeProject.id, [clip], false);
    setActiveClipId(clip.id);
    setPage('editor');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AI Highlights</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {highlights.length} ranked gameplay moments detected from real audio/visual signals.
            Select highlights and generate clips below.
          </p>
        </div>

        <button
          onClick={() => setPage('analyze')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
        >
          <Activity className="h-3.5 w-3.5 text-violet-400" />
          Re-run Analysis
        </button>
      </div>

      {/* Signal Timeline */}
      <HighlightTimeline
        duration={activeProject.videoMeta.duration}
        samples={activeMedia.timelineSamples}
        highlights={highlights}
        activeHighlightId={previewHighlightId}
        onSelectHighlight={(hl) => setPreviewHighlightId(hl.id)}
      />

      {/* Inline Highlight Video Preview Drawer */}
      {previewHighlight && (
        <div className="studio-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="rounded bg-violet-500/20 px-2 py-0.5 font-mono text-xs font-bold text-violet-300">
                #{String(previewHighlight.index).padStart(2, '0')}
              </span>
              <h3 className="text-sm font-bold text-white">{previewHighlight.title}</h3>
              <span className="font-mono text-xs text-zinc-400">
                {formatTime(previewHighlight.start)} – {formatTime(previewHighlight.end)}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-300">
                {previewHighlight.score}/100
              </span>
            </div>
            <button
              onClick={() => setPreviewHighlightId(null)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <VideoPreview
                src={activeMedia.objectUrl}
                startTime={previewHighlight.start}
                endTime={previewHighlight.end}
                autoPlay
                loopSegment
              />
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-[#0d1017] p-4 lg:col-span-4">
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-zinc-500">Category</div>
                  <div className="mt-0.5 font-semibold text-sky-300">{previewHighlight.category}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Reason Selected</div>
                  <p className="mt-0.5 leading-relaxed text-zinc-200">{previewHighlight.reason}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-white/[0.04] p-2">
                    <div className="text-zinc-500">Audio Peak</div>
                    <div className="font-mono font-semibold text-zinc-100">
                      {previewHighlight.signals.audioPeakDb} dBFS
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-2">
                    <div className="text-zinc-500">Motion Score</div>
                    <div className="font-mono font-semibold text-zinc-100">
                      {previewHighlight.signals.motionIntensity}/100
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-2">
                    <div className="text-zinc-500">Scene Cuts</div>
                    <div className="font-mono font-semibold text-zinc-100">
                      {previewHighlight.signals.sceneCutCount}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/[0.04] p-2">
                    <div className="text-zinc-500">Smart Anchor</div>
                    <div className="font-mono font-semibold text-zinc-100">
                      {Math.round(previewHighlight.signals.motionCenterX * 100)}% X
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => quickCreateSingleClip(previewHighlight)}
                className="mt-4 w-full rounded-lg bg-violet-600 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
              >
                Open This Highlight in Clip Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Automatic Clip Generator */}
      <ClipGenerator />

      {/* Filter & Sort Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
          >
            {allSelected ? (
              <CheckSquare className="h-3.5 w-3.5 text-violet-400" />
            ) : (
              <Square className="h-3.5 w-3.5 text-zinc-400" />
            )}
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#10131b] px-2.5 py-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as HighlightCategory | 'ALL')}
              className="bg-transparent text-zinc-200 focus:outline-none"
            >
              <option value="ALL" className="bg-[#12151e]">
                All Categories ({highlights.length})
              </option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#12151e]">
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#10131b] p-1 text-xs">
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 text-zinc-400" />
          <button
            onClick={() => setSortBy('score')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              sortBy === 'score' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Score
          </button>
          <button
            onClick={() => setSortBy('timestamp')}
            className={`rounded-md px-2.5 py-1 font-medium transition ${
              sortBy === 'timestamp'
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Timestamp
          </button>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredHighlights.map((hl) => (
          <HighlightCard
            key={hl.id}
            highlight={hl}
            thumbnailUrl={activeMedia.highlightThumbnails[hl.id]}
            isPreviewing={previewHighlightId === hl.id}
            onToggleSelect={() => toggleSelect(hl.id)}
            onPreview={() => setPreviewHighlightId(hl.id)}
            onRemove={() => removeHighlight(hl.id)}
            onQuickCreateClip={() => quickCreateSingleClip(hl)}
          />
        ))}
      </div>
    </div>
  );
};
