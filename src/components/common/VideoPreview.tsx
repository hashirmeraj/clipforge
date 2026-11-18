import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { formatTimePrecise } from '../../utils/format';

interface VideoPreviewProps {
  src: string;
  startTime?: number;
  endTime?: number;
  autoPlay?: boolean;
  loopSegment?: boolean;
  className?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  src,
  startTime = 0,
  endTime,
  autoPlay = false,
  loopSegment = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [duration, setDuration] = useState(0);

  const effectiveEnd = endTime ?? duration;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startTime;
    setCurrentTime(startTime);
    if (autoPlay) {
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [src, startTime, endTime, autoPlay]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setCurrentTime(t);
    if (endTime !== undefined && t >= endTime) {
      if (loopSegment) {
        v.currentTime = startTime;
        v.play().catch(() => {});
      } else {
        v.pause();
        setPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (endTime !== undefined && (v.currentTime >= endTime || v.currentTime < startTime)) {
        v.currentTime = startTime;
      }
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = Number(e.target.value);
    v.currentTime = val;
    setCurrentTime(val);
  };

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startTime;
    v.play().then(() => setPlaying(true)).catch(() => {});
  };

  return (
    <div className={`overflow-hidden rounded-xl border border-white/[0.08] bg-black ${className}`}>
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={videoRef}
          src={src}
          muted={muted}
          playsInline
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            setDuration(d);
            if (startTime > 0 && startTime < d) {
              e.currentTarget.currentTime = startTime;
            }
          }}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setPlaying(false)}
          onClick={togglePlay}
          className="h-full w-full cursor-pointer object-contain"
        />
      </div>
      <div className="flex items-center gap-3 border-t border-white/[0.07] bg-[#10131b] px-3.5 py-2.5">
        <button
          onClick={togglePlay}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>

        <button
          onClick={replay}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          title="Restart segment"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <span className="font-mono text-xs text-zinc-300">
          {formatTimePrecise(Math.max(0, currentTime - startTime))}
        </span>

        <input
          type="range"
          min={startTime}
          max={Math.max(startTime + 0.1, effectiveEnd || 1)}
          step={0.05}
          value={Math.min(Math.max(currentTime, startTime), Math.max(startTime + 0.1, effectiveEnd || 1))}
          onChange={handleSeek}
          className="h-1.5 flex-1 cursor-pointer"
        />

        <span className="font-mono text-xs text-zinc-500">
          {formatTimePrecise(Math.max(0, (effectiveEnd || 0) - startTime))}
        </span>

        <button
          onClick={() => setMuted((m) => !m)}
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};
