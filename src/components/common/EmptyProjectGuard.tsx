import React, { useRef, useState } from 'react';
import { FolderPlus, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { loadLocalVideoFile } from '../../services/videoLoaderService';

interface EmptyProjectGuardProps {
  title: string;
  description: string;
}

export const EmptyProjectGuard: React.FC<EmptyProjectGuardProps> = ({ title, description }) => {
  const { activeProject, activeMedia, setPage, reattachVideoToProject } = useClipForge();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReattach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProject) return;
    setLoading(true);
    setError(null);
    try {
      const loaded = await loadLocalVideoFile(file);
      reattachVideoToProject(activeProject.id, loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video file.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  if (activeProject && !activeMedia) {
    return (
      <div className="studio-panel mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <RefreshCw className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-white">Re-upload Original Video to Continue</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Project <span className="font-medium text-zinc-200">{activeProject.name}</span> has saved
          metadata ({activeProject.highlights.length} highlights, {activeProject.clips.length} clips),
          but ClipForge does not persist full video files in browser storage. Re-select{' '}
          <span className="font-mono text-xs text-zinc-300">
            {activeProject.videoMeta?.filename || 'the original recording'}
          </span>{' '}
          to resume editing and exporting.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-left text-xs text-red-300 ring-1 ring-red-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            onChange={handleReattach}
            className="hidden"
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {loading ? 'Loading video...' : 'Re-upload Original Video'}
          </button>
          <button
            onClick={() => setPage('import')}
            className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/[0.1]"
          >
            <FolderPlus className="h-4 w-4" />
            Start New Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-panel mx-auto max-w-xl p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
        <FolderPlus className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
      <button
        onClick={() => setPage('import')}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
      >
        <FolderPlus className="h-4 w-4" />
        Import Gameplay Video
      </button>
    </div>
  );
};
