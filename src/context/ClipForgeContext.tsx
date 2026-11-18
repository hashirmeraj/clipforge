import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  AnalysisSamplePoint,
  AnalysisSummary,
  AppPage,
  AppSettings,
  Clip,
  ExportJob,
  ExportRecord,
  GameCategory,
  Highlight,
  ProjectData,
  SpeechSegment,
  SystemCapabilities,
  VideoMetadata,
} from '../types';
import {
  clearAllProjectsStorage,
  DEFAULT_SETTINGS,
  loadActiveProjectId,
  loadProjects,
  loadSettings,
  saveActiveProjectId,
  saveProjects,
  saveSettings,
} from '../services/storageService';
import { detectSystemCapabilities } from '../services/capabilitiesService';
import { generateId } from '../utils/format';

export interface ProjectMediaMemory {
  file: File;
  objectUrl: string;
  thumbnailUrl: string;
  highlightThumbnails: Record<string, string>;
  timelineSamples: AnalysisSamplePoint[];
  speechSegments: SpeechSegment[];
  bgMusicFiles: Record<string, { file: File; objectUrl: string }>;
}

interface ClipForgeContextValue {
  page: AppPage;
  setPage: (p: AppPage) => void;

  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  resetSettings: () => void;

  capabilities: SystemCapabilities | null;

  projects: ProjectData[];
  activeProjectId: string | null;
  activeProject: ProjectData | null;
  activeMedia: ProjectMediaMemory | null;
  mediaMap: Record<string, ProjectMediaMemory>;

  activeClipId: string | null;
  setActiveClipId: (id: string | null) => void;

  exportJobs: Record<string, ExportJob>;
  setExportJob: (clipId: string, job: ExportJob) => void;
  clearExportJob: (clipId: string) => void;

  createProjectWithVideo: (params: {
    name: string;
    gameCategory: GameCategory;
    file: File;
    objectUrl: string;
    thumbnailUrl: string;
    metadata: VideoMetadata;
  }) => ProjectData;

  reattachVideoToProject: (
    projectId: string,
    params: { file: File; objectUrl: string; thumbnailUrl: string; metadata: VideoMetadata }
  ) => void;

  selectProject: (projectId: string, targetPage?: AppPage) => void;
  updateProject: (projectId: string, updater: (p: ProjectData) => ProjectData) => void;
  renameProject: (projectId: string, newName: string) => void;
  deleteProject: (projectId: string) => void;
  clearAllProjects: () => void;

  saveAnalysisResults: (params: {
    projectId: string;
    summary: AnalysisSummary;
    highlights: Highlight[];
    timelineSamples: AnalysisSamplePoint[];
    speechSegments: SpeechSegment[];
    highlightThumbnails: Record<string, string>;
  }) => void;

  setProjectClips: (projectId: string, clips: Clip[], replace?: boolean) => void;
  updateClip: (projectId: string, clipId: string, updater: (c: Clip) => Clip) => void;
  deleteClip: (projectId: string, clipId: string) => void;

  attachClipBgMusic: (projectId: string, clipId: string, file: File | null) => void;
  recordExportHistory: (projectId: string, record: ExportRecord) => void;

  storageWarning: string | null;
}

const ClipForgeContext = createContext<ClipForgeContextValue | null>(null);

function revokeProjectMedia(media?: ProjectMediaMemory) {
  if (!media) return;
  try {
    URL.revokeObjectURL(media.objectUrl);
  } catch {
    // ignore
  }
  try {
    URL.revokeObjectURL(media.thumbnailUrl);
  } catch {
    // ignore
  }
  Object.values(media.highlightThumbnails).forEach((u) => {
    try {
      URL.revokeObjectURL(u);
    } catch {
      // ignore
    }
  });
  Object.values(media.bgMusicFiles).forEach((b) => {
    try {
      URL.revokeObjectURL(b.objectUrl);
    } catch {
      // ignore
    }
  });
}

