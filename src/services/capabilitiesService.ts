import type { SystemCapabilities } from '../types';

let cachedCapabilities: SystemCapabilities | null = null;

export async function detectSystemCapabilities(): Promise<SystemCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  let hasWebGPU = false;
  try {
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
      deviceMemory?: number;
    };
    if (nav.gpu && typeof nav.gpu.requestAdapter === 'function') {
      const adapter = await nav.gpu.requestAdapter();
      hasWebGPU = Boolean(adapter);
    }
  } catch {
    hasWebGPU = false;
  }

  const navAny = navigator as Navigator & { deviceMemory?: number };
  const hasWebAudio =
    typeof window !== 'undefined' &&
    Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  const hasWorkers = typeof Worker !== 'undefined';

  cachedCapabilities = {
    hasWebGPU,
    hasWebAudio,
    hasSharedArrayBuffer,
    hasWorkers,
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemoryGB: typeof navAny.deviceMemory === 'number' ? navAny.deviceMemory : null,
    userAgent: navigator.userAgent,
  };

  return cachedCapabilities;
}

export function getLocalStorageUsageBytes(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) ?? '';
      total += (key.length + val.length) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}
