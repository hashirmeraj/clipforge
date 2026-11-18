import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';
import type { AspectRatio, Clip, ExportSettings, VideoMetadata } from '../types';
import { buildOverlayCuesForExport, getOutputDimensions } from './captionRendererService';
import { clamp, sanitizeFilename } from '../utils/format';

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;
let activeProgressHandler: ((p: { progress: number; time: number }) => void) | null = null;
let lastLogs: string[] = [];

export function isFFmpegLoaded(): boolean {
  return ffmpegLoaded && ffmpegInstance !== null;
}

export async function loadFFmpegEngine(
  onStatus?: (stage: string, progress: number) => void
): Promise<FFmpeg> {
  if (ffmpegLoaded && ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    onStatus?.('Initializing FFmpeg.wasm Web Worker...', 10);
    const ff = new FFmpeg();
    ff.on('log', ({ message }) => {
      lastLogs.push(message);
      if (lastLogs.length > 80) lastLogs.shift();
    });
    ff.on('progress', (ev) => {
      activeProgressHandler?.(ev);
    });

    try {
      onStatus?.('Loading FFmpeg WebAssembly core (~32 MB)...', 35);
      // Prefer same-origin local assets in /ffmpeg/, fallback to jsDelivr CDN if unavailable
      const localCoreJs = `${window.location.origin}/ffmpeg/ffmpeg-core.js`;
      const localCoreWasm = `${window.location.origin}/ffmpeg/ffmpeg-core.wasm`;

      let coreURL: string;
      let wasmURL: string;

      try {
        const probe = await fetch(localCoreJs, { method: 'HEAD' });
        if (!probe.ok) throw new Error('Local core unavailable');
        coreURL = await toBlobURL(localCoreJs, 'text/javascript');
        wasmURL = await toBlobURL(localCoreWasm, 'application/wasm');
      } catch {
        const cdnBase = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
        coreURL = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript');
        wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm');
      }

      onStatus?.('Starting FFmpeg WebAssembly runtime...', 75);
      await ff.load({ coreURL, wasmURL });
      ffmpegInstance = ff;
      ffmpegLoaded = true;
      onStatus?.('FFmpeg.wasm ready', 100);
      return ff;
    } catch (err) {
      ffmpegInstance = null;
      ffmpegLoaded = false;
      throw err;
    } finally {
      ffmpegLoadingPromise = null;
    }
  })();

  return ffmpegLoadingPromise;
}

