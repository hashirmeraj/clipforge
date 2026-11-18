import React, { useRef, useState } from 'react';
import {
  Mic,
  Plus,
  Trash2,
  Square,
  AlertCircle,
  CheckCircle2,
  Bold,
  Italic,
  CaseUpper,
  Sparkles,
} from 'lucide-react';
import type { CaptionSegment, CaptionStyle, Clip } from '../../types';
import { CAPTION_FONT_FAMILIES, KEYWORD_HIGHLIGHT_LIST } from '../../constants/captions';
import { useClipForge } from '../../context/ClipForgeContext';
import { transcribeVideoSegment } from '../../services/speechService';
import { CaptionPresets } from './CaptionPresets';
import { clamp, generateId } from '../../utils/format';

interface CaptionEditorProps {
  clip: Clip;
  sourceFile: File;
  onUpdateClip: (updater: (c: Clip) => Clip) => void;
  onSeekRelative: (relSec: number) => void;
}

const QUICK_EMOJIS = ['🔥', '😂', '💀', '💥', '🏆', '😱', '🎯', '🚨'];

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  clip,
  sourceFile,
  onUpdateClip,
  onSeekRelative,
}) => {
  const { settings, capabilities } = useClipForge();

  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [statusNote, setStatusNote] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const clipDuration = Math.max(0.5, clip.end - clip.start);

  const updateStyle = (patch: Partial<CaptionStyle>) => {
    onUpdateClip((c) => ({
      ...c,
      captionStyle: { ...c.captionStyle, ...patch },
    }));
  };

  const handleAutoTranscribe = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setTranscribing(true);
    setProgress(5);
    setStage('Preparing audio slice...');
    setStatusNote(null);

    try {
      const result = await transcribeVideoSegment({
        file: sourceFile,
        startSec: clip.start,
        endSec: clip.end,
        modelId: settings.whisperModel,
        preferWebGPU: settings.preferWebGPU,
        onProgress: (info) => {
          setProgress(info.progress);
          setStage(info.stage);
        },
        signal: controller.signal,
      });

      if (result.captions.length === 0) {
        setStatusNote({
          type: 'err',
          text: `Local Whisper (${result.deviceUsed.toUpperCase()}) found no audible speech in this clip. You can add manual captions below or export without captions.`,
        });
      } else {
        onUpdateClip((c) => ({
          ...c,
          captionsEnabled: true,
          captions: result.captions,
        }));
        setStatusNote({
          type: 'ok',
          text: `Generated ${result.captions.length} timed caption segments locally via Whisper (${result.deviceUsed.toUpperCase()}).`,
        });
      }
    } catch (err) {
      if ((err as Error).message !== 'Transcription cancelled') {
        setStatusNote({
          type: 'err',
          text: `Local speech recognition could not complete (${
            err instanceof Error ? err.message : String(err)
          }). You can add or edit subtitles manually below, or disable captions.`,
        });
      }
    } finally {
      setTranscribing(false);
      abortRef.current = null;
    }
  };

  const addManualCaption = () => {
    const lastEnd = clip.captions.length > 0 ? clip.captions[clip.captions.length - 1].end : 0;
    const start = Number(clamp(lastEnd + 0.1, 0, Math.max(0, clipDuration - 0.5)).toFixed(2));
    const end = Number(clamp(start + 2.5, start + 0.5, clipDuration).toFixed(2));
    const newSeg: CaptionSegment = {
      id: generateId('cap'),
      start,
      end,
      text: 'New caption text',
    };
    onUpdateClip((c) => ({
      ...c,
      captionsEnabled: true,
      captions: [...c.captions, newSeg],
    }));
  };

  const updateSegment = (id: string, patch: Partial<CaptionSegment>) => {
    onUpdateClip((c) => ({
      ...c,
      captions: c.captions.map((seg) => {
        if (seg.id !== id) return seg;
        const next = { ...seg, ...patch };
        // Rebuild word timings cleanly whenever user edits text or timing manually
        if (patch.text !== undefined || patch.start !== undefined || patch.end !== undefined) {
          const tokens = next.text.trim().split(/\s+/).filter(Boolean);
          const step = Math.max(0.1, next.end - next.start) / Math.max(1, tokens.length);
          next.words = tokens.map((w, i) => ({
            word: w,
            start: Number((next.start + i * step).toFixed(2)),
            end: Number((next.start + (i + 1) * step).toFixed(2)),
            isKeyword: KEYWORD_HIGHLIGHT_LIST.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')),
          }));
        }
        return next;
      }),
    }));
  };

  const deleteSegment = (id: string) => {
    onUpdateClip((c) => ({
      ...c,
      captions: c.captions.filter((s) => s.id !== id),
    }));
  };

  return (
    <div className="space-y-5">
      {/* Enable + Local Whisper Generator */}
      <div className="rounded-xl border border-white/[0.08] bg-[#0d1017] p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
            <input
              type="checkbox"
              checked={clip.captionsEnabled}
              onChange={(e) => onUpdateClip((c) => ({ ...c, captionsEnabled: e.target.checked }))}
              className="h-4 w-4 accent-violet-500"
            />
            Burn Captions into Clip
          </label>
          <span className="text-[11px] text-zinc-500">
            {capabilities?.hasWebGPU && settings.preferWebGPU ? 'WebGPU Ready' : 'WASM CPU'}
          </span>
        </div>

        <div className="flex gap-2">
          {transcribing ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600/90 py-2 text-xs font-semibold text-white hover:bg-red-500"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              Cancel Transcription
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAutoTranscribe}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              <Mic className="h-3.5 w-3.5" />
              Auto-Generate Captions (Local Whisper)
            </button>
          )}
        </div>

        {transcribing && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-violet-200">
              <span className="truncate">{stage}</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-violet-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {statusNote && (
          <div
            className={`flex items-start gap-2 rounded-lg p-2.5 text-[11px] ${
              statusNote.type === 'ok'
                ? 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/25'
                : 'bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/25'
            }`}
          >
            {statusNote.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            <span>{statusNote.text}</span>
          </div>
        )}
      </div>

      {/* Caption Presets */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          Caption Style Presets
        </div>
        <CaptionPresets
          activePresetId={clip.captionStyle.presetId}
          onSelectPreset={(style) =>
            onUpdateClip((c) => ({ ...c, captionsEnabled: true, captionStyle: style }))
          }
        />
      </div>

      {/* Styling Controls */}
      <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0d1017] p-3.5 text-xs">
        <div className="font-semibold text-zinc-200">Typography &amp; Appearance</div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] text-zinc-400">Display Mode</label>
            <select
              value={clip.captionStyle.mode}
              onChange={(e) => updateStyle({ mode: e.target.value as CaptionStyle['mode'] })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151e] px-2.5 py-1.5 text-xs text-zinc-100"
            >
              <option value="word">Word-by-word (Dynamic)</option>
              <option value="sentence">Sentence-based</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-zinc-400">Font Family</label>
            <select
              value={clip.captionStyle.fontFamily}
              onChange={(e) => updateStyle({ fontFamily: e.target.value })}
              className="mt-1 w-full rounded-lg border border-white/10 bg-[#12151e] px-2.5 py-1.5 text-xs text-zinc-100"
            >
              {CAPTION_FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Position & Quick Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[#12151e] p-0.5">
            {(['top', 'middle', 'bottom', 'custom'] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => updateStyle({ position: pos })}
                className={`rounded px-2 py-1 text-[11px] capitalize ${
                  clip.captionStyle.position === pos
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateStyle({ bold: !clip.captionStyle.bold })}
              className={`rounded p-1.5 ${
                clip.captionStyle.bold ? 'bg-violet-600 text-white' : 'bg-white/[0.05] text-zinc-400'
              }`}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateStyle({ italic: !clip.captionStyle.italic })}
              className={`rounded p-1.5 ${
                clip.captionStyle.italic
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/[0.05] text-zinc-400'
              }`}
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateStyle({ uppercase: !clip.captionStyle.uppercase })}
              className={`rounded p-1.5 ${
                clip.captionStyle.uppercase
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/[0.05] text-zinc-400'
              }`}
              title="Uppercase"
            >
              <CaseUpper className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => updateStyle({ shadow: !clip.captionStyle.shadow })}
              className={`rounded px-2 py-1 text-[11px] font-medium ${
                clip.captionStyle.shadow
                  ? 'bg-violet-600 text-white'
                  : 'bg-white/[0.05] text-zinc-400'
              }`}
            >
              Shadow
            </button>
          </div>
        </div>

        {clip.captionStyle.position === 'custom' && (
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Vertical Position</span>
              <span className="font-mono">{clip.captionStyle.customYPercent}%</span>
            </div>
            <input
              type="range"
              min={12}
              max={88}
              value={clip.captionStyle.customYPercent}
              onChange={(e) => updateStyle({ customYPercent: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>
        )}

        {/* Sliders */}
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Size</span>
              <span className="font-mono">{clip.captionStyle.fontSize}</span>
            </div>
            <input
              type="range"
              min={26}
              max={86}
              value={clip.captionStyle.fontSize}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Outline</span>
              <span className="font-mono">{clip.captionStyle.outlineThickness}px</span>
            </div>
            <input
              type="range"
              min={0}
              max={14}
              value={clip.captionStyle.outlineThickness}
              onChange={(e) => updateStyle({ outlineThickness: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-zinc-400">
              <span>Bg Opacity</span>
              <span className="font-mono">{Math.round(clip.captionStyle.backgroundOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={clip.captionStyle.backgroundOpacity}
              onChange={(e) => updateStyle({ backgroundOpacity: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-[#12151e] px-2 py-1.5 text-[11px]">
            <span className="text-zinc-400">Text</span>
            <input
              type="color"
              value={clip.captionStyle.textColor}
              onChange={(e) => updateStyle({ textColor: e.target.value })}
              className="h-5 w-7 cursor-pointer bg-transparent"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-[#12151e] px-2 py-1.5 text-[11px]">
            <span className="text-zinc-400">Highlight</span>
            <input
              type="color"
              value={clip.captionStyle.highlightColor}
              onChange={(e) => updateStyle({ highlightColor: e.target.value })}
              className="h-5 w-7 cursor-pointer bg-transparent"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-white/10 bg-[#12151e] px-2 py-1.5 text-[11px]">
            <span className="text-zinc-400">Outline</span>
            <input
              type="color"
              value={clip.captionStyle.outlineColor}
              onChange={(e) => updateStyle({ outlineColor: e.target.value })}
              className="h-5 w-7 cursor-pointer bg-transparent"
            />
          </label>
        </div>
      </div>

      {/* Transcript / Manual Subtitle Lines */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Caption Lines ({clip.captions.length})
          </span>
          <button
            type="button"
            onClick={addManualCaption}
            className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-white/[0.12]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Line
          </button>
        </div>

        {clip.captions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-zinc-500">
            No captions yet. Run <strong className="text-zinc-300">Auto-Generate Captions</strong>{' '}
            above or click <strong className="text-zinc-300">Add Line</strong> to write manual
            subtitles.
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {clip.captions.map((seg) => (
              <div
                key={seg.id}
                className="rounded-lg border border-white/[0.07] bg-[#0d1017] p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSeekRelative(seg.start)}
                    className="rounded bg-violet-500/15 px-1.5 py-0.5 font-mono text-[10px] text-violet-300 hover:bg-violet-500/25"
                    title="Jump playhead here"
                  >
                    Jump
                  </button>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <input
                      type="number"
                      step={0.1}
                      min={0}
                      max={clipDuration}
                      value={seg.start}
                      onChange={(e) =>
                        updateSegment(seg.id, {
                          start: clamp(Number(e.target.value), 0, Math.max(0, seg.end - 0.1)),
                        })
                      }
                      className="w-14 rounded border border-white/10 bg-[#12151e] px-1.5 py-0.5 font-mono text-zinc-200"
                    />
                    <span>–</span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={clipDuration}
                      value={seg.end}
                      onChange={(e) =>
                        updateSegment(seg.id, {
                          end: clamp(Number(e.target.value), seg.start + 0.1, clipDuration),
                        })
                      }
                      className="w-14 rounded border border-white/10 bg-[#12151e] px-1.5 py-0.5 font-mono text-zinc-200"
                    />
                    <span>s</span>
                  </div>

                  <div className="ml-auto flex items-center gap-1">
                    {QUICK_EMOJIS.slice(0, 4).map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => updateSegment(seg.id, { text: `${seg.text} ${em}` })}
                        className="rounded px-1 text-xs hover:bg-white/10"
                        title={`Append ${em}`}
                      >
                        {em}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => deleteSegment(seg.id)}
                      className="rounded p-1 text-zinc-500 hover:bg-red-500/15 hover:text-red-400"
                      title="Delete caption"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={seg.text}
                  onChange={(e) => updateSegment(seg.id, { text: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-[#12151e] px-2.5 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
