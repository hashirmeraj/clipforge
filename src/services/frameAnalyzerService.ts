import type { AnalysisDensity } from '../types';
import { clamp } from '../utils/format';

export interface FrameSample {
  time: number;
  motionScore: number;   // 0..1 frame-to-frame difference
  sceneCutScore: number; // 0..1 luma histogram jump
  flashScore: number;    // 0..1 bright explosion/flash spike
  motionCenterX: number; // 0..1 spatial horizontal center of motion
  motionCenterY: number; // 0..1 spatial vertical center of motion
}

export interface FrameAnalysisResult {
  samples: FrameSample[];
  stepSec: number;
}

const ANALYSIS_W = 160;
const ANALYSIS_H = 90;

export function getSamplingPlan(duration: number, density: AnalysisDensity): { count: number; stepSec: number } {
  const maxSamplesByDensity: Record<AnalysisDensity, number> = {
    fast: 70,
    balanced: 140,
    thorough: 260,
  };
  const minStepByDensity: Record<AnalysisDensity, number> = {
    fast: 1.0,
    balanced: 0.5,
    thorough: 0.35,
  };

  const maxSamples = maxSamplesByDensity[density];
  const minStep = minStepByDensity[density];

  const idealStep = Math.max(minStep, duration / maxSamples);
  const count = Math.max(4, Math.min(maxSamples, Math.floor(duration / idealStep)));
  const stepSec = duration / count;
  return { count, stepSec };
}

function seekVideo(video: HTMLVideoElement, timeSec: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Analysis cancelled'));
      return;
    }

    const timeout = window.setTimeout(() => {
      cleanup();
      resolve(); // Don't hard-fail entire analysis on a single slow keyframe seek
    }, 3500);

    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video decoding error during frame analysis.'));
    };
    const onAbort = () => {
      cleanup();
      reject(new Error('Analysis cancelled'));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });

    video.currentTime = timeSec;
  });
}

/**
 * Samples frames across the video using HTML5 Video + offscreen 160x90 Canvas.
 * Measures real pixel-level motion, luma histogram scene cuts, bright flash/explosion spikes,
 * and spatial center-of-motion (used by Smart Crop).
 */
export async function analyzeVideoFrames(
  objectUrl: string,
  duration: number,
  density: AnalysisDensity,
  onProgress?: (percent: number, stage: string, partialSample?: FrameSample) => void,
  signal?: AbortSignal
): Promise<FrameAnalysisResult> {
  if (signal?.aborted) throw new Error('Analysis cancelled');

  const { count, stepSec } = getSamplingPlan(duration, density);

  const video = document.createElement('video');
  video.src = objectUrl;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const canvas = document.createElement('canvas');
  canvas.width = ANALYSIS_W;
  canvas.height = ANALYSIS_H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('2D Canvas context unavailable for frame analysis.');
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => resolve();
      const onErr = () => reject(new Error('Failed to load video stream for frame analysis.'));
      video.addEventListener('loadeddata', onLoaded, { once: true });
      video.addEventListener('error', onErr, { once: true });
    });

    const totalPixels = ANALYSIS_W * ANALYSIS_H;
    let prevLuma: Uint8Array | null = null;
    let prevHist: Float32Array | null = null;
    let prevBrightRatio = 0;

    const rawSamples: {
      time: number;
      rawMotion: number;
      rawCut: number;
      rawFlash: number;
      centerX: number;
      centerY: number;
    }[] = [];

    let maxMotion = 1e-4;
    let maxCut = 1e-4;
    let maxFlash = 1e-4;

    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new Error('Analysis cancelled');

      const t = clamp(i * stepSec + stepSec * 0.25, 0, Math.max(0, duration - 0.08));
      await seekVideo(video, t, signal);

      ctx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
      const imageData = ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H).data;

      const luma = new Uint8Array(totalPixels);
      const hist = new Float32Array(16);
      let brightPixels = 0;

      for (let p = 0; p < totalPixels; p++) {
        const idx = p * 4;
        const y = (imageData[idx] * 77 + imageData[idx + 1] * 150 + imageData[idx + 2] * 29) >> 8;
        luma[p] = y;
        hist[y >> 4] += 1;
        if (y >= 218) brightPixels++;
      }

      for (let b = 0; b < 16; b++) {
        hist[b] /= totalPixels;
      }

      const brightRatio = brightPixels / totalPixels;

      let rawMotion = 0;
      let rawCut = 0;
      let rawFlash = 0;
      let centerX = 0.5;
      let centerY = 0.5;

      if (prevLuma && prevHist) {
        let diffSum = 0;
        let weightedX = 0;
        let weightedY = 0;
        let activeWeight = 0;

        for (let py = 0; py < ANALYSIS_H; py++) {
          const rowOffset = py * ANALYSIS_W;
          for (let px = 0; px < ANALYSIS_W; px++) {
            const p = rowOffset + px;
            const d = Math.abs(luma[p] - prevLuma[p]);
            diffSum += d;
            // Weight spatial motion centroid toward strong changes (> 22 luma diff)
            if (d > 22) {
              weightedX += (px / ANALYSIS_W) * d;
              weightedY += (py / ANALYSIS_H) * d;
              activeWeight += d;
            }
          }
        }

        rawMotion = diffSum / (totalPixels * 255);
        if (activeWeight > 0) {
          centerX = clamp(weightedX / activeWeight, 0.15, 0.85);
          centerY = clamp(weightedY / activeWeight, 0.15, 0.85);
        }

        // L1 histogram difference (0..2) -> 0..1
        let histDiff = 0;
        for (let b = 0; b < 16; b++) {
          histDiff += Math.abs(hist[b] - prevHist[b]);
        }
        rawCut = histDiff * 0.5;

        // Explosion/flash detector: sudden bright surge + color/luma shift
        const brightJump = Math.max(0, brightRatio - prevBrightRatio);
        rawFlash = clamp(brightJump * 4.5 + (brightRatio > 0.25 ? rawMotion * 0.8 : 0), 0, 1);

        if (rawMotion > maxMotion) maxMotion = rawMotion;
        if (rawCut > maxCut) maxCut = rawCut;
        if (rawFlash > maxFlash) maxFlash = rawFlash;
      }

      prevLuma = luma;
      prevHist = hist;
      prevBrightRatio = brightRatio;

      rawSamples.push({
        time: t,
        rawMotion,
        rawCut,
        rawFlash,
        centerX,
        centerY,
      });

      const pct = Math.round(((i + 1) / count) * 100);
      onProgress?.(
        pct,
        `Analyzing gameplay frames (${i + 1}/${count})...`,
        {
          time: t,
          motionScore: clamp(rawMotion / Math.max(0.08, maxMotion), 0, 1),
          sceneCutScore: clamp(rawCut / Math.max(0.15, maxCut), 0, 1),
          flashScore: clamp(rawFlash / Math.max(0.12, maxFlash), 0, 1),
          motionCenterX: centerX,
          motionCenterY: centerY,
        }
      );

      // Yield to browser UI thread smoothly
      if (i % 2 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const samples: FrameSample[] = rawSamples.map((s) => ({
      time: s.time,
      motionScore: clamp(s.rawMotion / Math.max(0.06, maxMotion), 0, 1),
      sceneCutScore: clamp(s.rawCut / Math.max(0.18, maxCut), 0, 1),
      flashScore: clamp(s.rawFlash / Math.max(0.1, maxFlash), 0, 1),
      motionCenterX: s.centerX,
      motionCenterY: s.centerY,
    }));

    return { samples, stepSec };
  } finally {
    video.src = '';
    video.load();
  }
}
