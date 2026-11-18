import type {
  AspectRatio,
  CaptionSegment,
  CaptionStyle,
  Clip,
  ExportResolution,
  TextOverlayConfig,
} from '../types';
import { KEYWORD_HIGHLIGHT_LIST } from '../constants/captions';
import { clamp } from '../utils/format';

export function getOutputDimensions(
  aspectRatio: AspectRatio,
  resolution: ExportResolution
): { width: number; height: number } {
  if (aspectRatio === '9:16') {
    return resolution === '1080p' ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
  }
  if (aspectRatio === '1:1') {
    return resolution === '1080p' ? { width: 1080, height: 1080 } : { width: 720, height: 720 };
  }
  // 16:9
  return resolution === '1080p' ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

interface DrawWordToken {
  text: string;
  isActive: boolean;
  isKeyword: boolean;
}

function getActiveCaptionTokens(
  captions: CaptionSegment[],
  style: CaptionStyle,
  relTime: number
): DrawWordToken[] | null {
  const seg = captions.find((c) => relTime >= c.start && relTime <= c.end);
  if (!seg || !seg.text.trim()) return null;

  const transform = (s: string) => (style.uppercase ? s.toUpperCase() : s);

  if (seg.words && seg.words.length > 0) {
    if (style.mode === 'word') {
      // Group words into chunks of maxWordsPerLine around the active word
      const chunkSize = clamp(style.maxWordsPerLine || 3, 1, 8);
      let activeIdx = seg.words.findIndex((w) => relTime >= w.start && relTime <= w.end);
      if (activeIdx === -1) {
        activeIdx = seg.words.findIndex((w) => w.start > relTime);
        if (activeIdx === -1) activeIdx = seg.words.length - 1;
        else activeIdx = Math.max(0, activeIdx - 1);
      }
      const chunkStart = Math.floor(activeIdx / chunkSize) * chunkSize;
      const slice = seg.words.slice(chunkStart, chunkStart + chunkSize);
      return slice.map((w, i) => ({
        text: transform(w.word),
        isActive: chunkStart + i === activeIdx,
        isKeyword: Boolean(w.isKeyword),
      }));
    }

    // Sentence mode with word-level keywords / highlight
    return seg.words.map((w) => ({
      text: transform(w.word),
      isActive: relTime >= w.start && relTime <= w.end,
      isKeyword: Boolean(w.isKeyword),
    }));
  }

  // Fallback when segment has no per-word timestamps
  const rawWords = seg.text.trim().split(/\s+/).filter(Boolean);
  const progress = clamp((relTime - seg.start) / Math.max(0.1, seg.end - seg.start), 0, 0.999);
  const approxActiveIdx = Math.floor(progress * rawWords.length);

  if (style.mode === 'word') {
    const chunkSize = clamp(style.maxWordsPerLine || 3, 1, 8);
    const chunkStart = Math.floor(approxActiveIdx / chunkSize) * chunkSize;
    return rawWords.slice(chunkStart, chunkStart + chunkSize).map((w, i) => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return {
        text: transform(w),
        isActive: chunkStart + i === approxActiveIdx,
        isKeyword: KEYWORD_HIGHLIGHT_LIST.has(clean),
      };
    });
  }

  return rawWords.map((w, i) => {
    const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
    return {
      text: transform(w),
      isActive: i === approxActiveIdx,
      isKeyword: KEYWORD_HIGHLIGHT_LIST.has(clean),
    };
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBannerOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  overlay: TextOverlayConfig,
  yRatio: number
) {
  const text = overlay.text.trim();
  if (!overlay.enabled || !text) return;

  const scale = Math.min(width, height) / 1080;
  const fontSize = Math.round(clamp(overlay.fontSize, 24, 96) * scale);
  ctx.save();
  ctx.font = `900 ${fontSize}px Montserrat, Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxWidth = width * 0.86;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineHeight = fontSize * 1.24;
  const blockH = lines.length * lineHeight;
  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const padX = fontSize * 0.65;
  const padY = fontSize * 0.38;
  const centerY = height * yRatio;

  if (overlay.bgOpacity > 0) {
    ctx.fillStyle = `rgba(9, 11, 18, ${clamp(overlay.bgOpacity, 0, 1)})`;
    drawRoundedRect(
      ctx,
      width / 2 - maxLineW / 2 - padX,
      centerY - blockH / 2 - padY,
      maxLineW + padX * 2,
      blockH + padY * 2,
      fontSize * 0.35
    );
    ctx.fill();
  }

  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.14));
  ctx.fillStyle = overlay.color || '#FFFFFF';

  lines.forEach((l, i) => {
    const ly = centerY - blockH / 2 + lineHeight * (i + 0.5);
    ctx.strokeText(l, width / 2, ly);
    ctx.fillText(l, width / 2, ly);
  });

  ctx.restore();
}

/**
 * Draws the clip's active captions, intro text, and outro text onto a transparent 2D Canvas.
 * Used identically for both live preview and FFmpeg.wasm PNG overlay export.
 */
export function drawOverlaysToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  clip: Clip,
  relTime: number
): boolean {
  ctx.clearRect(0, 0, width, height);
  const clipDuration = Math.max(0.1, clip.end - clip.start);
  let drewAnything = false;

  // 1. Intro overlay
  if (clip.introOverlay.enabled && clip.introOverlay.text.trim() && relTime <= clip.introOverlay.duration) {
    drawBannerOverlay(ctx, width, height, clip.introOverlay, 0.18);
    drewAnything = true;
  }

  // 2. Outro overlay
  if (
    clip.outroOverlay.enabled &&
    clip.outroOverlay.text.trim() &&
    relTime >= Math.max(0, clipDuration - clip.outroOverlay.duration)
  ) {
    drawBannerOverlay(ctx, width, height, clip.outroOverlay, 0.22);
    drewAnything = true;
  }

  // 3. Captions
  if (clip.captionsEnabled && clip.captions.length > 0) {
    const tokens = getActiveCaptionTokens(clip.captions, clip.captionStyle, relTime);
    if (tokens && tokens.length > 0) {
      drewAnything = true;
      const st = clip.captionStyle;
      const scale = Math.min(width, height) / 1080;
      const fontSize = Math.round(clamp(st.fontSize, 22, 92) * scale);
      const weight = st.bold ? '900' : '500';
      const slant = st.italic ? 'italic ' : '';

      ctx.save();
      ctx.font = `${slant}${weight} ${fontSize}px ${st.fontFamily}`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';

      // Wrap tokens into lines fitting 86% of canvas width
      const maxWidth = width * 0.86;
      const spaceW = ctx.measureText(' ').width;
      const lines: DrawWordToken[][] = [];
      let curLine: DrawWordToken[] = [];
      let curW = 0;

      for (const tok of tokens) {
        const w = ctx.measureText(tok.text).width;
        const addW = curLine.length > 0 ? spaceW + w : w;
        if (
          curLine.length > 0 &&
          (curW + addW > maxWidth || curLine.length >= Math.max(1, st.maxWordsPerLine))
        ) {
          lines.push(curLine);
          curLine = [tok];
          curW = w;
        } else {
          curLine.push(tok);
          curW += addW;
        }
      }
      if (curLine.length > 0) lines.push(curLine);

      const lineH = fontSize * 1.28;
      const totalH = lines.length * lineH;

      let centerYPercent = 76;
      if (st.position === 'top') centerYPercent = 16;
      else if (st.position === 'middle') centerYPercent = 52;
      else if (st.position === 'bottom') centerYPercent = 78;
      else centerYPercent = clamp(st.customYPercent, 10, 90);

      const blockCenterY = height * (centerYPercent / 100);
      const lineWidths = lines.map((ln) =>
        ln.reduce((acc, t, idx) => acc + ctx.measureText(t.text).width + (idx > 0 ? spaceW : 0), 0)
      );
      const maxLineW = Math.max(...lineWidths);

      // Optional translucent background pill
      if (st.backgroundOpacity > 0.01) {
        const padX = fontSize * 0.48;
        const padY = fontSize * 0.28;
        ctx.save();
        ctx.globalAlpha = clamp(st.backgroundOpacity, 0, 1);
        ctx.fillStyle = st.backgroundColor || '#000000';
        drawRoundedRect(
          ctx,
          width / 2 - maxLineW / 2 - padX,
          blockCenterY - totalH / 2 - padY,
          maxLineW + padX * 2,
          totalH + padY * 2,
          fontSize * 0.3
        );
        ctx.fill();
        ctx.restore();
      }

      const strokeW = Math.round(st.outlineThickness * scale * 1.15);

      lines.forEach((ln, lineIdx) => {
        const ly = blockCenterY - totalH / 2 + lineH * (lineIdx + 0.5);
        let cursorX = width / 2 - lineWidths[lineIdx] / 2;

        ln.forEach((tok, tokIdx) => {
          const w = ctx.measureText(tok.text).width;
          const highlightThis =
            (st.presetId === 'karaoke' && tok.isActive) ||
            (st.presetId === 'yellow-keywords' && tok.isKeyword) ||
            (st.mode === 'word' && tok.isActive && st.presetId !== 'minimal-white') ||
            (st.presetId === 'gaming-neon' && (tok.isActive || tok.isKeyword));

          ctx.save();
          if (st.shadow) {
            ctx.shadowColor =
              st.presetId === 'gaming-neon' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(0, 0, 0, 0.85)';
            ctx.shadowBlur = Math.round(fontSize * 0.22);
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = Math.round(fontSize * 0.08);
          }

          if (strokeW > 0) {
            ctx.strokeStyle = st.outlineColor || '#000000';
            ctx.lineWidth = strokeW;
            ctx.strokeText(tok.text, cursorX, ly);
          }

          ctx.fillStyle = highlightThis ? st.highlightColor : st.textColor;
          ctx.fillText(tok.text, cursorX, ly);
          ctx.restore();

          cursorX += w + (tokIdx < ln.length - 1 ? spaceW : 0);
        });
      });

      ctx.restore();
    }
  }

  return drewAnything;
}

export interface RenderedOverlayCue {
  filename: string;
  duration: number;
  pngBytes?: Uint8Array; // omitted if referencing shared blank.png
}

/**
 * Generates minimal set of transparent PNG overlay intervals for FFmpeg concat demuxer.
 * Only renders 1 PNG per unique caption/intro/outro visual transition!
 */
export async function buildOverlayCuesForExport(
  clip: Clip,
  width: number,
  height: number
): Promise<{ blankPng: Uint8Array; cues: RenderedOverlayCue[] } | null> {
  const clipDuration = Math.max(0.1, clip.end - clip.start);
  const hasIntro = clip.introOverlay.enabled && Boolean(clip.introOverlay.text.trim());
  const hasOutro = clip.outroOverlay.enabled && Boolean(clip.outroOverlay.text.trim());
  const hasCaptions = clip.captionsEnabled && clip.captions.length > 0;

  if (!hasIntro && !hasOutro && !hasCaptions) return null;

  // Collect all transition timestamps inside [0, clipDuration]
  const cuts = new Set<number>([0, clipDuration]);
  if (hasIntro) {
    cuts.add(clamp(clip.introOverlay.duration, 0, clipDuration));
  }
  if (hasOutro) {
    cuts.add(clamp(clipDuration - clip.outroOverlay.duration, 0, clipDuration));
  }
  if (hasCaptions) {
    for (const seg of clip.captions) {
      cuts.add(clamp(seg.start, 0, clipDuration));
      cuts.add(clamp(seg.end, 0, clipDuration));
      if (clip.captionStyle.mode === 'word' || clip.captionStyle.presetId === 'karaoke') {
        if (seg.words && seg.words.length > 0) {
          for (const w of seg.words) {
            cuts.add(clamp(w.start, 0, clipDuration));
            cuts.add(clamp(w.end, 0, clipDuration));
          }
        } else {
          const words = seg.text.trim().split(/\s+/).filter(Boolean);
          const step = (seg.end - seg.start) / Math.max(1, words.length);
          for (let i = 1; i < words.length; i++) {
            cuts.add(clamp(seg.start + i * step, 0, clipDuration));
          }
        }
      }
    }
  }

  const sortedTimes = Array.from(cuts)
    .map((t) => Number(t.toFixed(3)))
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t - arr[i - 1] >= 0.04);

  if (sortedTimes.length < 2) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const canvasToPng = async (): Promise<Uint8Array> => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to encode overlay PNG');
    return new Uint8Array(await blob.arrayBuffer());
  };

  ctx.clearRect(0, 0, width, height);
  const blankPng = await canvasToPng();

  const cues: RenderedOverlayCue[] = [];
  let nonBlankIndex = 0;

  for (let i = 0; i < sortedTimes.length - 1; i++) {
    const t0 = sortedTimes[i];
    const t1 = sortedTimes[i + 1];
    const dur = Number((t1 - t0).toFixed(3));
    if (dur < 0.03) continue;
    const mid = (t0 + t1) * 0.5;
    const drew = drawOverlaysToCanvas(ctx, width, height, clip, mid);
    if (!drew) {
      cues.push({ filename: 'ov_blank.png', duration: dur });
    } else {
      const filename = `ov_${nonBlankIndex++}.png`;
      const pngBytes = await canvasToPng();
      cues.push({ filename, duration: dur, pngBytes });
    }
  }

  if (nonBlankIndex === 0) return null;
  return { blankPng, cues };
}

/**
 * Renders a downloadable clip thumbnail PNG matching the clip's aspect ratio, layout, and optional title badge.
 */
export async function generateClipThumbnailBlob(
  videoUrl: string,
  clip: Clip,
  resolution: ExportResolution = '720p',
  includeTitleOverlay = true
): Promise<Blob> {
  const { width, height } = getOutputDimensions(clip.aspectRatio, resolution);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video for thumbnail export.'));
    });

    const targetTime = clamp((clip.start + clip.end) * 0.5, 0, Math.max(0, video.duration - 0.1));
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = targetTime;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    ctx.fillStyle = '#090b12';
    ctx.fillRect(0, 0, width, height);

    const filterCss = `contrast(${clip.colorGrade.contrast}) saturate(${clip.colorGrade.saturation}) brightness(${1 + clip.colorGrade.brightness})`;
    ctx.filter = filterCss;

    if (clip.layout === 'blurred-bg' || clip.layout === 'full-gameplay') {
      if (clip.layout === 'blurred-bg') {
        ctx.save();
        ctx.filter = `${filterCss} blur(26px) brightness(0.65)`;
        const bgScale = Math.max(width / vw, height / vh) * 1.1;
        const bw = vw * bgScale;
        const bh = vh * bgScale;
        ctx.drawImage(video, (width - bw) / 2, (height - bh) / 2, bw, bh);
        ctx.restore();
      }
      ctx.filter = filterCss;
      const fgScale = Math.min(width / vw, height / vh);
      const fw = vw * fgScale;
      const fh = vh * fgScale;
      ctx.drawImage(video, (width - fw) / 2, (height - fh) / 2, fw, fh);
    } else if (clip.layout === 'stacked' && clip.aspectRatio === '9:16') {
      const topH = Math.round(height * 0.65);
      const botH = height - topH;
      // Top gameplay crop
      const topAspect = width / topH;
      const srcTopH = vh / clip.crop.zoom;
      const srcTopW = Math.min(vw, srcTopH * topAspect);
      const sx = clamp(clip.crop.x * vw - srcTopW / 2, 0, Math.max(0, vw - srcTopW));
      const sy = clamp(clip.crop.y * vh - srcTopH / 2, 0, Math.max(0, vh - srcTopH));
      ctx.drawImage(video, sx, sy, srcTopW, srcTopH, 0, 0, width, topH);

      // Bottom facecam crop
      const fcW = clamp(clip.crop.facecamWidth * vw, 32, vw);
      const fcH = clamp(clip.crop.facecamHeight * vh, 32, vh);
      const fcX = clamp(clip.crop.facecamX * vw - fcW / 2, 0, Math.max(0, vw - fcW));
      const fcY = clamp(clip.crop.facecamY * vh - fcH / 2, 0, Math.max(0, vh - fcH));
      ctx.drawImage(video, fcX, fcY, fcW, fcH, 0, topH, width, botH);
    } else {
      // Smart crop or Center crop
      const targetAspect = width / height;
      const srcAspect = vw / vh;
      let cropW: number;
      let cropH: number;
      if (srcAspect > targetAspect) {
        cropH = vh / clip.crop.zoom;
        cropW = cropH * targetAspect;
      } else {
        cropW = vw / clip.crop.zoom;
        cropH = cropW / targetAspect;
      }
      cropW = Math.min(vw, cropW);
      cropH = Math.min(vh, cropH);
      const cx = clip.layout === 'center-crop' ? 0.5 : clip.crop.x;
      const cy = clip.layout === 'center-crop' ? 0.5 : clip.crop.y;
      const sx = clamp(cx * vw - cropW / 2, 0, Math.max(0, vw - cropW));
      const sy = clamp(cy * vh - cropH / 2, 0, Math.max(0, vh - cropH));
      ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, width, height);
    }

    ctx.filter = 'none';

    if (includeTitleOverlay && clip.title.trim()) {
      drawBannerOverlay(
        ctx,
        width,
        height,
        {
          enabled: true,
          text: clip.title.replace(/\s*\(\d+[sm]\)\s*$/i, '').toUpperCase(),
          duration: 1,
          color: '#FACC15',
          bgOpacity: 0.72,
          fontSize: 54,
        },
        0.84
      );
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Failed to encode thumbnail JPEG.');
    return blob;
  } finally {
    video.src = '';
    video.load();
  }
}
