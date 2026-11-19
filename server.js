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

// Launch local BotGuard PO-Token provider on port 4416 if present
function startPotProvider() {
  const possiblePaths = [
    '/opt/pot-provider/build/main.js',
    '/opt/pot-provider/dist/main.js',
    '/opt/pot-provider/main.js',
  ];
  const potPath = possiblePaths.find((p) => fs.existsSync(p));
  if (potPath) {
    console.log(`[ClipForge] Starting BotGuard PO-Token provider from ${potPath}...`);
    try {
      const potProcess = spawn('node', [potPath, '--host', '127.0.0.1', '--port', '4416'], {
        cwd: path.dirname(potPath),
        stdio: 'inherit',
      });
      potProcess.on('error', (err) => {
        console.warn('[ClipForge POT Provider] Spawn error:', err.message);
      });
      process.on('exit', () => {
        try {
          potProcess.kill();
        } catch {}
      });
    } catch (err) {
      console.warn('[ClipForge POT Provider] Failed to launch:', err.message);
    }
  } else {
    console.log('[ClipForge] No local POT provider found (skipping)');
  }
}
startPotProvider();

// Helper: Resolve proxy argument if provided via environment
function getProxyArg() {
  const p = process.env.PROXY_URL || process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
  if (p && p.trim()) {
    return ['--proxy', p.trim()];
  }
  return [];
}

// Helper: Resolve cookies file if provided via env or disk
function getCookieFilePath() {
  if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.trim().length > 10) {
    const p = path.join(os.tmpdir(), 'yt_cookies.txt');
    try {
      fs.writeFileSync(p, process.env.YOUTUBE_COOKIES.trim());
      return p;
    } catch {
      return null;
    }
  }
  const localFile = path.join(__dirname, 'cookies.txt');
  if (fs.existsSync(localFile)) {
    return localFile;
  }
  return null;
}

// Video info endpoint
app.get('/api/info', (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  const cookiePath = getCookieFilePath();
  const infoArgs = [
    '-v',
    '--dump-json',
    '--skip-download',
    '--no-warnings',
    '--geo-bypass',
    '--js-runtimes',
    'node',
    '--extractor-args',
    'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
    '--extractor-args',
    'youtube:player-client=tv,mweb,web_safari,web',
    ...getProxyArg(),
    ...(cookiePath ? ['--cookies', cookiePath] : []),
    url,
  ];

  const ytdlp = spawn('yt-dlp', infoArgs);
  let stdoutData = '';
  let stderrData = '';

  ytdlp.stdout.on('data', (d) => {
    stdoutData += d.toString();
    process.stdout.write(d);
  });

  ytdlp.stderr.on('data', (d) => {
    stderrData += d.toString();
    process.stderr.write(d);
  });

  ytdlp.on('close', async (code) => {
    if (code !== 0) {
      // Fallback to official YouTube oEmbed API so metadata never fails for public videos
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          return res.json({
            title: oembedData.title || 'YouTube Video',
            duration: 0,
            author: oembedData.author_name || 'YouTube Creator',
            thumbnail: oembedData.thumbnail_url || '',
          });
        }
      } catch (err) {
        console.warn('[oEmbed fallback failed]:', err.message);
      }

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
async function tryCobaltFallback(videoUrl, startSec, durationSec, outPath, isFull = false) {
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
      const ffmpegArgs = isFull
        ? ['-i', streamUrl, '-c', 'copy', '-movflags', '+faststart', '-y', outPath]
        : [
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
          ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

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
  req.setTimeout(0);
  res.setTimeout(0);

  const url = req.query.url;
  const isFullVideo =
    req.query.full === 'true' ||
    req.query.duration === '0' ||
    req.query.duration === 'full' ||
    !req.query.duration;

  const rawDuration = parseInt(req.query.duration, 10) || 0;
  const durationSec = isFullVideo ? 0 : Math.max(rawDuration, 15);
  const startSec = Math.max(parseInt(req.query.startTime, 10) || 0, 0);
  const endSec = startSec + durationSec;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Format HH:MM:SS or MM:SS for yt-dlp section
  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const tempId = crypto.randomBytes(6).toString('hex');
  const tempFilePath = path.join(os.tmpdir(), `clip_${Date.now()}_${tempId}.mp4`);

  const cookiePath = getCookieFilePath();
  const args = [
    '-v',
    '--no-playlist',
    '--no-warnings',
    '--geo-bypass',
    '--js-runtimes',
    'node',
    '--extractor-args',
    'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
    '--extractor-args',
    'youtube:player-client=tv,mweb,web_safari,web',
    ...getProxyArg(),
    ...(cookiePath ? ['--cookies', cookiePath] : []),
    ...(isFullVideo
      ? []
      : [
          '--download-sections',
          `*${formatTime(startSec)}-${formatTime(endSec)}`,
          '--force-keyframes-at-cuts',
        ]),
    '-f',
    'bestvideo[height<=720]+bestaudio/best[height<=720]/bestvideo+bestaudio/best',
    '--remux-video',
    'mp4',
    '--postprocessor-args',
    'ffmpeg:-movflags +faststart',
    '-o',
    tempFilePath,
    url,
  ];

  console.log(
    `[ClipForge Stream] Starting download: ${url} (${
      isFullVideo ? 'FULL VIDEO' : `range: *${formatTime(startSec)}-${formatTime(endSec)}`
    }) -> ${tempFilePath}`
  );

  const ytdlp = spawn('yt-dlp', args);
  let stderrOutput = '';

  ytdlp.stdout.on('data', (d) => {
    process.stdout.write(d);
  });

  ytdlp.stderr.on('data', (d) => {
    stderrOutput += d.toString();
    process.stderr.write(d);
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
      success = await tryCobaltFallback(url, startSec, durationSec, tempFilePath, isFullVideo);
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
