import React, { useState } from 'react';
import { Scissors, Sparkles, Plus, Clock } from 'lucide-react';
import { CLIP_DURATION_PRESETS } from '../../constants/gaming';
import { useClipForge } from '../../context/ClipForgeContext';
import { generateClipsFromHighlights } from '../../services/clipGeneratorService';

export const ClipGenerator: React.FC = () => {
  const { activeProject, activeMedia, settings, setProjectClips, setPage } = useClipForge();

  const [selectedDurations, setSelectedDurations] = useState<number[]>(
    settings.defaultClipDurations
  );
  const [customSec, setCustomSec] = useState('');
  const [allowOverlaps, setAllowOverlaps] = useState(false);
  const [combineAdjacent, setCombineAdjacent] = useState(true);
  const [leadInSec, setLeadInSec] = useState(4);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!activeProject || !activeProject.videoMeta) return null;

  const selectedHighlights = activeProject.highlights.filter((h) => h.selected);
  const videoDuration = activeProject.videoMeta.duration;

  const toggleDuration = (sec: number) => {
    setSelectedDurations((prev) =>
      prev.includes(sec) ? prev.filter((d) => d !== sec) : [...prev, sec].sort((a, b) => a - b)
    );
  };

  const addCustomDuration = () => {
    const num = Math.round(Number(customSec));
    if (!Number.isFinite(num) || num < 5 || num > 600) {
      setFeedback('Enter a custom duration between 5 and 600 seconds.');
      return;
    }
    if (!selectedDurations.includes(num)) {
      setSelectedDurations((prev) => [...prev, num].sort((a, b) => a - b));
    }
    setCustomSec('');
    setFeedback(null);
  };

  const handleGenerate = () => {
    if (selectedHighlights.length === 0) {
      setFeedback('Select at least one highlight above to generate clips.');
      return;
    }
    if (selectedDurations.length === 0) {
      setFeedback('Select at least one clip duration.');
      return;
    }

    const generated = generateClipsFromHighlights({
      highlights: selectedHighlights,
      videoDuration,
      targetDurations: selectedDurations,
      allowOverlaps,
      combineAdjacent,
      leadInSeconds: leadInSec,
      speechSegments: activeMedia?.speechSegments ?? [],
      settings,
    });

    if (generated.length === 0) {
      setFeedback(
        'No non-overlapping clips could be generated for the chosen durations. Try enabling overlapping clips or selecting shorter durations.'
      );
      return;
    }

    setProjectClips(activeProject.id, generated, replaceExisting);
    setFeedback(null);
    setPage('editor');
  };

  return (
    <div className="studio-panel p-5">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Automatic Clip Generator
          </h2>
          <p className="text-xs text-zinc-400">
            Multi-select preferred durations. ClipForge builds non-duplicate clips from your{' '}
            <span className="font-semibold text-zinc-200">{selectedHighlights.length}</span>{' '}
            selected highlights, intelligently extending context without ever inventing footage.
          </p>
        </div>
      </div>

      {/* Multi-Select Duration Chips */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-300">
          <Clock className="h-3.5 w-3.5 text-sky-400" />
          Target Clip Durations (multi-select)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CLIP_DURATION_PRESETS.map((preset) => {
            const active = selectedDurations.includes(preset.seconds);
            const exceedsVideo = preset.seconds > videoDuration;
            return (
              <button
                key={preset.seconds}
                onClick={() => toggleDuration(preset.seconds)}
                title={
                  exceedsVideo
                    ? `Source video is ${Math.round(videoDuration)}s — clip will clamp cleanly to full video length`
                    : undefined
                }
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                    : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          {/* Custom badges that aren't presets */}
          {selectedDurations
            .filter((d) => !CLIP_DURATION_PRESETS.some((p) => p.seconds === d))
            .map((d) => (
              <button
                key={d}
                onClick={() => toggleDuration(d)}
                className="rounded-lg border border-sky-400/60 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200"
              >
                {d}s ×
              </button>
            ))}

          {/* Custom duration input */}
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={5}
              max={600}
              value={customSec}
              onChange={(e) => setCustomSec(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomDuration()}
              placeholder="Custom (s)"
              className="w-24 rounded-lg border border-white/10 bg-[#0b0d12] px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
            />
            <button
              onClick={addCustomDuration}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.1]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Rules & Options */}
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={combineAdjacent}
            onChange={(e) => setCombineAdjacent(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-500"
          />
          Combine adjacent moments (for 60s+ clips)
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowOverlaps}
            onChange={(e) => setAllowOverlaps(e.target.checked)}
            className="h-3.5 w-3.5 accent-violet-500"
          />
          Allow overlapping clips
        </label>

        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <span className="shrink-0 text-zinc-400">Lead-in context:</span>
          <input
            type="range"
            min={1}
            max={12}
            value={leadInSec}
            onChange={(e) => setLeadInSec(Number(e.target.value))}
            className="w-24"
          />
          <span className="font-mono text-zinc-200">{leadInSec}s</span>
        </div>
      </div>

      {feedback && (
        <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-amber-500/25">
          {feedback}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {activeProject.clips.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="h-3.5 w-3.5 accent-violet-500"
            />
            Replace existing {activeProject.clips.length} clips (uncheck to append)
          </label>
        ) : (
          <span className="text-xs text-zinc-500">
            Selected durations: {selectedDurations.map((d) => `${d}s`).join(', ') || 'None'}
          </span>
        )}

        <button
          onClick={handleGenerate}
          disabled={selectedHighlights.length === 0 || selectedDurations.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Scissors className="h-4 w-4" />
          Generate Clips &amp; Open Editor
        </button>
      </div>
    </div>
  );
};
