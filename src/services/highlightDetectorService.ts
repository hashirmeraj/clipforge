import type {
  AnalysisSamplePoint,
  GameCategory,
  Highlight,
  HighlightCategory,
  SpeechSegment,
} from '../types';
import type { AudioAnalysisResult } from './audioAnalyzerService';
import type { FrameAnalysisResult } from './frameAnalyzerService';
import { EXCITING_SPEECH_PHRASES, getGameConfig } from '../constants/gaming';
import { clamp, generateId } from '../utils/format';

export interface HighlightDetectionInput {
  audio: AudioAnalysisResult;
  frames: FrameAnalysisResult;
  speechSegments: SpeechSegment[];
  duration: number;
  gameCategory: GameCategory;
  momentFilters: string[];
  customInstructions: string;
}

export interface HighlightDetectionOutput {
  timeline: AnalysisSamplePoint[];
  highlights: Highlight[];
}

interface PromptAdjustments {
  audioBoost: number;
  onsetBoost: number;
  voiceBoost: number;
  motionBoost: number;
  sceneCutBoost: number;
  flashBoost: number;
  preferredCategories: HighlightCategory[];
  customKeywords: string[];
}

/**
 * Parses user-guided instructions and selected moment filters into actual signal weight
 * adjustments and keyword boosters (transparently heuristic + optional speech matching).
 */
function parseUserGuidance(
  instructions: string,
  momentFilters: string[]
): PromptAdjustments {
  const combined = `${instructions} ${momentFilters.join(' ')}`.toLowerCase();

  const adj: PromptAdjustments = {
    audioBoost: 1,
    onsetBoost: 1,
    voiceBoost: 1,
    motionBoost: 1,
    sceneCutBoost: 1,
    flashBoost: 1,
    preferredCategories: [],
    customKeywords: [],
  };

  if (/crash|chase|police|escape|drift|race|overtake|speed/.test(combined)) {
    adj.motionBoost += 0.35;
    adj.onsetBoost += 0.2;
    adj.preferredCategories.push('Chase', 'Action');
  }
  if (/explos|boom|grenade|chaos|creeper/.test(combined)) {
    adj.flashBoost += 0.55;
    adj.onsetBoost += 0.35;
    adj.audioBoost += 0.25;
    adj.preferredCategories.push('Explosion');
  }
  if (/gunfight|shootout|kill|snipe|headshot|ace|multi|combat|pvp/.test(combined)) {
    adj.onsetBoost += 0.4;
    adj.audioBoost += 0.25;
    adj.sceneCutBoost += 0.2;
    adj.preferredCategories.push('Combat');
  }
  if (/funny|laugh|fail|npc|reaction|scream|jumpscare|scare|panic|hot mic/.test(combined)) {
    adj.voiceBoost += 0.5;
    adj.onsetBoost += 0.25;
    adj.preferredCategories.push('Funny', 'Reaction');
  }
  if (/clutch|win|victory|1v|endgame|final/.test(combined)) {
    adj.voiceBoost += 0.3;
    adj.audioBoost += 0.25;
    adj.motionBoost += 0.2;
    adj.preferredCategories.push('Clutch');
  }
  if (/unexpected|wtf|crazy|twist|surprise/.test(combined)) {
    adj.onsetBoost += 0.35;
    adj.sceneCutBoost += 0.3;
    adj.preferredCategories.push('Unexpected Moment');
  }
  if (/cinematic/.test(combined)) {
    adj.sceneCutBoost += 0.35;
    adj.motionBoost += 0.25;
    adj.preferredCategories.push('Cinematic');
  }

  // Extract meaningful words (> 3 chars) for matching against local Whisper speech segments
  const stopWords = new Set([
    'find', 'best', 'moments', 'moment', 'with', 'from', 'that', 'this', 'most',
    'very', 'some', 'clips', 'clip', 'video', 'game', 'gameplay', 'exciting', 'good',
  ]);
  const tokens = combined
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));
  adj.customKeywords = Array.from(new Set(tokens));

  return adj;
}

