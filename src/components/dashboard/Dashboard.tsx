import React from 'react';
import {
  FolderPlus,
  Scissors,
  Clock,
  Sparkles,
  ArrowRight,
  Film,
  Activity,
  Download,
  Cpu,
  ShieldCheck,
  FolderOpen,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import { formatDurationHuman } from '../../utils/format';
import { getGameConfig } from '../../constants/gaming';

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Import Gameplay',
    desc: 'Drop local MP4, MOV, or WebM recordings directly into browser memory.',
    icon: FolderPlus,
  },
  {
    step: '02',
    title: 'Analyze Signals',
    desc: 'Web Audio peaks, Canvas motion/scene-cuts & optional local Whisper speech scan.',
    icon: Activity,
  },
  {
    step: '03',
    title: 'Discover Highlights',
    desc: 'Review ranked moments with transparent signal scores and auto-generate multi-length clips.',
    icon: Sparkles,
  },
  {
    step: '04',
    title: 'Edit & Caption',
    desc: 'Convert to 9:16 vertical, drag smart crop, style presets & burn local captions.',
    icon: Scissors,
  },
  {
    step: '05',
    title: 'Export MP4 Shorts',
    desc: 'Render real H.264 MP4 clips client-side via FFmpeg.wasm with ZIP batch download.',
    icon: Download,
  },
];

export const Dashboard: React.FC = () => {
  const { projects, mediaMap, activeProject, setPage, selectProject, capabilities } = useClipForge();

  const totalClips = projects.reduce((sum, p) => sum + p.clips.length, 0);
  const totalHighlights = projects.reduce((sum, p) => sum + p.highlights.length, 0);
  const totalAnalyzedSeconds = projects.reduce(
    (sum, p) => sum + (p.analysisSummary?.durationAnalyzed ?? 0),
    0
  );
  const totalExports = projects.reduce((sum, p) => sum + p.exportHistory.length, 0);
  const recentProjects = projects.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Hero */}
      <div className="studio-panel flex flex-col justify-between gap-5 p-6 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 ring-1 ring-violet-500/25">
            <ShieldCheck className="h-3.5 w-3.5" />
            100% Client-Side Processing — Zero Cloud Uploads
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Turn Long Gameplay VODs into Viral Shorts
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-zinc-400">
            Analyze gameplay recordings locally using Web Audio, frame-motion analysis, optional local
            Whisper speech recognition, and FFmpeg.wasm MP4 rendering.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {activeProject && (
            <button
              onClick={() =>
                setPage(
                  activeProject.clips.length > 0
                    ? 'editor'
                    : activeProject.highlights.length > 0
                    ? 'highlights'
                    : 'analyze'
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]"
            >
              <Scissors className="h-4 w-4 text-sky-400" />
              Resume Editing
            </button>
          )}
          <button
            onClick={() => setPage('import')}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            <FolderPlus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="studio-panel p-5">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Generated Clips</span>
            <Scissors className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalClips}</div>
          <div className="mt-1 text-xs text-zinc-500">
            Across {projects.length} local {projects.length === 1 ? 'project' : 'projects'}
          </div>
        </div>

        <div className="studio-panel p-5">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Analyzed Gameplay</span>
            <Clock className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {totalAnalyzedSeconds > 0 ? formatDurationHuman(totalAnalyzedSeconds) : '0m'}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {totalHighlights} highlights discovered
          </div>
        </div>

        <div className="studio-panel p-5">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Exported MP4s</span>
            <Download className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalExports}</div>
          <div className="mt-1 text-xs text-zinc-500">Rendered via local FFmpeg.wasm</div>
        </div>

        <div className="studio-panel p-5">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Local Compute Engine</span>
            <Cpu className="h-4 w-4 text-violet-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-white">
            {capabilities?.hasWebGPU ? 'WebGPU + WASM' : 'CPU WASM Mode'}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {capabilities ? `${capabilities.hardwareConcurrency} logical cores detected` : 'Checking browser...'}
          </div>
        </div>
      </div>

      {/* Main Split: Recent Projects + Quick Workflow */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Recent Projects */}
        <div className="studio-panel p-5 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Recent Projects</h2>
              <p className="text-xs text-zinc-500">
                Metadata saved locally in browser storage. Videos stay in memory during active sessions.
              </p>
            </div>
            {projects.length > 0 && (
              <button
                onClick={() => setPage('projects')}
                className="text-xs font-medium text-violet-400 hover:text-violet-300"
              >
                View all ({projects.length})
              </button>
            )}
          </div>

          {recentProjects.length === 0 ? (
            <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-12 text-center">
              <Film className="h-9 w-9 text-zinc-600" />
              <h3 className="mt-3 text-sm font-semibold text-zinc-200">No gameplay projects yet</h3>
              <p className="mt-1 max-w-sm text-xs text-zinc-500">
                Import a local MP4, MOV, or WebM gameplay recording to analyze highlights and generate Shorts.
              </p>
              <button
                onClick={() => setPage('import')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                Create First Project
              </button>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-white/[0.06]">
              {recentProjects.map((proj) => {
                const isLoaded = Boolean(mediaMap[proj.id]);
                const game = getGameConfig(proj.gameCategory);
                return (
                  <div
                    key={proj.id}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#0b0d12]">
                        {mediaMap[proj.id]?.thumbnailUrl ? (
                          <img
                            src={mediaMap[proj.id].thumbnailUrl}
                            alt={proj.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-600">
                            <Film className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-100">
                            {proj.name}
                          </span>
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                            {game.shortLabel}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                          <span>{proj.videoMeta ? formatDurationHuman(proj.videoMeta.duration) : 'No media'}</span>
                          <span>{proj.highlights.length} highlights</span>
                          <span>{proj.clips.length} clips</span>
                          <span className={isLoaded ? 'text-emerald-400' : 'text-amber-400'}>
                            {isLoaded ? 'Loaded in memory' : 'Re-upload required'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.12]"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Open
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Getting Started 5-Stage Guide */}
        <div className="studio-panel p-5 lg:col-span-5">
          <h2 className="text-base font-semibold text-white">Getting Started</h2>
          <p className="text-xs text-zinc-500">
            Five streamlined steps from raw gameplay recording to upload-ready Shorts.
          </p>

          <div className="mt-4 space-y-3">
            {WORKFLOW_STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-semibold text-sky-400">
                        STEP {item.step}
                      </span>
                      <span className="text-sm font-medium text-zinc-100">{item.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setPage('import')}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 py-2.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
          >
            Start Workflow Now
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
