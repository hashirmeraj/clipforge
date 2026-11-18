import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Move, RotateCcw, Sparkles } from 'lucide-react';
import type { AspectRatio, Clip, VerticalLayout, VideoMetadata } from '../../types';
import { clamp } from '../../utils/format';

interface VideoCropperProps {
  videoUrl: string;
  sourceMeta: VideoMetadata;
  clip: Clip;
  currentTime: number;
  onUpdateCrop: (patch: Partial<Clip['crop']>) => void;
  onChangeLayout: (layout: VerticalLayout) => void;
}

export const VideoCropper: React.FC<VideoCropperProps> = ({
  videoUrl,
  sourceMeta,
  clip,
  currentTime,
  onUpdateCrop,
  onChangeLayout,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [dragMode, setDragMode] = useState<'main' | 'facecam' | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Math.abs(v.currentTime - currentTime) > 0.35) {
      v.currentTime = clamp(currentTime, 0, Math.max(0, sourceMeta.duration - 0.1));
    }
  }, [currentTime, sourceMeta.duration]);

  const aspectValue = (ar: AspectRatio): number => {
    if (ar === '9:16') return 9 / 16;
    if (ar === '1:1') return 1;
    return 16 / 9;
  };

  const sw = Math.max(16, sourceMeta.width || 1280);
  const sh = Math.max(16, sourceMeta.height || 720);
  const srcAspect = sw / sh;
  const targetAspect =
    clip.layout === 'stacked' && clip.aspectRatio === '9:16'
      ? (9 / 16) / 0.65
      : aspectValue(clip.aspectRatio);

  // Compute normalized crop rectangle width & height on the source video
  let normW: number;
  let normH: number;
  if (srcAspect > targetAspect) {
    normH = 1 / clip.crop.zoom;
    normW = (normH * targetAspect) / srcAspect;
  } else {
    normW = 1 / clip.crop.zoom;
    normH = (normW * srcAspect) / targetAspect;
  }
  normW = clamp(normW, 0.12, 1);
  normH = clamp(normH, 0.12, 1);

  const activeX = clip.layout === 'center-crop' ? 0.5 : clip.crop.x;
  const activeY = clip.layout === 'center-crop' ? 0.5 : clip.crop.y;

  const boxLeft = clamp(activeX - normW / 2, 0, 1 - normW);
  const boxTop = clamp(activeY - normH / 2, 0, 1 - normH);

  const fcW = clamp(clip.crop.facecamWidth, 0.12, 0.6);
  const fcH = clamp(clip.crop.facecamHeight, 0.12, 0.6);
  const fcLeft = clamp(clip.crop.facecamX - fcW / 2, 0, 1 - fcW);
  const fcTop = clamp(clip.crop.facecamY - fcH / 2, 0, 1 - fcH);

  const updateFromPointer = (clientX: number, clientY: number, mode: 'main' | 'facecam') => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const nx = clamp((clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((clientY - rect.top) / rect.height, 0, 1);

    if (mode === 'main') {
      // If user manually drags while in center-crop, switch to smart-crop so their manual position applies!
      if (clip.layout === 'center-crop') {
        onChangeLayout('smart-crop');
      }
      onUpdateCrop({
        x: Number(clamp(nx, normW / 2, 1 - normW / 2).toFixed(3)),
        y: Number(clamp(ny, normH / 2, 1 - normH / 2).toFixed(3)),
      });
    } else {
      onUpdateCrop({
        facecamX: Number(clamp(nx, fcW / 2, 1 - fcW / 2).toFixed(3)),
        facecamY: Number(clamp(ny, fcH / 2, 1 - fcH / 2).toFixed(3)),
      });
    }
  };

  useEffect(() => {
    if (!dragMode) return;
    const onMove = (e: PointerEvent) => updateFromPointer(e.clientX, e.clientY, dragMode);
    const onUp = () => setDragMode(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const cropActive =
    clip.layout === 'smart-crop' || clip.layout === 'center-crop' || clip.layout === 'stacked';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-zinc-300">
          <Move className="h-3.5 w-3.5 text-violet-400" />
          Interactive Crop Frame (Drag to Reposition)
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onChangeLayout('smart-crop');
              onUpdateCrop({
                x: clip.crop.smartTrackedX,
                y: clip.crop.smartTrackedY,
                zoom: 1,
              });
            }}
            className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-2 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/25"
            title="Snap to motion-tracked action center"
          >
            <Sparkles className="h-3 w-3" />
            Smart Focus
          </button>
          <button
            type="button"
            onClick={() => onUpdateCrop({ x: 0.5, y: 0.5, zoom: 1 })}
            className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/[0.12]"
            title="Reset to center"
          >
            <RotateCcw className="h-3 w-3" />
            Center
          </button>
        </div>
      </div>

      {/* Interactive Source Frame Box */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-white/10 bg-black"
      >
        <video
          ref={videoRef}
          src={videoUrl}
          muted
          playsInline
          preload="auto"
          className="h-full w-full object-contain pointer-events-none opacity-80"
        />

        {cropActive ? (
          <>
            {/* Main Crop Window */}
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                setDragMode('main');
                updateFromPointer(e.clientX, e.clientY, 'main');
              }}
              style={{
                left: `${boxLeft * 100}%`,
                top: `${boxTop * 100}%`,
                width: `${normW * 100}%`,
                height: `${normH * 100}%`,
              }}
              className="absolute cursor-grab border-2 border-violet-400 bg-violet-500/15 active:cursor-grabbing"
            >
              <span className="absolute top-1 left-1 rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Gameplay Crop
              </span>
              <Crosshair className="pointer-events-none absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-violet-300/80" />
            </div>

            {/* Facecam Crop Window (Stacked Layout only) */}
            {clip.layout === 'stacked' && clip.aspectRatio === '9:16' && (
              <div
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragMode('facecam');
                  updateFromPointer(e.clientX, e.clientY, 'facecam');
                }}
                style={{
                  left: `${fcLeft * 100}%`,
                  top: `${fcTop * 100}%`,
                  width: `${fcW * 100}%`,
                  height: `${fcH * 100}%`,
                }}
                className="absolute cursor-grab border-2 border-sky-400 bg-sky-500/20 active:cursor-grabbing"
              >
                <span className="absolute top-0.5 left-0.5 rounded bg-sky-600/95 px-1 py-0.5 text-[9px] font-bold text-white">
                  Facecam
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-xs font-medium text-zinc-200">
            Full landscape frame shown in {clip.layout === 'blurred-bg' ? 'Blurred Background' : 'Full Gameplay'} mode
          </div>
        )}
      </div>

      {/* Precision Sliders */}
      {cropActive && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
          <div>
            <div className="flex justify-between text-zinc-400">
              <span>Horizontal (X)</span>
              <span className="font-mono text-zinc-200">{Math.round(activeX * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={activeX}
              onChange={(e) => {
                if (clip.layout === 'center-crop') onChangeLayout('smart-crop');
                onUpdateCrop({ x: Number(e.target.value) });
              }}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-zinc-400">
              <span>Vertical (Y)</span>
              <span className="font-mono text-zinc-200">{Math.round(activeY * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.1}
              max={0.9}
              step={0.01}
              value={activeY}
              onChange={(e) => {
                if (clip.layout === 'center-crop') onChangeLayout('smart-crop');
                onUpdateCrop({ y: Number(e.target.value) });
              }}
              className="mt-1 w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-zinc-400">
              <span>Zoom</span>
              <span className="font-mono text-zinc-200">{clip.crop.zoom.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={1}
              max={2.4}
              step={0.05}
              value={clip.crop.zoom}
              onChange={(e) => onUpdateCrop({ zoom: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </div>
        </div>
      )}

      {clip.layout === 'stacked' && clip.aspectRatio === '9:16' && (
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.06] p-3 text-xs">
          <div className="mb-2 font-medium text-sky-200">Facecam Source Size (Bottom Panel)</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Width</span>
                <span className="font-mono">{Math.round(clip.crop.facecamWidth * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.14}
                max={0.55}
                step={0.01}
                value={clip.crop.facecamWidth}
                onChange={(e) => onUpdateCrop({ facecamWidth: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </div>
            <div>
              <div className="flex justify-between text-zinc-400">
                <span>Height</span>
                <span className="font-mono">{Math.round(clip.crop.facecamHeight * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.14}
                max={0.55}
                step={0.01}
                value={clip.crop.facecamHeight}
                onChange={(e) => onUpdateCrop({ facecamHeight: Number(e.target.value) })}
                className="mt-1 w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