function classifyHighlight(
  audioScore: number,
  visualScore: number,
  speechScore: number,
  onsetAvg: number,
  voiceAvg: number,
  motionAvg: number,
  flashMax: number,
  sceneCuts: number,
  matchedSpeech: string[],
  gameCategory: GameCategory,
  preferredCategories: HighlightCategory[]
): { category: HighlightCategory; title: string } {
  const game = getGameConfig(gameCategory);

  // Check speech phrase categories first when speech actually triggered
  if (matchedSpeech.length > 0 && speechScore >= 45) {
    for (const phrase of EXCITING_SPEECH_PHRASES) {
      if (matchedSpeech.some((m) => m.toLowerCase().includes(phrase.phrase))) {
        const titles: Record<HighlightCategory, string> = {
          Reaction: `BIG REACTION: "${matchedSpeech[0].toUpperCase()}"`,
          'Unexpected Moment': 'UNEXPECTED MOMENT!',
          Clutch: 'CLUTCH PLAY MOMENT!',
          Combat: 'INTENSE COMBAT HIGHLIGHT!',
          Explosion: 'EXPLOSIVE CHAOS!',
          Chase: 'HIGH-SPEED CHASE ACTION!',
          Funny: 'FUNNY GAMEPLAY REACTION!',
          Action: 'HIGH-ENERGY ACTION!',
          Cinematic: 'CINEMATIC GAMEPLAY MOMENT',
          'High Energy': 'PEAK HYPE MOMENT!',
        };
        return { category: phrase.category, title: titles[phrase.category] };
      }
    }
  }

  if (flashMax > 0.62 && audioScore > 55) {
    return {
      category: 'Explosion',
      title: gameCategory === 'gta' ? 'EXPLOSIVE GTA CHAOS!' : 'UNEXPECTED EXPLOSION!',
    };
  }

  if (voiceAvg > 0.62 && audioScore > 65) {
    if (gameCategory === 'horror') {
      return { category: 'Reaction', title: 'LOUD JUMPSCARE REACTION!' };
    }
    if (preferredCategories.includes('Funny')) {
      return { category: 'Funny', title: 'HILARIOUS REACTION MOMENT!' };
    }
    return { category: 'Reaction', title: 'PEAK VOICE REACTION!' };
  }

  if (motionAvg > 0.62 && (gameCategory === 'gta' || gameCategory === 'racing')) {
    return {
      category: 'Chase',
      title: gameCategory === 'gta' ? 'INTENSE POLICE CHASE!' : 'HIGH-SPEED ACTION!',
    };
  }

  if (onsetAvg > 0.52 && (gameCategory === 'cod' || gameCategory === 'valorant' || gameCategory === 'cs' || gameCategory === 'pubg' || gameCategory === 'fortnite')) {
    return {
      category: preferredCategories.includes('Clutch') ? 'Clutch' : 'Combat',
      title: preferredCategories.includes('Clutch') ? 'INTENSE CLUTCH FIGHT!' : 'INTENSE FIREFIGHT!',
    };
  }

  if (sceneCuts >= 3 && visualScore > 65) {
    return {
      category: preferredCategories.includes('Cinematic') ? 'Cinematic' : 'Action',
      title: preferredCategories.includes('Cinematic') ? 'CINEMATIC SEQUENCE!' : 'RAPID ACTION SEQUENCE!',
    };
  }

  if (audioScore > 70 && visualScore > 60) {
    return {
      category: game.defaultCategories[0] ?? 'Action',
      title: `${game.shortLabel.toUpperCase()} PEAK ACTION!`,
    };
  }

  if (visualScore > audioScore + 15) {
    return {
      category: 'Unexpected Moment',
      title: 'HIGH-MOTION GAMEPLAY SPIKE!',
    };
  }

  return {
    category: 'High Energy',
    title: 'EXCITING GAMEPLAY MOMENT!',
  };
}

