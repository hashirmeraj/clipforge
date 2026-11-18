import type {
  AppSettings,
  CaptionSegment,
  Clip,
  Highlight,
  SpeechSegment,
} from '../types';
import { getCaptionPresetStyle, KEYWORD_HIGHLIGHT_LIST } from '../constants/captions';
import { clamp, generateId } from '../utils/format';

export interface ClipGenerationOptions {
  highlights: Highlight[];
  videoDuration: number;
  targetDurations: number[]; // e.g. [30, 60, 120]
  allowOverlaps: boolean;
  combineAdjacent: boolean;
  leadInSeconds: number;
  speechSegments: SpeechSegment[];
  settings: AppSettings;
}

function buildCaptionsForWindow(
  start: number,
  end: number,
  speechSegments: SpeechSegment[]
): CaptionSegment[] {
  const result: CaptionSegment[] = [];
  for (const seg of speechSegments) {
    if (seg.end <= start || seg.start >= end) continue;
    const relStart = Math.max(0, Number((seg.start - start).toFixed(2)));
    const relEnd = Math.min(Number((end - start).toFixed(2)), Number((seg.end - start).toFixed(2)));
    if (relEnd - relStart < 0.15) continue;

    const words = seg.words
      ? seg.words
          .filter((w) => w.end > start && w.start < end)
          .map((w) => {
            const clean = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
            return {
              word: w.word,
              start: Math.max(0, Number((w.start - start).toFixed(2))),
              end: Math.min(Number((end - start).toFixed(2)), Number((w.end - start).toFixed(2))),
              isKeyword: KEYWORD_HIGHLIGHT_LIST.has(clean),
            };
          })
      : undefined;

    result.push({
      id: generateId('cap'),
      start: relStart,
      end: relEnd,
      text: seg.text.trim(),
      words,
    });
  }
  return result;
}

/**
 * Adjusts start/end slightly so we don't chop right into the middle of an active speech sentence.
 */
function snapAroundSpeech(
  start: number,
  end: number,
  videoDuration: number,
  speechSegments: SpeechSegment[]
): { start: number; end: number } {
  let adjStart = start;
  let adjEnd = end;

  for (const seg of speechSegments) {
    // If clip starts right in the middle of a spoken sentence (within 2.5s of sentence start), pull back to sentence start
    if (seg.start < adjStart && seg.end > adjStart && adjStart - seg.start <= 2.5) {
      adjStart = Math.max(0, seg.start - 0.15);
    }
    // If clip ends right in the middle of a spoken sentence (within 2.5s of sentence end), extend to sentence end
    if (seg.start < adjEnd && seg.end > adjEnd && seg.end - adjEnd <= 2.5) {
      adjEnd = Math.min(videoDuration, seg.end + 0.2);
    }
  }

  return {
    start: Number(clamp(adjStart, 0, Math.max(0, videoDuration - 1)).toFixed(2)),
    end: Number(clamp(adjEnd, adjStart + 1, videoDuration).toFixed(2)),
  };
}

export function createClipFromRange(
  params: {
    title: string;
    start: number;
    end: number;
    targetDuration: number;
    videoDuration: number;
    highlight?: Highlight;
    speechSegments?: SpeechSegment[];
    settings: AppSettings;
  }
): Clip {
  const { title, videoDuration, highlight, speechSegments = [], settings } = params;
  const safeStart = Number(clamp(params.start, 0, Math.max(0, videoDuration - 0.5)).toFixed(2));
  const safeEnd = Number(clamp(params.end, Math.min(videoDuration, safeStart + 0.5), videoDuration).toFixed(2));
  const motionX = highlight?.signals.motionCenterX ?? 0.5;
  const motionY = highlight?.signals.motionCenterY ?? 0.5;

  const captions = buildCaptionsForWindow(safeStart, safeEnd, speechSegments);

  return {
    id: generateId('clip'),
    title,
    highlightId: highlight?.id,
    category: highlight?.category ?? 'High Energy',
    score: highlight?.score ?? 75,
    start: safeStart,
    end: safeEnd,
    targetDuration: params.targetDuration,
    aspectRatio: settings.defaultAspectRatio,
    layout: settings.defaultLayout,
    crop: {
      x: settings.defaultLayout === 'smart-crop' ? motionX : 0.5,
      y: settings.defaultLayout === 'smart-crop' ? motionY : 0.5,
      zoom: 1,
      smartTrackedX: motionX,
      smartTrackedY: motionY,
      facecamX: 0.84,
      facecamY: 0.8,
      facecamWidth: 0.28,
      facecamHeight: 0.3,
    },
    captionsEnabled: captions.length > 0,
    captionStyle: getCaptionPresetStyle(settings.defaultCaptionPreset),
    captions,
    introOverlay: {
      enabled: false,
      text: '',
      duration: 2.5,
      color: '#FFFFFF',
      bgOpacity: 0.65,
      fontSize: 52,
    },
    outroOverlay: {
      enabled: false,
      text: '',
      duration: 2.5,
      color: '#FFFFFF',
      bgOpacity: 0.65,
      fontSize: 48,
    },
    gamingPreset: 'none',
    colorGrade: { contrast: 1, saturation: 1, brightness: 0 },
    originalVolume: 1,
    muted: false,
    bgMusicVolume: 0.28,
    selected: true,
  };
}

