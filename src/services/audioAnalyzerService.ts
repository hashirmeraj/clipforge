import { clamp } from '../utils/format';

export interface AudioBinSample {
  time: number;
  rms: number;          // 0..1 normalized
  peak: number;         // 0..1 normalized
  peakDb: number;       // dBFS (-60..0)
  onset: number;        // 0..1 sudden energy jump
  voiceEnergy: number;  // 0..1 mid-band 300-3400Hz speech/scream activity
}

export interface AudioAnalysisResult {
  mode: 'web-audio-full' | 'web-audio-chunked' | 'visual-fallback';
  bins: AudioBinSample[];
  sampleRate: number;
  duration: number;
  warning?: string;
}

const MAX_DIRECT_DECODE_BYTES = 420 * 1024 * 1024; // 420 MB safety guard for browser RAM

function getAudioContextClass(): typeof AudioContext | null {
  const win = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return win.AudioContext || win.webkitAudioContext || null;
}

/**
 * Analyzes audio track of a video file using Web Audio API.
 * Computes per-window RMS energy, peak amplitude, sudden loudness onset,
 * and a voice-band (300Hz–3400Hz) energy estimate via lightweight IIR filtering.
 */
export async function analyzeVideoAudio(
  file: File,
  duration: number,
  binDurationSec: number,
  onProgress?: (percent: number, stage: string) => void,
  signal?: AbortSignal
): Promise<AudioAnalysisResult> {
  if (signal?.aborted) throw new Error('Analysis cancelled');

  const AudioCtx = getAudioContextClass();
  if (!AudioCtx) {
    return {
      mode: 'visual-fallback',
      bins: [],
      sampleRate: 0,
      duration,
      warning: 'Web Audio API is unavailable in this browser. Falling back to visual-only analysis.',
    };
  }

  if (file.size > MAX_DIRECT_DECODE_BYTES) {
    onProgress?.(100, 'Large file detected — using memory-safe visual-priority mode');
    return {
      mode: 'visual-fallback',
      bins: [],
      sampleRate: 0,
      duration,
      warning: `File size (${Math.round(file.size / (1024 * 1024))} MB) exceeds safe full-file Web Audio decode limit (${Math.round(
        MAX_DIRECT_DECODE_BYTES / (1024 * 1024)
      )} MB). Visual frame analysis will drive highlights; audio extraction still works per clip for captions and export.`,
    };
  }

  let audioCtx: AudioContext | null = null;
  try {
    onProgress?.(10, 'Reading audio buffer into memory...');
    const arrayBuffer = await file.arrayBuffer();
    if (signal?.aborted) throw new Error('Analysis cancelled');

    onProgress?.(35, 'Decoding audio waveform via Web Audio API...');
    audioCtx = new AudioCtx();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    if (signal?.aborted) throw new Error('Analysis cancelled');

    const sampleRate = audioBuffer.sampleRate;
    const totalSamples = audioBuffer.length;
    const numChannels = audioBuffer.numberOfChannels;
    const actualDuration = audioBuffer.duration || duration;

    // Mix down to mono Float32Array in chunks to avoid blocking UI
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : null;

    const binSamples = Math.max(1, Math.floor(sampleRate * binDurationSec));
    const numBins = Math.max(1, Math.ceil(totalSamples / binSamples));

    // Simple 1-pole high-pass (~300Hz) and low-pass (~3400Hz) coefficients for voice-band estimation
    const dt = 1 / sampleRate;
    const rcHp = 1 / (2 * Math.PI * 300);
    const alphaHp = rcHp / (rcHp + dt);
    const rcLp = 1 / (2 * Math.PI * 3400);
    const alphaLp = dt / (rcLp + dt);

    let hpState = 0;
    let prevIn = 0;
    let lpState = 0;

    const rawBins: { time: number; rms: number; peak: number; voiceRms: number }[] = [];
    let maxRms = 1e-6;
    let maxVoice = 1e-6;

    // Subsample step for very long files (> 20 mins) to stay super snappy while accurate
    const stride = actualDuration > 1200 ? 4 : actualDuration > 300 ? 2 : 1;

    for (let b = 0; b < numBins; b++) {
      if (signal?.aborted) throw new Error('Analysis cancelled');
      const startIdx = b * binSamples;
      const endIdx = Math.min(totalSamples, startIdx + binSamples);

      let sumSq = 0;
      let peak = 0;
      let voiceSumSq = 0;
      let count = 0;

      for (let i = startIdx; i < endIdx; i += stride) {
        const sample = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
        sumSq += sample * sample;

        // Bandpass approximation for human speech & excited shouting
        hpState = alphaHp * (hpState + sample - prevIn);
        prevIn = sample;
        lpState = lpState + alphaLp * (hpState - lpState);
        voiceSumSq += lpState * lpState;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
      const voiceRms = count > 0 ? Math.sqrt(voiceSumSq / count) : 0;
      if (rms > maxRms) maxRms = rms;
      if (voiceRms > maxVoice) maxVoice = voiceRms;

      rawBins.push({
        time: (startIdx + (endIdx - startIdx) * 0.5) / sampleRate,
        rms,
        peak,
        voiceRms,
      });

      if (b % 40 === 0) {
        const pct = 45 + Math.round((b / numBins) * 50);
        onProgress?.(pct, `Scanning audio peaks (${b}/${numBins} windows)...`);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Compute normalized metrics & onset deltas
    const bins: AudioBinSample[] = rawBins.map((bin, idx) => {
      const normRms = clamp(bin.rms / maxRms, 0, 1);
      const normVoice = clamp(bin.voiceRms / maxVoice, 0, 1);
      const prevRms = idx > 0 ? clamp(rawBins[idx - 1].rms / maxRms, 0, 1) : normRms;
      const prev2Rms = idx > 1 ? clamp(rawBins[idx - 2].rms / maxRms, 0, 1) : prevRms;
      const localBaseline = (prevRms + prev2Rms) * 0.5;
      const onset = clamp((normRms - localBaseline) * 2.2, 0, 1);
      const peakDb = bin.peak > 1e-5 ? Math.max(-60, 20 * Math.log10(bin.peak)) : -60;

      return {
        time: bin.time,
        rms: normRms,
        peak: clamp(bin.peak, 0, 1),
        peakDb: Number(peakDb.toFixed(1)),
        onset,
        voiceEnergy: normVoice,
      };
    });

    onProgress?.(100, 'Audio analysis complete');
    return {
      mode: 'web-audio-full',
      bins,
      sampleRate,
      duration: actualDuration,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    const message = err instanceof Error ? err.message : String(err);
    return {
      mode: 'visual-fallback',
      bins: [],
      sampleRate: 0,
      duration,
      warning: `Could not decode audio track via Web Audio API (${message}). Proceeding with visual frame analysis.`,
    };
  } finally {
    if (audioCtx) {
      audioCtx.close().catch(() => {});
    }
  }
}

/**
 * Extracts a 16kHz mono Float32Array PCM slice from a video/audio file for Whisper transcription.
 */
export async function extractAudio16kMonoSegment(
  file: File,
  startSec: number,
  endSec: number
): Promise<Float32Array> {
  const AudioCtx = getAudioContextClass();
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioCtx();
  try {
    const buffer = await file.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
    const safeStart = Math.max(0, Math.min(startSec, decoded.duration));
    const safeEnd = Math.max(safeStart + 0.1, Math.min(endSec, decoded.duration));
    const segDuration = safeEnd - safeStart;
    const targetSampleRate = 16000;
    const targetLength = Math.max(1, Math.ceil(segDuration * targetSampleRate));

    const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start(0, safeStart, segDuration);

    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();
  } finally {
    audioCtx.close().catch(() => {});
  }
}
