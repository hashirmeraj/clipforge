import { pipeline, env } from '@huggingface/transformers';

// Configure Transformers.js for pure browser local inference (no server/backend)
env.allowLocalModels = false;
env.useBrowserCache = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;
let loadedModelId: string | null = null;
let loadedDevice: 'webgpu' | 'wasm' | null = null;

interface WorkerRequest {
  id: string;
  type: 'transcribe';
  audio: Float32Array;
  modelId: string;
  preferWebGPU: boolean;
}

async function detectWorkerWebGPU(): Promise<boolean> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (!nav.gpu) return false;
    const adapter = await nav.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

async function getTranscriber(modelId: string, preferWebGPU: boolean, requestId: string) {
  const canWebGPU = preferWebGPU ? await detectWorkerWebGPU() : false;
  const targetDevice: 'webgpu' | 'wasm' = canWebGPU ? 'webgpu' : 'wasm';

  if (transcriber && loadedModelId === modelId && loadedDevice === targetDevice) {
    return { pipe: transcriber, device: loadedDevice };
  }

  // Unload previous model to avoid holding multiple huge models in memory
  if (transcriber && typeof transcriber.dispose === 'function') {
    try {
      await transcriber.dispose();
    } catch {
      // ignore
    }
    transcriber = null;
  }

  const progressCallback = (info: {
    status?: string;
    file?: string;
    progress?: number;
  }) => {
    self.postMessage({
      id: requestId,
      type: 'progress',
      status: info.status || 'loading',
      file: info.file || '',
      progress: typeof info.progress === 'number' ? Math.round(info.progress) : undefined,
      device: targetDevice,
    });
  };

  try {
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      device: targetDevice,
      dtype: targetDevice === 'webgpu' ? 'fp32' : 'q8',
      progress_callback: progressCallback,
    });
    loadedModelId = modelId;
    loadedDevice = targetDevice;
    return { pipe: transcriber, device: targetDevice };
  } catch (err) {
    // If WebGPU failed, gracefully fall back to WASM CPU
    if (targetDevice === 'webgpu') {
      self.postMessage({
        id: requestId,
        type: 'progress',
        status: 'fallback',
        file: 'WebGPU unavailable for Whisper — switching to CPU WASM...',
        progress: 0,
        device: 'wasm',
      });
      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: progressCallback,
      });
      loadedModelId = modelId;
      loadedDevice = 'wasm';
      return { pipe: transcriber, device: 'wasm' as const };
    }
    throw err;
  }
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  if (!req || req.type !== 'transcribe') return;

  try {
    const { pipe, device } = await getTranscriber(req.modelId, req.preferWebGPU, req.id);

    self.postMessage({
      id: req.id,
      type: 'progress',
      status: 'transcribing',
      file: `Running local Whisper (${device.toUpperCase()})...`,
      progress: 50,
      device,
    });

    // Run Whisper with chunking and word-level timestamps (fallback to segment timestamps if needed)
    let output;
    try {
      output = await pipe(req.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: 'word',
      });
    } catch {
      output = await pipe(req.audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
    }

    self.postMessage({
      id: req.id,
      type: 'result',
      device,
      output,
    });
  } catch (err) {
    self.postMessage({
      id: req.id,
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
