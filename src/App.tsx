import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { ClipForgeProvider, useClipForge } from './context/ClipForgeContext';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/dashboard/Dashboard';

// Lazy load heavy studio pages to keep initial bundle lean and responsive
const VideoImporter = lazy(() =>
  import('./components/import/VideoImporter').then((m) => ({ default: m.VideoImporter }))
);
const VideoAnalyzer = lazy(() =>
  import('./components/analyze/VideoAnalyzer').then((m) => ({ default: m.VideoAnalyzer }))
);
const HighlightsPage = lazy(() =>
  import('./components/highlights/HighlightsPage').then((m) => ({ default: m.HighlightsPage }))
);
const ClipEditor = lazy(() =>
  import('./components/editor/ClipEditor').then((m) => ({ default: m.ClipEditor }))
);
const ExportManager = lazy(() =>
  import('./components/export/ExportManager').then((m) => ({ default: m.ExportManager }))
);
const ProjectManager = lazy(() =>
  import('./components/projects/ProjectManager').then((m) => ({ default: m.ProjectManager }))
);
const SettingsPanel = lazy(() =>
  import('./components/settings/SettingsPanel').then((m) => ({ default: m.SettingsPanel }))
);

const PageLoader: React.FC = () => (
  <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
    <Loader2 className="mr-2 h-5 w-5 animate-spin text-violet-400" />
    Loading module...
  </div>
);

const PageRouter: React.FC = () => {
  const { page } = useClipForge();

  return (
    <Suspense fallback={<PageLoader />}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'import' && <VideoImporter />}
      {page === 'analyze' && <VideoAnalyzer />}
      {page === 'highlights' && <HighlightsPage />}
      {page === 'editor' && <ClipEditor />}
      {page === 'export' && <ExportManager />}
      {page === 'projects' && <ProjectManager />}
      {page === 'settings' && <SettingsPanel />}
    </Suspense>
  );
};

export function App() {
  return (
    <ClipForgeProvider>
      <AppShell>
        <PageRouter />
      </AppShell>
    </ClipForgeProvider>
  );
}

export default App;
