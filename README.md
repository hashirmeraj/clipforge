# ClipForge — Local AI Gaming Video Clipper

A 100% browser-based AI gaming video clipping studio built with **React**, **TypeScript**, **Vite**, **Tailwind CSS**, **FFmpeg.wasm**, **Web Audio API**, **Canvas API**, and **Transformers.js (Local Whisper)**.

Everything runs locally in the user's browser — no backend, no cloud storage, no database, and no external AI API keys.

## Features

- **Local Video Import**: MP4, MOV, and WebM upload with drag-and-drop, metadata/thumbnail extraction, YouTube URL validation/preview (with honest CORS notice), and CORS-enabled direct video URL support.
- **Gameplay Highlight Detection**: Web Audio API loudness/onset/voice-band scanning + Canvas frame-motion, scene-cut, and flash/explosion detection tuned across 10 gaming categories with custom instructions and optional local Whisper reaction detection.
- **Automatic Clip Generator**: Multi-select clip durations (`15s`–`3m` + custom), non-overlapping clip scheduling, intelligent context padding, and ranked highlight timeline.
- **Smart Vertical Video Editor**: `9:16`, `16:9`, and `1:1` output with 5 layouts (`Smart Crop`, `Center Crop`, `Blurred Background`, `Stacked + Facecam`, `Full Gameplay`), draggable manual cropper, 7 gaming presets, custom intro/ending overlays, color punch, and local background music mixing.
- **Local Whisper Auto-Captions**: Transformers.js Whisper (`WebGPU` with automatic `CPU WASM` fallback), 6 styled caption presets (MrBeast Bold, Gaming Neon, Minimal White, Yellow Keywords, Karaoke Animated, Clean Cinematic), and full manual transcript editing.
- **Client-Side MP4 & ZIP Export**: Real H.264/AAC MP4 rendering via FFmpeg.wasm (`720p`/`1080p`, `30`/`60 FPS`, `Standard`/`High`/`Maximum`), batch rendering, downloadable thumbnails, and `.zip` export bundles.
- **Local Projects & Settings**: Metadata-only persistence in `LocalStorage` with automatic Blob URL cleanup.

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
