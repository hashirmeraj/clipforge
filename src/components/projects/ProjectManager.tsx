import React, { useRef, useState } from 'react';
import {
  FolderKanban,
  FolderPlus,
  Trash2,
  Pencil,
  Check,
  X,
  Upload,
  FolderOpen,
  Info,
  Film,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { loadLocalVideoFile } from '../../services/videoLoaderService';
import { getGameConfig } from '../../constants/gaming';
import { formatBytes, formatDurationHuman } from '../../utils/format';

export const ProjectManager: React.FC = () => {
  const {
    projects,
    activeProjectId,
    mediaMap,
    selectProject,
    renameProject,
    deleteProject,
    clearAllProjects,
    reattachVideoToProject,
    setPage,
  } = useClipForge();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [reattachTargetId, setReattachTargetId] = useState<string | null>(null);
  const [reattachError, setReattachError] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      renameProject(editingId, editName);
    }
    setEditingId(null);
  };

  const triggerReattach = (projectId: string) => {
    setReattachTargetId(projectId);
    setReattachError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reattachTargetId) return;
    setReattachError(null);
    try {
      const loaded = await loadLocalVideoFile(file);
      reattachVideoToProject(reattachTargetId, loaded);
    } catch (err) {
      setReattachError(err instanceof Error ? err.message : 'Failed to load video.');
    } finally {
      setReattachTargetId(null);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Local Projects</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage saved project metadata, highlight timestamps, clip settings, and export history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && !confirmClearAll && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear History
            </button>
          )}
          {confirmClearAll && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs">
              <span className="text-red-200">Delete all {projects.length} projects?</span>
              <button
                onClick={() => {
                  clearAllProjects();
                  setConfirmClearAll(false);
                }}
                className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-500"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClearAll(false)}
                className="rounded bg-white/10 px-2 py-1 text-zinc-200 hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => setPage('import')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </div>

      {/* Honest Ephemeral Video Storage Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-4 text-xs text-zinc-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="leading-relaxed">
          <strong className="text-sky-200">LocalStorage Metadata Only:</strong> ClipForge stores
          your project names, highlight timestamps, clip trim/crop/caption settings, and export
          history in LocalStorage. Full video files are never stored persistently — after refreshing
          or reopening the browser, simply click{' '}
          <strong className="text-white">Re-upload Video</strong> on any saved project to restore
          playback and exporting.
        </p>
      </div>

      {reattachError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{reattachError}</span>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="studio-panel p-12 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-zinc-600" />
          <h2 className="mt-3 text-base font-semibold text-white">No saved local projects</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Import a gameplay video to create your first ClipForge project.
          </p>
          <button
            onClick={() => setPage('import')}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            <FolderPlus className="h-4 w-4" />
            Import Gameplay Video
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj) => {
            const media = mediaMap[proj.id];
            const isActive = proj.id === activeProjectId;
            const game = getGameConfig(proj.gameCategory);

            return (
              <div
                key={proj.id}
                className={`studio-panel p-5 ${isActive ? 'ring-1 ring-violet-500/50' : ''}`}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0d12]">
                      {media?.thumbnailUrl ? (
                        <img
                          src={media.thumbnailUrl}
                          alt={proj.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <Film className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {editingId === proj.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                              autoFocus
                              className="rounded-md border border-violet-500 bg-[#0b0d12] px-2.5 py-1 text-sm font-semibold text-white focus:outline-none"
                            />
                            <button
                              onClick={commitRename}
                              className="rounded bg-violet-600 p-1 text-white hover:bg-violet-500"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded bg-white/10 p-1 text-zinc-300"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="truncate text-base font-bold text-white">{proj.name}</h3>
                            <button
                              onClick={() => startRename(proj.id, proj.name)}
                              className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                              title="Rename project"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}

                        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                          {game.label}
                        </span>

                        {media ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                            Video Active in Memory
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                            Re-upload Required
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                        <span>
                          File:{' '}
                          <span className="font-mono text-zinc-300">
                            {proj.videoMeta?.filename || 'Unknown'}
                          </span>
                        </span>
                        {proj.videoMeta && (
                          <>
                            <span>Duration: {formatDurationHuman(proj.videoMeta.duration)}</span>
                            <span>
                              {proj.videoMeta.width}×{proj.videoMeta.height}
                            </span>
                          </>
                        )}
                        <span>Imported: {new Date(proj.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-zinc-300">
                        <span className="rounded bg-white/[0.04] px-2 py-0.5">
                          {proj.highlights.length} Highlights
                        </span>
                        <span className="rounded bg-white/[0.04] px-2 py-0.5">
                          {proj.clips.length} Clips
                        </span>
                        <span className="rounded bg-white/[0.04] px-2 py-0.5">
                          {proj.exportHistory.length} Exported MP4s
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Project Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!media && (
                      <button
                        onClick={() => triggerReattach(proj.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/30"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Re-upload Video
                      </button>
                    )}

                    <button
                      onClick={() =>
                        selectProject(
                          proj.id,
                          proj.clips.length > 0
                            ? 'editor'
                            : proj.highlights.length > 0
                            ? 'highlights'
                            : 'analyze'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      Open
                    </button>

                    <button
                      onClick={() => deleteProject(proj.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs text-zinc-400 hover:border-red-500/40 hover:text-red-300"
                      title="Delete project and release memory"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Export History Metadata */}
                {proj.exportHistory.length > 0 && (
                  <div className="mt-4 border-t border-white/[0.06] pt-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400">
                      <Download className="h-3 w-3 text-emerald-400" />
                      Export History
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {proj.exportHistory.slice(0, 6).map((rec) => (
                        <div
                          key={rec.id}
                          className="rounded-md border border-white/[0.06] bg-[#0b0d12] px-2.5 py-1.5 text-[11px] text-zinc-300"
                        >
                          <span className="font-mono text-zinc-100">{rec.filename}</span>
                          <span className="ml-2 text-zinc-500">
                            {rec.resolution} • {rec.aspectRatio} • {rec.fps}fps •{' '}
                            {formatBytes(rec.sizeBytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