export function cancelActiveFFmpegExport(): void {
  if (ffmpegInstance) {
    try {
      ffmpegInstance.terminate();
    } catch {
      // ignore
    }
  }
  ffmpegInstance = null;
  ffmpegLoaded = false;
  ffmpegLoadingPromise = null;
  activeProgressHandler = null;
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/**
 * Builds the exact FFmpeg video filtergraph matching our live Clip Editor layout,
 * aspect ratio, manual/smart crop, facecam stacked layout, and gaming color grade.
 */
function buildVideoLayoutFilter(
  clip: Clip,
  sourceMeta: VideoMetadata,
  outW: number,
  outH: number,
  aspectRatio: AspectRatio
): string {
  const sw = Math.max(16, sourceMeta.width || 1280);
  const sh = Math.max(16, sourceMeta.height || 720);
  const zoom = clamp(clip.crop.zoom || 1, 1, 2.5);

  const eqNeeded =
    Math.abs(clip.colorGrade.contrast - 1) > 0.01 ||
    Math.abs(clip.colorGrade.saturation - 1) > 0.01 ||
    Math.abs(clip.colorGrade.brightness) > 0.005;

  const eqSuffix = eqNeeded
    ? `,eq=contrast=${clip.colorGrade.contrast.toFixed(2)}:saturation=${clip.colorGrade.saturation.toFixed(
        2
      )}:brightness=${clip.colorGrade.brightness.toFixed(2)}`
    : '';

  if (clip.layout === 'blurred-bg') {
    return (
      `[0:v]split=2[bg_raw][fg_raw];` +
      `[bg_raw]scale=${outW}:${outH}:force_original_aspect_ratio=increase,crop=${outW}:${outH},boxblur=20:5,eq=brightness=-0.12[bg];` +
      `[fg_raw]scale=${outW}:${outH}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(W-w)/2:(H-h)/2${eqSuffix}[vbase]`
    );
  }

  if (clip.layout === 'full-gameplay') {
    return (
      `[0:v]scale=${outW}:${outH}:force_original_aspect_ratio=decrease,` +
      `pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:color=#0b0d12${eqSuffix}[vbase]`
    );
  }

  if (clip.layout === 'stacked' && aspectRatio === '9:16') {
    const topH = even(outH * 0.65);
    const botH = outH - topH;
    const topAspect = outW / topH;

    let cropTopH = sh / zoom;
    let cropTopW = cropTopH * topAspect;
    if (cropTopW > sw) {
      cropTopW = sw;
      cropTopH = cropTopW / topAspect;
    }
    const tw = even(Math.min(sw, cropTopW));
    const th = even(Math.min(sh, cropTopH));
    const tx = Math.round(clamp(clip.crop.x * sw - tw / 2, 0, Math.max(0, sw - tw)));
    const ty = Math.round(clamp(clip.crop.y * sh - th / 2, 0, Math.max(0, sh - th)));

    const fcW = even(clamp(clip.crop.facecamWidth * sw, 32, sw));
    const fcH = even(clamp(clip.crop.facecamHeight * sh, 32, sh));
    const fcX = Math.round(clamp(clip.crop.facecamX * sw - fcW / 2, 0, Math.max(0, sw - fcW)));
    const fcY = Math.round(clamp(clip.crop.facecamY * sh - fcH / 2, 0, Math.max(0, sh - fcH)));

    return (
      `[0:v]split=2[top_raw][bot_raw];` +
      `[top_raw]crop=${tw}:${th}:${tx}:${ty},scale=${outW}:${topH}:flags=lanczos[top];` +
      `[bot_raw]crop=${fcW}:${fcH}:${fcX}:${fcY},scale=${outW}:${botH}:force_original_aspect_ratio=increase,crop=${outW}:${botH}[bot];` +
      `[top][bot]vstack=inputs=2${eqSuffix}[vbase]`
    );
  }

  // Smart Crop or Center Crop
  const targetAspect = outW / outH;
  const srcAspect = sw / sh;
  let cropW: number;
  let cropH: number;

  if (srcAspect > targetAspect) {
    cropH = sh / zoom;
    cropW = cropH * targetAspect;
  } else {
    cropW = sw / zoom;
    cropH = cropW / targetAspect;
  }

  const cw = even(Math.min(sw, cropW));
  const ch = even(Math.min(sh, cropH));
  const anchorX = clip.layout === 'center-crop' ? 0.5 : clip.crop.x;
  const anchorY = clip.layout === 'center-crop' ? 0.5 : clip.crop.y;
  const cx = Math.round(clamp(anchorX * sw - cw / 2, 0, Math.max(0, sw - cw)));
  const cy = Math.round(clamp(anchorY * sh - ch / 2, 0, Math.max(0, sh - ch)));

  return `[0:v]crop=${cw}:${ch}:${cx}:${cy},scale=${outW}:${outH}:flags=lanczos${eqSuffix}[vbase]`;
}

export interface ExportClipResult {
  blob: Blob;
  objectUrl: string;
  filename: string;
  sizeBytes: number;
  aspectRatio: AspectRatio;
}

/**
 * Renders a real H.264 MP4 clip locally in the browser using FFmpeg.wasm.
 */
export async function exportClipWithFFmpeg(params: {
  sourceFile: File;
  sourceMeta: VideoMetadata;
  clip: Clip;
  settings: ExportSettings;
  bgMusicFile?: File;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<ExportClipResult> {
  const { sourceFile, sourceMeta, clip, settings, bgMusicFile, onProgress } = params;

  const aspectRatio = settings.overrideAspectRatio ?? clip.aspectRatio;
  const { width: outW, height: outH } = getOutputDimensions(aspectRatio, settings.resolution);
  const clipDuration = Math.max(0.5, Number((clip.end - clip.start).toFixed(3)));

  onProgress?.(3, 'Loading FFmpeg.wasm worker...');
  const ff = await loadFFmpegEngine((stage, p) => {
    onProgress?.(Math.round(3 + p * 0.12), stage);
  });

  lastLogs = [];
  const writtenFiles: string[] = [];

  try {
    const extMatch = sourceFile.name.toLowerCase().match(/\.(mp4|mov|webm)$/);
    const inputExt = extMatch ? extMatch[1] : 'mp4';
    const inputName = `input_src.${inputExt}`;
    const outputName = 'output_clip.mp4';

    onProgress?.(16, 'Writing source video into FFmpeg memory...');
    await ff.writeFile(inputName, await fetchFile(sourceFile));
    writtenFiles.push(inputName);

    // Optional captions/intro/outro transparent PNG concat overlay
    onProgress?.(22, 'Preparing captions & text overlays...');
    const overlayPack = await buildOverlayCuesForExport(clip, outW, outH);
    let hasOverlayInput = false;

    if (overlayPack && overlayPack.cues.length > 0) {
      await ff.writeFile('ov_blank.png', overlayPack.blankPng);
      writtenFiles.push('ov_blank.png');

      const lines: string[] = ['ffconcat version 1.0'];
      for (const cue of overlayPack.cues) {
        if (cue.pngBytes) {
          await ff.writeFile(cue.filename, cue.pngBytes);
          writtenFiles.push(cue.filename);
        }
        lines.push(`file '${cue.filename}'`);
        lines.push(`duration ${cue.duration.toFixed(3)}`);
      }
      // FFmpeg concat demuxer requires repeating the final file entry so its duration is respected
      const lastCue = overlayPack.cues[overlayPack.cues.length - 1];
      lines.push(`file '${lastCue.filename}'`);

      await ff.writeFile('overlays.txt', new TextEncoder().encode(lines.join('\n') + '\n'));
      writtenFiles.push('overlays.txt');
      hasOverlayInput = true;
    }

    // Optional background music input
    let hasBgMusic = false;
    let bgMusicFilename = '';
    if (bgMusicFile) {
      const bgExt = bgMusicFile.name.split('.').pop()?.toLowerCase() || 'mp3';
      bgMusicFilename = `bgm_input.${bgExt}`;
      await ff.writeFile(bgMusicFilename, await fetchFile(bgMusicFile));
      writtenFiles.push(bgMusicFilename);
      hasBgMusic = true;
    }

    const crfMap = {
      standard: '28',
      high: '23',
      maximum: '18',
    } as const;
    const presetMap = {
      standard: 'ultrafast',
      high: 'veryfast',
      maximum: 'fast',
    } as const;

    const runRender = async (assumeSourceHasAudio: boolean) => {
      const args: string[] = [];

      // Input 0: trimmed gameplay video (fast seek before -i, accurate -t duration)
      args.push('-ss', clip.start.toFixed(3), '-t', clipDuration.toFixed(3), '-i', inputName);

      let nextInputIdx = 1;
      let overlayIdx = -1;
      let bgmIdx = -1;

      if (hasOverlayInput) {
        overlayIdx = nextInputIdx++;
        args.push('-f', 'concat', '-safe', '0', '-i', 'overlays.txt');
      }

      if (hasBgMusic) {
        bgmIdx = nextInputIdx++;
        args.push('-stream_loop', '-1', '-t', clipDuration.toFixed(3), '-i', bgMusicFilename);
      }

      // Video filtergraph
      const filterParts: string[] = [];
      filterParts.push(buildVideoLayoutFilter(clip, sourceMeta, outW, outH, aspectRatio));

      let finalVideoLabel = '[vbase]';
      if (hasOverlayInput && overlayIdx >= 0) {
        filterParts.push(`[vbase][${overlayIdx}:v]overlay=0:0:shortest=1:eof_action=pass[vout]`);
        finalVideoLabel = '[vout]';
      }

      // Audio filtergraph
      let finalAudioMap: string | null = null;
      const origMuted = clip.muted || clip.originalVolume <= 0.005 || !assumeSourceHasAudio;

      if (origMuted && !hasBgMusic) {
        finalAudioMap = null;
      } else if (origMuted && hasBgMusic && bgmIdx >= 0) {
        filterParts.push(`[${bgmIdx}:a]volume=${clip.bgMusicVolume.toFixed(2)}[aout]`);
        finalAudioMap = '[aout]';
      } else if (!origMuted && hasBgMusic && bgmIdx >= 0) {
        filterParts.push(
          `[0:a]volume=${clip.originalVolume.toFixed(2)}[a0];` +
            `[${bgmIdx}:a]volume=${clip.bgMusicVolume.toFixed(2)}[a1];` +
            `[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
        );
        finalAudioMap = '[aout]';
      } else if (!origMuted) {
        if (Math.abs(clip.originalVolume - 1) > 0.02) {
          filterParts.push(`[0:a]volume=${clip.originalVolume.toFixed(2)}[aout]`);
          finalAudioMap = '[aout]';
        } else {
          finalAudioMap = '0:a?';
        }
      }

      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', finalVideoLabel);

      if (finalAudioMap) {
        args.push('-map', finalAudioMap, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
      } else {
        args.push('-an');
      }

      args.push(
        '-r',
        String(settings.fps),
        '-c:v',
        'libx264',
        '-preset',
        presetMap[settings.quality],
        '-crf',
        crfMap[settings.quality],
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-shortest',
        '-y',
        outputName
      );

      onProgress?.(28, `Encoding ${outW}×${outH} ${settings.fps}fps MP4...`);

      activeProgressHandler = ({ progress, time }) => {
        // FFmpeg.wasm reports progress in 0..1 or time in microseconds
        let ratio = Number.isFinite(progress) && progress > 0 && progress <= 1 ? progress : 0;
        if (ratio === 0 && Number.isFinite(time) && time > 0) {
          ratio = clamp(time / 1_000_000 / clipDuration, 0, 1);
        }
        const pct = Math.round(28 + ratio * 68);
        onProgress?.(
          clamp(pct, 28, 96),
          `Rendering MP4 (${Math.round(ratio * 100)}% • ${outW}×${outH} @ ${settings.fps}fps)...`
        );
      };

      const exitCode = await ff.exec(args);
      activeProgressHandler = null;
      return exitCode;
    };

    let code = await runRender(true);

    // If the source video has no audio stream, retry cleanly without mapping 0:a
    if (
      code !== 0 &&
      lastLogs.some((l) => /matches no streams|Stream specifier ':a'|does not contain any stream/i.test(l))
    ) {
      onProgress?.(30, 'Source clip has no audio track — retrying video-only encode...');
      lastLogs = [];
      code = await runRender(false);
    }

    if (code !== 0) {
      const tail = lastLogs.slice(-6).join(' | ');
      throw new Error(`FFmpeg exited with code ${code}. ${tail || 'Encoding failed.'}`);
    }

    onProgress?.(98, 'Finalizing MP4 file...');
    const rawData = await ff.readFile(outputName);
    writtenFiles.push(outputName);

    const bytes = rawData instanceof Uint8Array ? new Uint8Array(rawData) : new TextEncoder().encode(String(rawData));
    const blob = new Blob([bytes.buffer], { type: 'video/mp4' });
    const objectUrl = URL.createObjectURL(blob);

    const ratioTag = aspectRatio.replace(':', 'x');
    const filename = `${sanitizeFilename(clip.title)}_${settings.resolution}_${ratioTag}.mp4`;

    onProgress?.(100, 'Export complete');
    return {
      blob,
      objectUrl,
      filename,
      sizeBytes: blob.size,
      aspectRatio,
    };
  } catch (err) {
    activeProgressHandler = null;
    const msg = err instanceof Error ? err.message : String(err);
    const isOom = /memory|oom|abort|allocation|out of bounds/i.test(msg);
    if (isOom) {
      throw new Error(
        `Browser WebAssembly memory limit reached during rendering (${msg}). Try lowering resolution to 720p, switching FPS to 30, or using Standard quality.`
      );
    }
    throw err;
  } finally {
    // Release FFmpeg MEMFS temporary files promptly to free RAM
    if (ffmpegInstance) {
      for (const f of writtenFiles) {
        try {
          await ffmpegInstance.deleteFile(f);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * Bundles multiple completed MP4 exports into a single downloadable ZIP file.
 */
export async function createExportsZipBlob(
  items: { filename: string; url: string }[],
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const resp = await fetch(item.url);
    const buf = await resp.arrayBuffer();
    zip.file(item.filename, buf);
    onProgress?.(Math.round(((i + 1) / items.length) * 50));
  }
  return zip.generateAsync({ type: 'blob' }, (meta) => {
    onProgress?.(50 + Math.round(meta.percent * 0.5));
  });
}