/**
 * Generates non-duplicate clips from ranked highlights matching user's multi-selected durations.
 * Never invents footage or exceeds videoDuration; intelligently extends surrounding context
 * when a highlight is shorter than the target duration.
 */
export function generateClipsFromHighlights(options: ClipGenerationOptions): Clip[] {
  const {
    highlights,
    videoDuration,
    targetDurations,
    allowOverlaps,
    combineAdjacent,
    leadInSeconds,
    speechSegments,
    settings,
  } = options;

  if (highlights.length === 0 || videoDuration <= 0) return [];

  const validDurations = Array.from(
    new Set(
      targetDurations
        .map((d) => Math.round(d))
        .filter((d) => Number.isFinite(d) && d >= 5)
    )
  ).sort((a, b) => a - b);

  if (validDurations.length === 0) return [];

  // Prioritize strongest highlights first
  const ranked = [...highlights].sort((a, b) => b.score - a.score);

  const clips: Clip[] = [];
  const usedRanges: { start: number; end: number }[] = [];

  const overlapsExisting = (s: number, e: number): boolean => {
    for (const r of usedRanges) {
      const overlapStart = Math.max(s, r.start);
      const overlapEnd = Math.min(e, r.end);
      const overlapLen = overlapEnd - overlapStart;
      if (overlapLen > 0) {
        const minLen = Math.min(e - s, r.end - r.start);
        // Reject exact duplicates even if allowOverlaps=true; otherwise reject >15% overlap
        if (Math.abs(s - r.start) < 2 && Math.abs(e - r.end) < 2) return true;
        if (!allowOverlaps && overlapLen / Math.max(1, minLen) > 0.15) return true;
      }
    }
    return false;
  };

  // Assign target durations across top highlights cleanly
  for (let dIdx = 0; dIdx < validDurations.length; dIdx++) {
    const requestedDur = validDurations[dIdx];
    const effectiveDur = Math.min(requestedDur, videoDuration);

    // Cycle highlights so each selected duration gets distinct strongest moments
    for (let hIdx = 0; hIdx < ranked.length; hIdx++) {
      const hl = ranked[hIdx];

      // Determine initial window with lead-in context before peak & tail after event
      let start: number;
      let end: number;

      const hlDur = hl.end - hl.start;
      if (hlDur >= effectiveDur) {
        // Center around peakTime while keeping lead-in context
        const lead = Math.min(leadInSeconds, effectiveDur * 0.4);
        start = clamp(hl.peakTime - lead, hl.start, Math.max(0, videoDuration - effectiveDur));
        end = Math.min(videoDuration, start + effectiveDur);
      } else {
        // Intelligently extend surrounding context around the highlight
        // Check if combining an adjacent related highlight makes sense for longer clips (>= 60s)
        let anchorStart = hl.start;
        let anchorEnd = hl.end;

        if (combineAdjacent && effectiveDur >= 55) {
          const neighbor = ranked.find(
            (other) =>
              other.id !== hl.id &&
              ((other.start >= hl.end && other.end - hl.start <= effectiveDur) ||
                (hl.start >= other.end && hl.end - other.start <= effectiveDur))
          );
          if (neighbor) {
            anchorStart = Math.min(hl.start, neighbor.start);
            anchorEnd = Math.max(hl.end, neighbor.end);
          }
        }

        const currentSpan = anchorEnd - anchorStart;
        const extraNeeded = Math.max(0, effectiveDur - currentSpan);
        // Allocate ~45% before highlight for build-up context, ~55% after for payoff/reaction
        const beforePad = Math.max(leadInSeconds * 0.5, extraNeeded * 0.45);
        const afterPad = Math.max(0, extraNeeded - beforePad);

        start = anchorStart - beforePad;
        end = anchorEnd + afterPad;

        // Shift cleanly inside [0, videoDuration] without inventing footage
        if (start < 0) {
          end = Math.min(videoDuration, end - start);
          start = 0;
        }
        if (end > videoDuration) {
          start = Math.max(0, start - (end - videoDuration));
          end = videoDuration;
        }
      }

      // Snap boundaries away from mid-sentence cuts when speech segments exist
      if (speechSegments.length > 0) {
        const snapped = snapAroundSpeech(start, end, videoDuration, speechSegments);
        // Ensure we don't exceed requested duration by more than 2.5s
        if (snapped.end - snapped.start <= effectiveDur + 2.5) {
          start = snapped.start;
          end = snapped.end;
        }
      }

      if (end - start < Math.min(3, videoDuration)) continue;
      if (overlapsExisting(start, end)) continue;

      usedRanges.push({ start, end });
      const durationTag =
        requestedDur >= 60 && requestedDur % 60 === 0
          ? `${requestedDur / 60}m`
          : `${requestedDur}s`;

      clips.push(
        createClipFromRange({
          title: `${hl.title} (${durationTag})`,
          start,
          end,
          targetDuration: requestedDur,
          videoDuration,
          highlight: hl,
          speechSegments,
          settings,
        })
      );

      // Avoid generating 30 redundant clips for 1 short video; cap per duration tier cleanly
      const maxPerDuration = Math.max(1, Math.min(ranked.length, Math.ceil(10 / validDurations.length)));
      const countForThisDuration = clips.filter((c) => c.targetDuration === requestedDur).length;
      if (countForThisDuration >= maxPerDuration) break;
    }
  }

  return clips.sort((a, b) => b.score - a.score);
}
