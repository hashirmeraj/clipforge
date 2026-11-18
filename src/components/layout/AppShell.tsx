import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderPlus,
  Activity,
  Sparkles,
  Scissors,
  Download,
  FolderKanban,
  Settings,
  Cpu,
  HardDrive,
  Menu,
  X,
  Film,
  AlertTriangle,
} from 'lucide-react';
import { useClipForge } from '../../context/ClipForgeContext';
import type { AppPage } from '../../types';

interface NavItem {
  id: AppPage;
  label: string;
  step?: number;
  icon: React.ComponentType<{ className?: string }>;
}

const WORKFLOW_NAV: NavItem[] = [
  { id: 'import', label: 'New Project', step: 1, icon: FolderPlus },
  { id: 'analyze', label: 'Video Analysis', step: 2, icon: Activity },
  { id: 'highlights', label: 'AI Highlights', step: 3, icon: Sparkles },
  { id: 'editor', label: 'Clip Editor', step: 4, icon: Scissors },
  { id: 'export', label: 'Export Center', step: 5, icon: Download },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Local Projects', icon: FolderKanban },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { page, setPage, activeProject, activeMedia, capabilities, storageWarning } = useClipForge();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (id: AppPage) => {
    setPage(id);
    setMobileMenuOpen(false);
  };

  const renderBadge = (id: AppPage) => {
    if (!activeProject) return null;
    if (id === 'highlights' && activeProject.highlights.length > 0) {
      return (
        <span className="ml-auto rounded-full bg-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-300">
          {activeProject.highlights.length}
        </span>
      );
    }
    if ((id === 'editor' || id === 'export') && activeProject.clips.length > 0) {
      return (
        <span className="ml-auto rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] font-medium text-sky-300">
          {activeProject.clips.length}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b0d12] text-zinc-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#0e1017] transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-15 items-center justify-between border-b border-white/[0.07] px-5">
          <button
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/90 text-white shadow-sm">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white">ClipForge</div>
              <div className="text-[10px] font-medium tracking-wider text-zinc-500 uppercase">
                Local AI Clipper
              </div>
            </div>
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Overview
          </div>
          <div className="space-y-1">
            {SECONDARY_NAV.slice(0, 1).map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            5-Stage Workflow
          </div>
          <div className="space-y-1">
            {WORKFLOW_NAV.map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold ${
                      active
                        ? 'bg-violet-500 text-white'
                        : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {item.step}
                  </span>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {renderBadge(item.id)}
                </button>
              );
            })}
          </div>

          <div className="mt-6 mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Workspace
          </div>
          <div className="space-y-1">
            {SECONDARY_NAV.slice(1).map((item) => {
              const Icon = item.icon;
              const active = page === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/30'
                      : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Local Runtime Footer */}
        <div className="border-t border-white/[0.07] p-3">
          <div className="rounded-lg bg-white/[0.03] p-2.5 text-xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                <HardDrive className="h-3.5 w-3.5 text-sky-400" />
                100% Local Engine
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" title="Runs locally in browser" />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Cpu className="h-3 w-3" />
              {capabilities?.hasWebGPU ? 'WebGPU + WASM Ready' : 'CPU / WASM Fallback Mode'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-15 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0e1017]/90 px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/5 hover:text-white lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            {activeProject ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-medium text-zinc-500 hidden sm:inline">
                  Active Project:
                </span>
                <span className="truncate text-sm font-semibold text-zinc-100 max-w-[200px] sm:max-w-[320px]">
                  {activeProject.name}
                </span>
                {activeMedia ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/25">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Video Loaded
                  </span>
                ) : (
                  <button
                    onClick={() => setPage('projects')}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/25 hover:bg-amber-500/25"
                    title="Re-upload the original video to edit or export"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Re-upload Needed
                  </button>
                )}
              </div>
            ) : (
              <div className="text-sm text-zinc-400">No active project selected</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {storageWarning && (
              <span
                className="hidden md:inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300"
                title={storageWarning}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Storage Warning
              </span>
            )}
            <button
              onClick={() => setPage('import')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
};
