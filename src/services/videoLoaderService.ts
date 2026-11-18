import type { VideoMetadata } from '../types';

export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'];
export const SUPPORTED_VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
];

export interface LoadedVideoResult {
  file: File;
  objectUrl: string;
  thumbnailUrl: string;
  metadata: VideoMetadata;
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const lower = file.name.toLowerCase();
  const extMatch = SUPPORTED_VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const mimeMatch =
    file.type === '' || SUPPORTED_VIDEO_MIMES.some((m) => file.type.toLowerCase().startsWith(m));

  if (!extMatch && !mimeMatch) {
    return {
      valid: false,
      error: `Unsupported video format ("${file.name}"). Please upload an MP4, MOV, or WebM gameplay recording.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes). Please choose a valid gameplay video.',
    };
  }

  return { valid: true };
}

/**
 * Captures a single JPEG Blob URL from a video element at a given timestamp.
 */
export async function captureVideoFrameBlobUrl(
  video: HTMLVideoElement,
  timeSec: number,
  maxWidth = 480
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeTime = Math.max(0, Math.min(timeSec, Math.max(0, (video.duration || 0) - 0.1)));
    const onSeeked = () => {
      cleanup();
      try {
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 360;
        const scale = Math.min(1, maxWidth / vw);
        const cw = Math.max(2, Math.round(vw * scale));
        const ch = Math.max(2, Math.round(vh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not acquire 2D canvas context for thumbnail capture.'));
          return;
        }
        ctx.drawImage(video, 0, 0, cw, ch);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to encode video frame thumbnail.'));
              return;
            }
            resolve(URL.createObjectURL(blob));
          },
          'image/jpeg',
          0.84
        );
      } catch (err) {
        reject(err);
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video decoding error while capturing thumbnail frame.'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });

    if (Math.abs(video.currentTime - safeTime) < 0.04 && video.readyState >= 2) {
      onSeeked();
    } else {
      video.currentTime = safeTime;
    }
  });
}

/**
 * Loads a local video file into browser memory via Blob URL, reads true HTML5 metadata,
 * and captures a real thumbnail frame.
 */
export async function loadLocalVideoFile(
  file: File,
  onProgress?: (percent: number, stage: string) => void
): Promise<LoadedVideoResult> {
  const check = validateVideoFile(file);
  if (!check.valid) {
    throw new Error(check.error);
  }

  onProgress?.(15, 'Creating local memory stream...');
  const objectUrl = URL.createObjectURL(file);

  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    onProgress?.(40, 'Reading video container metadata...');
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(
          new Error(
            'Timed out reading video metadata. Your browser may not support the codec inside this file (e.g., HEVC/H.265 MOV). Try H.264 MP4 or WebM.'
          )
        );
      }, 20000);

      const resolveFiniteDuration = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) {
          window.clearTimeout(timeout);
          resolve();
          return;
        }
        // Standard workaround for MediaRecorder / unindexed WebM files whose header reports Infinity
        const onDurationFixed = () => {
          video.removeEventListener('timeupdate', onDurationFixed);
          video.removeEventListener('durationchange', onDurationFixed);
          window.clearTimeout(timeout);
          if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = 0;
            resolve();
          } else {
            reject(
              new Error('Could not determine video duration. The file may be corrupted or unindexed.')
            );
          }
        };
        video.addEventListener('timeupdate', onDurationFixed, { once: true });
        video.addEventListener('durationchange', onDurationFixed, { once: true });
        video.currentTime = 1e7;
      };

      video.onloadedmetadata = resolveFiniteDuration;
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(
          new Error(
            'Browser could not decode this video file. Ensure it uses a browser-supported codec (H.264/VP9/AV1 in MP4, MOV, or WebM).'
          )
        );
      };
    });

    onProgress?.(75, 'Extracting preview frame thumbnail...');
    const thumbTime = Math.min(Math.max(0.5, video.duration * 0.1), Math.max(0.1, video.duration - 0.2));
    const thumbnailUrl = await captureVideoFrameBlobUrl(video, thumbTime, 560);

    // Reasonable FPS baseline (browsers don't expose exact container FPS synchronously without full decode)
    const fpsEstimate = video.videoHeight >= 1080 ? 60 : 30;

    onProgress?.(100, 'Video ready');

    return {
      file,
      objectUrl,
      thumbnailUrl,
      metadata: {
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'video/mp4',
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fpsEstimate,
        sourceType: 'local',
      },
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  } finally {
    video.src = '';
    video.load();
  }
}

/**
 * Loads a direct video URL ONLY if the remote server allows CORS access.
 * Downloads into browser memory as a File/Blob so local FFmpeg & Web Audio analysis work cleanly.
 */
export async function loadCorsDirectVideoUrl(
  rawUrl: string,
  onProgress?: (percent: number, stage: string) => void,
  signal?: AbortSignal
): Promise<LoadedVideoResult> {
  const url = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Please enter a valid http:// or https:// direct video URL.');
  }

  onProgress?.(10, 'Checking CORS access on remote video URL...');
  let response: Response;
  try {
    response = await fetch(parsed.toString(), { mode: 'cors', signal });
  } catch (err) {
    if (signal?.aborted) throw new Error('Cancelled');
    throw new Error(
      'Unable to fetch this URL directly from the browser due to CORS restrictions or network failure. Download the video locally and upload it using the Local File tab.'
    );
  }

  if (!response.ok) {
    throw new Error(`Remote server returned HTTP ${response.status} ${response.statusText}.`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('video/') && !contentType.includes('octet-stream')) {
    throw new Error(
      `URL did not return a direct video stream (received "${contentType || 'unknown'}"). Only direct MP4/WebM/MOV files with CORS headers are supported.`
    );
  }

  const totalBytes = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();
  let blob: Blob;

  if (reader) {
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const copy = new Uint8Array(value.byteLength);
        copy.set(value);
        chunks.push(copy);
        received += value.byteLength;
        if (totalBytes > 0) {
          const pct = 15 + Math.round((received / totalBytes) * 55);
          onProgress?.(pct, `Downloading CORS video (${Math.round((received / totalBytes) * 100)}%)...`);
        } else {
          onProgress?.(40, `Downloading CORS video (${(received / (1024 * 1024)).toFixed(1)} MB)...`);
        }
      }
    }
    blob = new Blob(chunks, { type: contentType || 'video/mp4' });
  } else {
    onProgress?.(45, 'Downloading CORS video...');
    blob = await response.blob();
  }

  const pathPart = parsed.pathname.split('/').filter(Boolean).pop() || 'remote_gameplay.mp4';
  const safeName = SUPPORTED_VIDEO_EXTENSIONS.some((e) => pathPart.toLowerCase().endsWith(e))
    ? pathPart
    : `${pathPart}.mp4`;

  const file = new File([blob], safeName, { type: blob.type || 'video/mp4' });
  const loaded = await loadLocalVideoFile(file, (p, s) => onProgress?.(70 + Math.round(p * 0.3), s));
  loaded.metadata.sourceType = 'cors-url';
  loaded.metadata.sourceUrl = url;
  return loaded;
}
