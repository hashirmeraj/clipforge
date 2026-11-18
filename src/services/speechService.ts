import type { CaptionSegment, SpeechSegment, SpeechWord } from '../types';
import { EXCITING_SPEECH_PHRASES } from '../constants/gaming';
import { KEYWORD_HIGHLIGHT_LIST } from '../constants/captions';
import { extractAudio16kMonoSegment } from './audioAnalyzerService';
import { generateId } from '../utils/format';

export interface SpeechProgressInfo {
  stage: string;
  progress: number;
  device: 'webgpu' | 'wasm';
}

export interface SpeechTranscriptionResult {
  segments: SpeechSegment[];
  captions: CaptionSegment[];
  deviceUsed: 'webgpu' | 'wasm';
  fullText: string;
}

let activeWorker: Worker | null = null;

function ensureWorker(): Worker {
  if (!activeWorker) {
    activeWorker = new Worker(new URL('./speechWorker.ts', import.meta.url), {
      type: 'module',
    });
  }
  return activeWorker;
}

export function terminateSpeechWorker(): void {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
  }
}

interface RawWhisperChunk {
  text: string;
  timestamp: [number | null, number | null];
}

function buildSegmentsFromWhisperOutput(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output: any,
  offsetSec: number,
  clipDuration: number
): { segments: SpeechSegment[]; captions: CaptionSegment[]; fullText: string } {
  const fullText = typeof output?.text === 'string' ? output.text.trim() : '';
  const rawChunks: RawWhisperChunk[] = Array.isArray(output?.chunks) ? output.chunks : [];

  // Determine whether chunks are word-level or sentence-level
  const isWordLevel =
    rawChunks.length > 0 &&
    rawChunks.every((c) => c.text.trim().split(/\s+/).length <= 2);

  const groupedCaptions: CaptionSegment[] = [];

  if (isWordLevel && rawChunks.length > 0) {
    // Group word chunks into readable 3-6 word phrases or sentence breaks
    let currentWords: SpeechWord[] = [];

    const flushGroup = () => {
      if (currentWords.length === 0) return;
      const start = currentWords[0].start;
      const end = Math.max(start + 0.25, currentWords[currentWords.length - 1].end);
      const text = currentWords.map((w) => w.word).join(' ').replace(/\s+([.,!?])/g, '$1').trim();
      if (text) {
        groupedCaptions.push({
          id: generateId('cap'),
          start: Number(start.toFixed(2)),
          end: Number(Math.min(clipDuration, end).toFixed(2)),
          text,
          words: currentWords,
        });
      }
      currentWords = [];
    };

    for (let i = 0; i < rawChunks.length; i++) {
      const ch = rawChunks[i];
      const token = ch.text.trim();
      if (!token) continue;
      const tStart = typeof ch.timestamp?.[0] === 'number' ? ch.timestamp[0] : 0;
      const nextStart =
        i + 1 < rawChunks.length && typeof rawChunks[i + 1].timestamp?.[0] === 'number'
          ? (rawChunks[i + 1].timestamp[0] as number)
          : Math.min(clipDuration, tStart + 0.45);
      const tEnd = typeof ch.timestamp?.[1] === 'number' ? ch.timestamp[1] : nextStart;

      const clean = token.toLowerCase().replace(/[^a-z0-9]/g, '');
      const prevWord = currentWords[currentWords.length - 1];
      const gap = prevWord ? tStart - prevWord.end : 0;

      if (currentWords.length >= 5 || gap > 0.7) {
        flushGroup();
      }

      currentWords.push({
        word: token,
        start: Number(Math.max(0, tStart).toFixed(2)),
        end: Number(Math.max(tStart + 0.08, Math.min(clipDuration, tEnd)).toFixed(2)),
        isKeyword: KEYWORD_HIGHLIGHT_LIST.has(clean),
      });

      if (/[.!?]$/.test(token)) {
        flushGroup();
      }
    }
    flushGroup();
  } else if (rawChunks.length > 0) {
    for (const ch of rawChunks) {
      const text = ch.text.trim();
      if (!text) continue;
      const s = typeof ch.timestamp?.[0] === 'number' ? ch.timestamp[0] : 0;
      const e = typeof ch.timestamp?.[1] === 'number' ? ch.timestamp[1] : Math.min(clipDuration, s + 3);
      const tokens = text.split(/\s+/).filter(Boolean);
      const step = (e - s) / Math.max(1, tokens.length);
      const words: SpeechWord[] = tokens.map((w, idx) => ({
        word: w,
        start: Number((s + idx * step).toFixed(2)),
        end: Number((s + (idx + 1) * step).toFixed(2)),
        isKeyword: KEYWORD_HIGHLIGHT_LIST.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')),
      }));
      groupedCaptions.push({
        id: generateId('cap'),
        start: Number(Math.max(0, s).toFixed(2)),
        end: Number(Math.min(clipDuration, Math.max(s + 0.3, e)).toFixed(2)),
        text,
        words,
      });
    }
  } else if (fullText) {
    // Fallback if Whisper returned text without timestamps
    const tokens: string[] = fullText.split(/\s+/).filter(Boolean);
    const step = clipDuration / Math.max(1, tokens.length);
    const words: SpeechWord[] = tokens.map((w: string, idx: number) => ({
      word: w,
      start: Number((idx * step).toFixed(2)),
      end: Number(((idx + 1) * step).toFixed(2)),
      isKeyword: KEYWORD_HIGHLIGHT_LIST.has(w.toLowerCase().replace(/[^a-z0-9]/g, '')),
    }));
    groupedCaptions.push({
      id: generateId('cap'),
      start: 0,
      end: Number(clipDuration.toFixed(2)),
      text: fullText,
      words,
    });
  }

  // Score excitement & detect gaming phrases on each segment
  const segments: SpeechSegment[] = groupedCaptions.map((cap) => {
    const lower = cap.text.toLowerCase();
    const matchedPhrases: string[] = [];
    let excitement = 0;

    for (const entry of EXCITING_SPEECH_PHRASES) {
      if (lower.includes(entry.phrase)) {
        matchedPhrases.push(entry.phrase);
        excitement = Math.max(excitement, entry.weight);
      }
    }
    if (cap.text.includes('!')) {
      excitement = Math.min(1, excitement + 0.15);
    }

    return {
      id: generateId('sp'),
      start: Number((cap.start + offsetSec).toFixed(2)),
      end: Number((cap.end + offsetSec).toFixed(2)),
      text: cap.text,
      words: cap.words?.map((w) => ({
        ...w,
        start: Number((w.start + offsetSec).toFixed(2)),
        end: Number((w.end + offsetSec).toFixed(2)),
      })),
      excitementScore: excitement,
      matchedPhrases,
    };
  });

  return { segments, captions: groupedCaptions, fullText };
}

