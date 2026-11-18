import type { AppSettings, ProjectData } from '../types';

const SETTINGS_KEY = 'clipforge_settings_v1';
const PROJECTS_KEY = 'clipforge_projects_v1';
const ACTIVE_PROJECT_KEY = 'clipforge_active_project_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  defaultGameCategory: 'gta',
  defaultClipDurations: [30, 60],
  defaultAspectRatio: '9:16',
  defaultLayout: 'smart-crop',
  defaultCaptionPreset: 'mrbeast',
  defaultExportResolution: '1080p',
  defaultExportFps: 30,
  defaultExportQuality: 'high',
  analysisDensity: 'balanced',
  enableLocalWhisper: false,
  whisperModel: 'Xenova/whisper-tiny.en',
  preferWebGPU: true,
  largeFileWarningMB: 600,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      defaultClipDurations:
        Array.isArray(parsed.defaultClipDurations) && parsed.defaultClipDurations.length > 0
          ? parsed.defaultClipDurations
          : DEFAULT_SETTINGS.defaultClipDurations,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('[ClipForge] Failed to persist settings to LocalStorage:', err);
  }
}

export function loadProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProjectData[];
  } catch {
    return [];
  }
}

/**
 * Persists strictly metadata (never video files, blob URLs, or large base64 frames)
 * into LocalStorage.
 */
export function saveProjects(projects: ProjectData[]): { ok: boolean; error?: string } {
  try {
    const sanitized = projects.map((p) => ({
      ...p,
      // Ensure no accidental large or ephemeral fields leak into LocalStorage
      highlights: p.highlights.map((h) => ({ ...h })),
      clips: p.clips.map((c) => ({ ...c })),
    }));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(sanitized));
    return { ok: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'LocalStorage quota exceeded while saving project metadata.';
    console.warn('[ClipForge] saveProjects failed:', msg);
    return { ok: false, error: msg };
  }
}

export function loadActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function saveActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearAllProjectsStorage(): void {
  try {
    localStorage.removeItem(PROJECTS_KEY);
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {
    // ignore
  }
}