function buildReasonText(
  hasAudio: boolean,
  audioPeakDb: number,
  audioScore: number,
  motionIntensity: number,
  sceneCutCount: number,
  flashSpike: boolean,
  matchedSpeech: string[]
): string {
  const parts: string[] = [];

  if (hasAudio && audioScore >= 55) {
    parts.push(`loud audio peak (${audioPeakDb.toFixed(1)} dBFS, ${audioScore}/100 intensity)`);
  } else if (hasAudio && audioScore >= 35) {
    parts.push(`elevated audio energy (${audioPeakDb.toFixed(1)} dBFS)`);
  }

  if (motionIntensity >= 60) {
    parts.push(`rapid gameplay motion (${motionIntensity}/100)`);
  } else if (motionIntensity >= 38) {
    parts.push(`notable visual movement (${motionIntensity}/100)`);
  }

  if (flashSpike) {
    parts.push('bright flash/explosion visual spike');
  }

  if (sceneCutCount >= 2) {
    parts.push(`${sceneCutCount} rapid scene transitions`);
  }

  if (matchedSpeech.length > 0) {
    parts.push(`local speech match: "${matchedSpeech.slice(0, 2).join('", "')}"`);
  }

  if (parts.length === 0) {
    parts.push('combined above-average audio/visual activity peak');
  }

  const joined = parts.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1) + '.';
}

/**
 * Combines real Web Audio API signals, Canvas frame-difference signals,
 * and optional local Whisper speech detections into a ranked list of highlights.
 */