/**
 * Transcribes a slice of the local video file using local Transformers.js Whisper in a Web Worker.
 * Uses WebGPU when available/preferred, with automatic CPU WASM fallback.
 * Never produces fake transcripts.
 */
export async function transcribeVideoSegment(params: {
  file: File;
  startSec: number;
  endSec: number;
  modelId: string;
  preferWebGPU: boolean;
  onProgress?: (info: SpeechProgressInfo) => void;
  signal?: AbortSignal;
}): Promise<SpeechTranscriptionResult> {
  const { file, startSec, endSec, modelId, preferWebGPU, onProgress, signal } = params;
  if (signal?.aborted) throw new Error('Transcription cancelled');

  onProgress?.({
    stage: 'Extracting 16kHz mono audio for local Whisper...',
    progress: 8,
    device: preferWebGPU ? 'webgpu' : 'wasm',
  });

  const pcm = await extractAudio16kMonoSegment(file, startSec, endSec);
  if (signal?.aborted) throw new Error('Transcription cancelled');

  const clipDuration = Math.max(0.1, endSec - startSec);
  const worker = ensureWorker();
  const reqId = generateId('whisper');

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.id !== reqId) return;

      if (msg.type === 'progress') {
        const label =
          msg.status === 'download' || msg.status === 'progress'
            ? `Downloading local Whisper model (${msg.file || modelId})...`
            : msg.file || 'Running local speech recognition...';
        onProgress?.({
          stage: label,
          progress: typeof msg.progress === 'number' ? msg.progress : 45,
          device: msg.device || 'wasm',
        });
      } else if (msg.type === 'result') {
        cleanup();
        const parsed = buildSegmentsFromWhisperOutput(msg.output, startSec, clipDuration);
        resolve({
          ...parsed,
          deviceUsed: msg.device || 'wasm',
        });
      } else if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.error || 'Local Whisper transcription failed.'));
      }
    };

    const onError = (err: ErrorEvent) => {
      cleanup();
      reject(new Error(err.message || 'Speech worker encountered an unexpected error.'));
    };

    const onAbort = () => {
      cleanup();
      terminateSpeechWorker();
      reject(new Error('Transcription cancelled'));
    };

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.postMessage(
      {
        id: reqId,
        type: 'transcribe',
        audio: pcm,
        modelId,
        preferWebGPU,
      },
      [pcm.buffer]
    );
  });
}