export const ClipForgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [page, setPage] = useState<AppPage>('dashboard');
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [projects, setProjects] = useState<ProjectData[]>(() => loadProjects());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => loadActiveProjectId());
  const [mediaMap, setMediaMap] = useState<Record<string, ProjectMediaMemory>>({});
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [exportJobs, setExportJobs] = useState<Record<string, ExportJob>>({});
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const mediaMapRef = useRef(mediaMap);
  mediaMapRef.current = mediaMap;

  const exportJobsRef = useRef(exportJobs);
  exportJobsRef.current = exportJobs;

  useEffect(() => {
    detectSystemCapabilities().then(setCapabilities);
  }, []);

  // Persist projects metadata whenever projects change
  useEffect(() => {
    const res = saveProjects(projects);
    if (!res.ok) {
      setStorageWarning(res.error ?? 'Unable to save metadata to LocalStorage.');
    } else {
      setStorageWarning(null);
    }
  }, [projects]);

  useEffect(() => {
    saveActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  // Cleanup all ephemeral object URLs on window unload
  useEffect(() => {
    const handleUnload = () => {
      Object.values(mediaMapRef.current).forEach(revokeProjectMedia);
      Object.values(exportJobsRef.current).forEach((j) => {
        if (j.outputUrl) {
          try {
            URL.revokeObjectURL(j.outputUrl);
          } catch {
            // ignore
          }
        }
      });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const next = { ...DEFAULT_SETTINGS };
    setSettings(next);
    saveSettings(next);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeMedia = activeProjectId ? mediaMap[activeProjectId] ?? null : null;

  const createProjectWithVideo = useCallback(
    (params: {
      name: string;
      gameCategory: GameCategory;
      file: File;
      objectUrl: string;
      thumbnailUrl: string;
      metadata: VideoMetadata;
    }): ProjectData => {
      const now = new Date().toISOString();
      const id = generateId('proj');
      const project: ProjectData = {
        id,
        name: params.name.trim() || params.metadata.filename.replace(/\.[^.]+$/, ''),
        createdAt: now,
        updatedAt: now,
        gameCategory: params.gameCategory,
        momentFilters: [],
        customInstructions: '',
        videoMeta: params.metadata,
        analysisSummary: null,
        highlights: [],
        clips: [],
        exportHistory: [],
      };

      setProjects((prev) => [project, ...prev]);
      setMediaMap((prev) => ({
        ...prev,
        [id]: {
          file: params.file,
          objectUrl: params.objectUrl,
          thumbnailUrl: params.thumbnailUrl,
          highlightThumbnails: {},
          timelineSamples: [],
          speechSegments: [],
          bgMusicFiles: {},
        },
      }));
      setActiveProjectId(id);
      setActiveClipId(null);
      return project;
    },
    []
  );

  const reattachVideoToProject = useCallback(
    (
      projectId: string,
      params: { file: File; objectUrl: string; thumbnailUrl: string; metadata: VideoMetadata }
    ) => {
      setMediaMap((prev) => {
        revokeProjectMedia(prev[projectId]);
        return {
          ...prev,
          [projectId]: {
            file: params.file,
            objectUrl: params.objectUrl,
            thumbnailUrl: params.thumbnailUrl,
            highlightThumbnails: {},
            timelineSamples: [],
            speechSegments: [],
            bgMusicFiles: {},
          },
        };
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, videoMeta: params.metadata, updatedAt: new Date().toISOString() }
            : p
        )
      );
      setActiveProjectId(projectId);
    },
    []
  );

  const selectProject = useCallback(
    (projectId: string, targetPage?: AppPage) => {
      setActiveProjectId(projectId);
      const found = projects.find((p) => p.id === projectId);
      if (found && found.clips.length > 0) {
        setActiveClipId(found.clips[0].id);
      } else {
        setActiveClipId(null);
      }
      if (targetPage) setPage(targetPage);
    },
    [projects]
  );

  const updateProject = useCallback(
    (projectId: string, updater: (p: ProjectData) => ProjectData) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...updater(p), updatedAt: new Date().toISOString() } : p
        )
      );
    },
    []
  );

  const renameProject = useCallback((projectId: string, newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, name: clean, updatedAt: new Date().toISOString() } : p
      )
    );
  }, []);

  const deleteProject = useCallback(
    (projectId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (target) {
        // Revoke any export job URLs belonging to this project's clips
        const clipIds = new Set(target.clips.map((c) => c.id));
        setExportJobs((prev) => {
          const next = { ...prev };
          for (const cid of clipIds) {
            if (next[cid]?.outputUrl) {
              try {
                URL.revokeObjectURL(next[cid].outputUrl!);
              } catch {
                // ignore
              }
            }
            delete next[cid];
          }
          return next;
        });
      }

      setMediaMap((prev) => {
        revokeProjectMedia(prev[projectId]);
        const next = { ...prev };
        delete next[projectId];
        return next;
      });

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      if (activeProjectId === projectId) {
        setActiveProjectId(null);
        setActiveClipId(null);
      }
    },
    [activeProjectId, projects]
  );

  const clearAllProjects = useCallback(() => {
    Object.values(mediaMapRef.current).forEach(revokeProjectMedia);
    Object.values(exportJobsRef.current).forEach((j) => {
      if (j.outputUrl) {
        try {
          URL.revokeObjectURL(j.outputUrl);
        } catch {
          // ignore
        }
      }
    });
    setMediaMap({});
    setExportJobs({});
    setProjects([]);
    setActiveProjectId(null);
    setActiveClipId(null);
    clearAllProjectsStorage();
  }, []);

  const saveAnalysisResults = useCallback(
    (params: {
      projectId: string;
      summary: AnalysisSummary;
      highlights: Highlight[];
      timelineSamples: AnalysisSamplePoint[];
      speechSegments: SpeechSegment[];
      highlightThumbnails: Record<string, string>;
    }) => {
      setMediaMap((prev) => {
        const existing = prev[params.projectId];
        if (!existing) return prev;
        // Revoke old highlight thumbnails
        Object.values(existing.highlightThumbnails).forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {
            // ignore
          }
        });
        return {
          ...prev,
          [params.projectId]: {
            ...existing,
            timelineSamples: params.timelineSamples,
            speechSegments: params.speechSegments,
            highlightThumbnails: params.highlightThumbnails,
          },
        };
      });

      setProjects((prev) =>
        prev.map((p) =>
          p.id === params.projectId
            ? {
                ...p,
                analysisSummary: params.summary,
                highlights: params.highlights,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
    },
    []
  );

  const setProjectClips = useCallback(
    (projectId: string, clips: Clip[], replace = true) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                clips: replace ? clips : [...p.clips, ...clips],
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      if (clips.length > 0) {
        setActiveClipId(clips[0].id);
      }
    },
    []
  );

  const updateClip = useCallback(
    (projectId: string, clipId: string, updater: (c: Clip) => Clip) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                clips: p.clips.map((c) => (c.id === clipId ? updater(c) : c)),
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
    },
    []
  );

  const deleteClip = useCallback(
    (projectId: string, clipId: string) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          const remaining = p.clips.filter((c) => c.id !== clipId);
          if (activeClipId === clipId) {
            setActiveClipId(remaining[0]?.id ?? null);
          }
          return { ...p, clips: remaining, updatedAt: new Date().toISOString() };
        })
      );
      setExportJobs((prev) => {
        const next = { ...prev };
        if (next[clipId]?.outputUrl) {
          try {
            URL.revokeObjectURL(next[clipId].outputUrl!);
          } catch {
            // ignore
          }
        }
        delete next[clipId];
        return next;
      });
    },
    [activeClipId]
  );

  const attachClipBgMusic = useCallback(
    (projectId: string, clipId: string, file: File | null) => {
      setMediaMap((prev) => {
        const existing = prev[projectId];
        if (!existing) return prev;
        const old = existing.bgMusicFiles[clipId];
        if (old) {
          try {
            URL.revokeObjectURL(old.objectUrl);
          } catch {
            // ignore
          }
        }
        const nextBg = { ...existing.bgMusicFiles };
        if (file) {
          nextBg[clipId] = { file, objectUrl: URL.createObjectURL(file) };
        } else {
          delete nextBg[clipId];
        }
        return {
          ...prev,
          [projectId]: {
            ...existing,
            bgMusicFiles: nextBg,
          },
        };
      });

      updateClip(projectId, clipId, (c) => ({
        ...c,
        bgMusicName: file ? file.name : undefined,
      }));
    },
    [updateClip]
  );

  const setExportJob = useCallback((clipId: string, job: ExportJob) => {
    setExportJobs((prev) => {
      const old = prev[clipId];
      if (old?.outputUrl && old.outputUrl !== job.outputUrl) {
        try {
          URL.revokeObjectURL(old.outputUrl);
        } catch {
          // ignore
        }
      }
      return { ...prev, [clipId]: job };
    });
  }, []);

  const clearExportJob = useCallback((clipId: string) => {
    setExportJobs((prev) => {
      const next = { ...prev };
      if (next[clipId]?.outputUrl) {
        try {
          URL.revokeObjectURL(next[clipId].outputUrl!);
        } catch {
          // ignore
        }
      }
      delete next[clipId];
      return next;
    });
  }, []);

  const recordExportHistory = useCallback((projectId: string, record: ExportRecord) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              exportHistory: [record, ...p.exportHistory].slice(0, 50),
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  }, []);

  return (
    <ClipForgeContext.Provider
      value={{
        page,
        setPage,
        settings,
        updateSettings,
        resetSettings,
        capabilities,
        projects,
        activeProjectId,
        activeProject,
        activeMedia,
        mediaMap,
        activeClipId,
        setActiveClipId,
        exportJobs,
        setExportJob,
        clearExportJob,
        createProjectWithVideo,
        reattachVideoToProject,
        selectProject,
        updateProject,
        renameProject,
        deleteProject,
        clearAllProjects,
        saveAnalysisResults,
        setProjectClips,
        updateClip,
        deleteClip,
        attachClipBgMusic,
        recordExportHistory,
        storageWarning,
      }}
    >
      {children}
    </ClipForgeContext.Provider>
  );
};

export function useClipForge(): ClipForgeContextValue {
  const ctx = useContext(ClipForgeContext);
  if (!ctx) throw new Error('useClipForge must be used inside ClipForgeProvider');
  return ctx;
}