export function detectHighlights(input: HighlightDetectionInput): HighlightDetectionOutput {
  const { audio, frames, speechSegments, duration, gameCategory, momentFilters, customInstructions } =
    input;

  const gameCfg = getGameConfig(gameCategory);
  const guidance = parseUserGuidance(customInstructions, momentFilters);
  const hasAudio = audio.bins.length > 0;

  // Build unified timeline aligned to frame sample timestamps
  const timeline: AnalysisSamplePoint[] = frames.samples.map((f) => {
    // Find nearest audio bin
    let audioRms = 0;
    let audioPeak = 0;
    let audioOnset = 0;
    let voiceEnergy = 0;

    if (hasAudio) {
      const binStep = audio.duration / audio.bins.length;
      const idx = clamp(Math.floor(f.time / Math.max(0.01, binStep)), 0, audio.bins.length - 1);
      const bin = audio.bins[idx];
      audioRms = bin.rms;
      audioPeak = bin.peak;
      audioOnset = bin.onset;
      voiceEnergy = bin.voiceEnergy;
    }

    // Check if any local speech segment overlaps this timestamp
    let speechBoost = 0;
    for (const seg of speechSegments) {
      if (f.time >= seg.start - 1 && f.time <= seg.end + 1) {
        let bonus = seg.excitementScore;
        if (guidance.customKeywords.length > 0) {
          const lower = seg.text.toLowerCase();
          if (guidance.customKeywords.some((kw) => lower.includes(kw))) {
            bonus = Math.min(1, bonus + 0.35);
          }
        }
        speechBoost = Math.max(speechBoost, bonus);
      }
    }

    const wAudio = hasAudio ? gameCfg.weights.audio * guidance.audioBoost : 0;
    const wOnset = hasAudio ? gameCfg.weights.onset * guidance.onsetBoost : 0;
    const wVoice = hasAudio ? gameCfg.weights.voice * guidance.voiceBoost : 0;
    const wMotion = gameCfg.weights.motion * guidance.motionBoost;
    const wCut = gameCfg.weights.sceneCut * guidance.sceneCutBoost;
    const wFlash = gameCfg.weights.flash * guidance.flashBoost;
    const wSpeech = speechSegments.length > 0 ? 0.25 : 0;

    const totalWeight = wAudio + wOnset + wVoice + wMotion + wCut + wFlash + wSpeech || 1;
    const combined =
      (audioRms * wAudio +
        audioOnset * wOnset +
        voiceEnergy * wVoice +
        f.motionScore * wMotion +
        f.sceneCutScore * wCut +
        f.flashScore * wFlash +
        speechBoost * wSpeech) /
      totalWeight;

    return {
      time: f.time,
      audioRms,
      audioPeak,
      audioOnset,
      voiceEnergy,
      motionScore: f.motionScore,
      sceneCutScore: f.sceneCutScore,
      flashScore: f.flashScore,
      motionCenterX: f.motionCenterX,
      motionCenterY: f.motionCenterY,
      combinedScore: clamp(combined, 0, 1),
    };
  });

  if (timeline.length === 0) {
    return { timeline: [], highlights: [] };
  }

  // Smooth combinedScore with a 3-point moving average to find coherent events rather than 1-frame glitches
  const smoothed = timeline.map((pt, i) => {
    const prev = i > 0 ? timeline[i - 1].combinedScore : pt.combinedScore;
    const next = i < timeline.length - 1 ? timeline[i + 1].combinedScore : pt.combinedScore;
    return prev * 0.22 + pt.combinedScore * 0.56 + next * 0.22;
  });

  const mean = smoothed.reduce((acc, v) => acc + v, 0) / smoothed.length;
  const variance = smoothed.reduce((acc, v) => acc + (v - mean) ** 2, 0) / smoothed.length;
  const stdDev = Math.sqrt(variance);

  // Adaptive threshold based on real signal statistics
  const peakThreshold = Math.max(0.18, mean + stdDev * 0.35);

  // Target number of highlights scales gracefully with video duration
  const maxHighlights = clamp(Math.round(duration / 35) + 4, 3, 24);
  const minPeakSpacingSec = clamp(duration / (maxHighlights * 1.4), 6, 45);

  // Gather candidate local maxima
  const candidates: { index: number; score: number }[] = [];
  for (let i = 0; i < smoothed.length; i++) {
    const left = i > 0 ? smoothed[i - 1] : 0;
    const right = i < smoothed.length - 1 ? smoothed[i + 1] : 0;
    if (smoothed[i] >= left && smoothed[i] >= right && smoothed[i] >= peakThreshold) {
      candidates.push({ index: i, score: smoothed[i] });
    }
  }

  // If video is very uniform (e.g., short steady clip), still select top distinct energy peaks honestly
  if (candidates.length < Math.min(3, smoothed.length)) {
    const sortedIndices = smoothed
      .map((score, index) => ({ index, score }))
      .sort((a, b) => b.score - a.score);
    for (const c of sortedIndices) {
      if (!candidates.some((ex) => ex.index === c.index)) {
        candidates.push(c);
      }
      if (candidates.length >= Math.min(6, smoothed.length)) break;
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Non-maximum suppression by time distance
  const selectedPeaks: { index: number; rawScore: number }[] = [];
  for (const cand of candidates) {
    const t = timeline[cand.index].time;
    const tooClose = selectedPeaks.some(
      (p) => Math.abs(timeline[p.index].time - t) < minPeakSpacingSec
    );
    if (!tooClose) {
      selectedPeaks.push({ index: cand.index, rawScore: cand.score });
    }
    if (selectedPeaks.length >= maxHighlights) break;
  }

  const maxRaw = Math.max(0.25, ...selectedPeaks.map((p) => p.rawScore));

  // Build Highlight objects with natural boundaries and transparent signal metrics
  const highlights: Highlight[] = selectedPeaks.map((peak, rank) => {
    const peakPoint = timeline[peak.index];
    const peakTime = peakPoint.time;

    // Expand start/end while smoothed energy remains elevated, clamped to sensible highlight bounds
    const halfWindowMin = Math.min(6, duration * 0.2);
    const halfWindowMax = Math.min(24, duration * 0.45);
    const decayThreshold = mean + stdDev * 0.1;

    let startIdx = peak.index;
    while (
      startIdx > 0 &&
      peakTime - timeline[startIdx - 1].time < halfWindowMax &&
      (peakTime - timeline[startIdx].time < halfWindowMin || smoothed[startIdx - 1] >= decayThreshold)
    ) {
      startIdx--;
    }

    let endIdx = peak.index;
    while (
      endIdx < timeline.length - 1 &&
      timeline[endIdx + 1].time - peakTime < halfWindowMax &&
      (timeline[endIdx].time - peakTime < halfWindowMin || smoothed[endIdx + 1] >= decayThreshold)
    ) {
      endIdx++;
    }

    let start = clamp(timeline[startIdx].time - 2.5, 0, Math.max(0, duration - 3));
    let end = clamp(timeline[endIdx].time + 3.5, Math.min(duration, start + 3), duration);
    if (end - start < Math.min(8, duration)) {
      const deficit = Math.min(8, duration) - (end - start);
      start = clamp(start - deficit * 0.5, 0, Math.max(0, duration - 3));
      end = clamp(end + deficit * 0.5, start + 1, duration);
    }

    // Aggregate actual measured signals across the highlight window
    const windowPts = timeline.slice(startIdx, endIdx + 1);
    const avgAudio =
      windowPts.reduce((s, p) => s + p.audioRms * 0.6 + p.audioOnset * 0.4, 0) / windowPts.length;
    const maxAudioPeak = Math.max(...windowPts.map((p) => p.audioPeak));
    const avgOnset = windowPts.reduce((s, p) => s + p.audioOnset, 0) / windowPts.length;
    const avgVoice = windowPts.reduce((s, p) => s + p.voiceEnergy, 0) / windowPts.length;
    const avgMotion = windowPts.reduce((s, p) => s + p.motionScore, 0) / windowPts.length;
    const maxFlash = Math.max(...windowPts.map((p) => p.flashScore));
    const sceneCutCount = windowPts.filter((p) => p.sceneCutScore > 0.55).length;

    // Motion-weighted spatial center for Smart Crop
    let wX = 0;
    let wY = 0;
    let wTotal = 0;
    for (const p of windowPts) {
      const w = p.motionScore + 0.05;
      wX += p.motionCenterX * w;
      wY += p.motionCenterY * w;
      wTotal += w;
    }
    const motionCenterX = wTotal > 0 ? clamp(wX / wTotal, 0.18, 0.82) : 0.5;
    const motionCenterY = wTotal > 0 ? clamp(wY / wTotal, 0.2, 0.8) : 0.5;

    // Gather matching local speech phrases inside window
    const matchedSpeech: string[] = [];
    let bestSpeechExcitement = 0;
    for (const seg of speechSegments) {
      if (seg.end >= start && seg.start <= end) {
        bestSpeechExcitement = Math.max(bestSpeechExcitement, seg.excitementScore);
        if (seg.matchedPhrases.length > 0) {
          matchedSpeech.push(...seg.matchedPhrases);
        }
      }
    }
    const uniqueSpeech = Array.from(new Set(matchedSpeech));

    const audioScore = hasAudio ? Math.round(clamp(avgAudio * 105, 0, 100)) : 0;
    const visualScore = Math.round(
      clamp((avgMotion * 0.6 + Math.min(1, sceneCutCount / 4) * 0.2 + maxFlash * 0.2) * 110, 0, 100)
    );
    const speechScore = Math.round(clamp(bestSpeechExcitement * 100, 0, 100));

    // Final deterministic 0-100 score anchored on relative + absolute energy
    const relativeStrength = peak.rawScore / maxRaw;
    const absoluteStrength = clamp(peak.rawScore * 1.45, 0, 1);
    const finalScore = Math.round(
      clamp((relativeStrength * 0.58 + absoluteStrength * 0.42) * 98, 22, 99)
    );

    const audioPeakDb = maxAudioPeak > 1e-5 ? Math.max(-60, 20 * Math.log10(maxAudioPeak)) : -60;
    const motionIntensity = Math.round(clamp(avgMotion * 100, 0, 100));

    const { category, title } = classifyHighlight(
      audioScore,
      visualScore,
      speechScore,
      avgOnset,
      avgVoice,
      avgMotion,
      maxFlash,
      sceneCutCount,
      uniqueSpeech,
      gameCategory,
      guidance.preferredCategories
    );

    const reason = buildReasonText(
      hasAudio,
      audioPeakDb,
      audioScore,
      motionIntensity,
      sceneCutCount,
      maxFlash > 0.62,
      uniqueSpeech
    );

    return {
      id: generateId('hl'),
      index: rank + 1,
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      peakTime: Number(peakTime.toFixed(2)),
      duration: Number((end - start).toFixed(2)),
      score: finalScore,
      category,
      title,
      reason,
      signals: {
        audioScore,
        visualScore,
        speechScore,
        audioPeakDb: Number(audioPeakDb.toFixed(1)),
        motionIntensity,
        sceneCutCount,
        flashSpike: maxFlash > 0.62,
        matchedSpeech: uniqueSpeech,
        motionCenterX: Number(motionCenterX.toFixed(3)),
        motionCenterY: Number(motionCenterY.toFixed(3)),
      },
      selected: rank < 5, // Pre-select top highlights conveniently
    };
  });

  // Sort by descending score and assign 1-based rank index
  highlights.sort((a, b) => b.score - a.score);
  highlights.forEach((h, idx) => {
    h.index = idx + 1;
  });

  return { timeline, highlights };
}
