import fs from 'node:fs';
import path from 'node:path';

const srcDir = path.resolve('node_modules/@ffmpeg/core/dist/esm');
const destDir = path.resolve('public/ffmpeg');

fs.mkdirSync(destDir, { recursive: true });

for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log('[ClipForge] Copied FFmpeg.wasm core assets to public/ffmpeg/');
