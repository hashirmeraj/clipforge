# ClipForge — Local AI Gaming Video Clipper & Shorts Studio

<div align="center">

![ClipForge Banner](docs/screenshots/clip-editor.png)

[![Railway Deployment](https://railway.com/button.svg)](https://clipforge-production-1b2a5d93.up.railway.app/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Demo-black?style=for-the-badge&logo=vercel)](https://clipforge-pi-ecru.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![FFmpeg.wasm](https://img.shields.io/badge/FFmpeg-WASM%20v0.12-green?style=for-the-badge&logo=ffmpeg)](https://ffmpegwasm.netlify.app/)
[![Transformers.js](https://img.shields.io/badge/Transformers.js-Whisper%20AI-orange?style=for-the-badge&logo=huggingface)](https://huggingface.co/docs/transformers.js)

**Turn full-length gameplay recordings into viral 9:16 vertical YouTube Shorts, TikToks & Instagram Reels directly in your browser.**

[🚀 Open Live App (Railway)](https://clipforge-production-1b2a5d93.up.railway.app/) • [⚡ Mirror (Vercel)](https://clipforge-pi-ecru.vercel.app/)

</div>

---

## 🌟 Key Features

- **⚡ 1-Click YouTube Streaming & Clipping**: Paste any YouTube link (watch, youtu.be, /shorts, /live) to stream and clip directly without downloading giant files.
- **🎙️ 100% Local Whisper AI Auto-Captions**: In-browser speech recognition via Transformers.js Whisper (runs on `WebGPU` with `CPU WASM` fallback). Zero external API keys needed!
- **🎮 AI Gameplay Highlight Detection**: Web Audio loudness/onset scanning + Canvas motion, explosion, and scene-cut detection tuned across 10 gaming categories (GTA, Fortnite, Call of Duty, Valorant, Minecraft, etc.).
- **📐 Smart 9:16 Vertical Video Studio**: Instant conversion from 16:9 landscape to 9:16 vertical with 5 layouts (`Smart Crop`, `Blurred Background`, `Center Crop`, `Stacked Facecam`, `Full Gameplay`).
- **🎨 6 Viral Caption Presets**: MrBeast Bold, Gaming Neon, Yellow Keywords, Karaoke Animated, Minimal Clean, and Cinematic with live word-by-word timing adjustments.
- **📦 In-Browser MP4 & ZIP Export**: Real client-side H.264/AAC video encoding via FFmpeg.wasm (`720p` / `1080p`, `30` / `60 FPS`), batch rendering, and downloadable `.zip` bundles.
- **🏷️ View Data SEO Metadata Pack**: Auto-generates platform-ready video titles, trending hook alternatives, descriptions, and hashtags with 1-click clipboard copy.

---

## 📸 Screenshots & Walkthrough

### 1. Project Dashboard & Video Import
Import gameplay recordings via **Local File Upload** (MP4, MOV, WebM), **1-Click YouTube Stream**, or **Direct CORS URL**.

![Dashboard](docs/screenshots/dashboard.png)

---

### 2. AI Gameplay Signal & Highlight Detection
Real-time audio loudness waveforms, visual motion spikes, and ranked action highlights detected automatically.

![AI Highlights](docs/screenshots/highlights.png)

---

### 3. Smart 9:16 Clip Editor & Live Captions
Vertical framing, draggable manual crop regions, audio mixing, and word-by-word Whisper subtitle timing.

![Clip Editor](docs/screenshots/clip-editor.png)

---

### 4. Export Center & Batch H.264 MP4 Rendering
Client-side FFmpeg rendering at 720p/1080p 60fps, thumbnail generation, and bulk ZIP exports.

![Export Center](docs/screenshots/export-center.png)

---

### 5. View Data SEO & Metadata Generator
Platform-optimized titles, hooks, viral hashtags, and search tags for YouTube Shorts and TikTok.

![View Data Modal](docs/screenshots/view-data.png)

---

## 🏗️ Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Browser (100% Local Processing)"]
        UI["React 19 + Tailwind UI"]
        AudioEngine["Web Audio API (Loudness & Peak Detection)"]
        VisionEngine["HTML5 Canvas (Motion & Explosion Scanner)"]
        WhisperEngine["Transformers.js Whisper (WebGPU / WASM)"]
        FFmpegEngine["FFmpeg.wasm (H.264 Video Encoder)"]
        MetadataEngine["Viral Title & Tag Generator"]
    end

    subgraph Streaming ["Railway Unified Server"]
        Express["Express Server (Port 8080)"]
        YTDLP["yt-dlp + ffmpeg stream tunnel"]
    end

    UI --> AudioEngine
    UI --> VisionEngine
    UI --> WhisperEngine
    UI --> FFmpegEngine
    UI --> MetadataEngine
    UI <-->|"GET /api/stream?url=... (1-Click YouTube)"| Express
    Express --> YTDLP
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/hashirmeraj/clipforge.git
cd clipforge

# Install dependencies
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` to start clipping gameplay recordings!

### Build for Production

```bash
npm run build
```

### Start Unified Production Server (Frontend + YouTube Stream API)

```bash
npm start
```

---

## 🚢 Deployment

### Deploy to Railway (Recommended)

ClipForge is pre-configured for **Railway** with `Dockerfile` and `nixpacks.toml`:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/)

1. Create a project on Railway and select **Deploy from GitHub repo**.
2. Select `hashirmeraj/clipforge`.
3. In service settings, generate a domain under **Networking**.

### Deploy to Vercel

ClipForge also supports zero-config static deployment on Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hashirmeraj/clipforge)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
