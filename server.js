import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ClipForge Unified Server', timestamp: Date.now() });
});

// Video info endpoint
app.get('/api/info', (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  const ytdlp = spawn('yt-dlp', [
    '--dump-json',
    '--skip-download',
    '--no-warnings',
    '--geo-bypass',
    '--extractor-args',
    'youtube:player_client=tv_embedded,android,ios',
    url,
  ]);
  let stdoutData = '';
  let stderrData = '';

  ytdlp.stdout.on('data', (d) => {
    stdoutData += d.toString();
  });

  ytdlp.stderr.on('data', (d) => {
    stderrData += d.toString();
  });

  ytdlp.on('close', (code) => {
    if (code !== 0) {
      return res.status(500).json({
        error: 'Failed to extract video metadata',
        details: stderrData.slice(0, 300),
      });
    }

    try {
      const info = JSON.parse(stdoutData);
      res.json({
        title: info.title || 'YouTube Video',
        duration: info.duration || 0,
        author: info.uploader || info.channel || 'Creator',
        thumbnail: info.thumbnail || '',
      });
    } catch {
      res.status(500).json({ error: 'Failed to parse video metadata JSON' });
    }
  });
});

// Helper: Fallback to Cobalt API to get a direct stream if yt-dlp is rate-limited on datacenter IP
async function tryCobaltFallback(videoUrl, startSec, durationSec, outPath) {
  try {
    console.log(`[ClipForge Stream] Attempting Cobalt fallback for: ${videoUrl}`);
    const cobaltRes = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        videoQuality: '720',
      }),
    });

    if (!cobaltRes.ok) return false;
    const data = await cobaltRes.json();
    const streamUrl = data.url;
    if (!streamUrl) return false;

    console.log(`[ClipForge Stream] Cobalt returned stream URL, slicing with FFmpeg...`);
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', [
        '-ss',
        String(startSec),
        '-i',
        streamUrl,
        '-t',
        String(durationSec),
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        '-y',
        outPath,
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      ffmpeg.on('error', () => resolve(false));
    });
  } catch (err) {
    console.error('[ClipForge Stream] Cobalt fallback error:', err.message);
    return false;
  }
}

// 1-Click Stream YouTube Video directly into browser memory
app.get('/api/stream', (req, res) => {
  const url = req.query.url;
  const durationSec = Math.min(Math.max(parseInt(req.query.duration, 10) || 60, 5), 180); // clamp 5s to 3m
  const startSec = Math.max(parseInt(req.query.startTime, 10) || 0, 0);
  const endSec = startSec + durationSec;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Format MM:SS for yt-dlp section
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const section = `*${formatTime(startSec)}-${formatTime(endSec)}`;
  const tempId = crypto.randomBytes(6).toString('hex');
  const tempFilePath = path.join(os.tmpdir(), `clip_${Date.now()}_${tempId}.mp4`);

  const args = [
    '--no-playlist',
    '--no-warnings',
    '--geo-bypass',
    '--extractor-args',
    'youtube:player_client=tv_embedded,android,ios',
    '--download-sections',
    section,
    '-f',
    'best[height<=720]/bestvideo[height<=720]+bestaudio/best',
    '--force-keyframes-at-cuts',
    '--merge-output-format',
    'mp4',
    '--postprocessor-args',
    'ffmpeg:-movflags +faststart',
    '-o',
    tempFilePath,
    url,
  ];

  console.log(`[ClipForge Stream] Starting download: ${url} (range: ${section}) -> ${tempFilePath}`);

  const ytdlp = spawn('yt-dlp', args);
  let stderrOutput = '';

  ytdlp.stderr.on('data', (d) => {
    stderrOutput += d.toString();
  });

  const cleanup = () => {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (err) {
      console.error('[ClipForge Stream] Temp file cleanup error:', err.message);
    }
  };

  req.on('close', () => {
    if (!ytdlp.killed) {
      ytdlp.kill();
    }
    // Clean up after 5 seconds to ensure any pending file handles close
    setTimeout(cleanup, 5000);
  });

  ytdlp.on('error', (err) => {
    console.error('[yt-dlp spawn error]', err);
    cleanup();
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start yt-dlp process', details: err.message });
    }
  });

  ytdlp.on('close', async (code) => {
    let success = false;
    if (code === 0 && fs.existsSync(tempFilePath) && fs.statSync(tempFilePath).size >= 1024) {
      success = true;
    } else {
      console.warn(`[yt-dlp exited with code ${code}], attempting Cobalt fallback...`);
      success = await tryCobaltFallback(url, startSec, durationSec, tempFilePath);
    }

    if (!success || !fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size < 1024) {
      cleanup();
      if (!res.headersSent) {
        console.error(`[Stream extraction failed]:`, stderrOutput.slice(-500));
        res.status(500).json({
          error: 'Stream extraction failed',
          details: stderrOutput.slice(-500) || `Process exited with code ${code}`,
        });
      }
      return;
    }

    const fileSize = fs.statSync(tempFilePath).size;
    console.log(`[ClipForge Stream] Successfully created clip: ${fileSize} bytes. Sending to client...`);

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="youtube_clip.mp4"');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.sendFile(tempFilePath, (sendErr) => {
      cleanup();
      if (sendErr && !res.headersSent) {
        console.error('[ClipForge Stream sendFile error]', sendErr);
      }
    });
  });
});

// Serve frontend static files (SPA fallback for Express 5)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ClipForge] Server running on port ${PORT}`);
});
