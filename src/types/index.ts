export type AppPage =
  | 'dashboard'
  | 'import'
  | 'analyze'
  | 'highlights'
  | 'editor'
  | 'export'
  | 'projects'
  | 'settings';

export type GameCategory =
  | 'gta'
  | 'fortnite'
  | 'pubg'
  | 'cod'
  | 'minecraft'
  | 'valorant'
  | 'cs'
  | 'horror'
  | 'racing'
  | 'other';

export type HighlightCategory =
  | 'Action'
  | 'Combat'
  | 'Clutch'
  | 'Explosion'
  | 'Reaction'
  | 'Funny'
  | 'Unexpected Moment'
  | 'Chase'
  | 'Cinematic'
  | 'High Energy';

export type AspectRatio = '9:16' | '16:9' | '1:1';

export type VerticalLayout =
  | 'smart-crop'
  | 'center-crop'
  | 'blurred-bg'
  | 'stacked'
  | 'full-gameplay';

export type ExportResolution = '720p' | '1080p';
export type ExportFps = 30 | 60;
export type ExportQuality = 'standard' | 'high' | 'maximum';

export type CaptionMode = 'word' | 'sentence';
export type CaptionPosition = 'top' | 'middle' | 'bottom' | 'custom';

export type CaptionPresetId =
  | 'mrbeast'
  | 'gaming-neon'
  | 'minimal-white'
  | 'yellow-keywords'
  | 'karaoke'
  | 'cinematic';

export type GamingClipPresetId =
  | 'none'
  | 'gta-cinematic'
  | 'funny-gameplay'
  | 'kill-montage'
  | 'clutch-moment'
  | 'horror-reaction'
  | 'racing-action'
  | 'explosive-action';

export type AnalysisDensity = 'fast' | 'balanced' | 'thorough';

export interface VideoMetadata {
  filename: string;
  size: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  fpsEstimate: number;
  sourceType: 'local' | 'cors-url';
  sourceUrl?: string;
}

export interface AnalysisSamplePoint {
  time: number;
  audioRms: number;       // 0..1 normalized
  audioPeak: number;      // 0..1 normalized
  audioOnset: number;     // 0..1 sudden loudness jump
  voiceEnergy: number;    // 0..1 mid-band 300-3400Hz energy
  motionScore: number;    // 0..1 frame-to-frame pixel difference
  sceneCutScore: number;  // 0..1 histogram/structural jump
  flashScore: number;     // 0..1 bright explosion/flash spike
  motionCenterX: number;  // 0..1 horizontal center of motion
  motionCenterY: number;  // 0..1 vertical center of motion
  combinedScore: number;  // 0..1 weighted highlight energy
}

export interface SpeechWord {
  word: string;
  start: number;
  end: number;
  isKeyword?: boolean;
}

export interface SpeechSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  words?: SpeechWord[];
  excitementScore: number; // 0..1
  matchedPhrases: string[];
}

export interface HighlightSignals {
  audioScore: number;        // 0..100
  visualScore: number;       // 0..100
  speechScore: number;       // 0..100
  audioPeakDb: number;       // e.g. -6.2
  motionIntensity: number;   // 0..100
  sceneCutCount: number;
  flashSpike: boolean;
  matchedSpeech: string[];
  motionCenterX: number;     // 0..1
  motionCenterY: number;     // 0..1
}

export interface Highlight {
  id: string;
  index: number;
  start: number;
  end: number;
  peakTime: number;
  duration: number;
  score: number;             // 0..100
  category: HighlightCategory;
  title: string;
  reason: string;
  signals: HighlightSignals;
  selected: boolean;
}

export interface CaptionStyle {
  presetId: CaptionPresetId;
  mode: CaptionMode;
  position: CaptionPosition;
  customYPercent: number; // 10..90
  fontFamily: string;
  fontSize: number;       // relative to 1080px height scale (e.g. 34..78)
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  outlineThickness: number; // 0..12
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  shadow: boolean;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  maxWordsPerLine: number;
}

export interface CaptionSegment {
  id: string;
  start: number; // seconds relative to clip start (0..clipDuration)
  end: number;
  text: string;
  words?: SpeechWord[];
}

export interface CropConfig {
  /** Normalized center X (0..1) of crop window on source video */
  x: number;
  /** Normalized center Y (0..1) of crop window on source video */
  y: number;
  /** Zoom multiplier 1.0..2.5 */
  zoom: number;
  /** Motion-computed smart anchor from frame analysis */
  smartTrackedX: number;
  smartTrackedY: number;
  /** Facecam crop region on source video (normalized 0..1) for stacked layout */
  facecamX: number;
  facecamY: number;
  facecamWidth: number;
  facecamHeight: number;
}

export interface TextOverlayConfig {
  enabled: boolean;
  text: string;
  duration: number; // seconds
  color: string;
  bgOpacity: number; // 0..1
  fontSize: number;
}

export interface ClipColorGrade {
  contrast: number;   // 0.8..1.35 (1 = normal)
  saturation: number; // 0.6..1.5 (1 = normal)
  brightness: number; // -0.15..0.15 (0 = normal)
}

export interface Clip {
  id: string;
  title: string;
  highlightId?: string;
  category: HighlightCategory;
  score: number;
  start: number;
  end: number;
  targetDuration: number;
  aspectRatio: AspectRatio;
  layout: VerticalLayout;
  crop: CropConfig;
  captionsEnabled: boolean;
  captionStyle: CaptionStyle;
  captions: CaptionSegment[];
  introOverlay: TextOverlayConfig;
  outroOverlay: TextOverlayConfig;
  gamingPreset: GamingClipPresetId;
  colorGrade: ClipColorGrade;
  originalVolume: number; // 0..2 (1 = 100%)
  muted: boolean;
  bgMusicName?: string;
  bgMusicVolume: number;  // 0..1
  selected: boolean;
}

export interface ExportSettings {
  resolution: ExportResolution;
  fps: ExportFps;
  quality: ExportQuality;
  overrideAspectRatio?: AspectRatio;
}

export interface ExportJob {
  id: string;
  clipId: string;
  clipTitle: string;
  status: 'idle' | 'queued' | 'loading-ffmpeg' | 'rendering' | 'done' | 'error' | 'cancelled';
  progress: number; // 0..100
  stageText: string;
  outputUrl?: string;
  outputFilename?: string;
  outputSize?: number;
  error?: string;
  fallbackSuggestion?: string;
  completedAt?: string;
  settings: ExportSettings;
}

export interface ExportRecord {
  id: string;
  clipId: string;
  clipTitle: string;
  filename: string;
  resolution: ExportResolution;
  aspectRatio: AspectRatio;
  fps: ExportFps;
  quality: ExportQuality;
  sizeBytes: number;
  exportedAt: string;
}

export interface AnalysisSummary {
  analyzedAt: string;
  method: 'heuristic-audio-visual' | 'heuristic-plus-whisper';
  audioAnalysisMode: 'web-audio-full' | 'web-audio-chunked' | 'visual-fallback';
  sampleCount: number;
  durationAnalyzed: number;
  highlightCount: number;
  speechSegmentsCount: number;
  webgpuUsed: boolean;
  processingTimeMs: number;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  gameCategory: GameCategory;
  momentFilters: string[];
  customInstructions: string;
  videoMeta: VideoMetadata | null;
  analysisSummary: AnalysisSummary | null;
  highlights: Highlight[];
  clips: Clip[];
  exportHistory: ExportRecord[];
}

export interface AppSettings {
  defaultGameCategory: GameCategory;
  defaultClipDurations: number[];
  defaultAspectRatio: AspectRatio;
  defaultLayout: VerticalLayout;
  defaultCaptionPreset: CaptionPresetId;
  defaultExportResolution: ExportResolution;
  defaultExportFps: ExportFps;
  defaultExportQuality: ExportQuality;
  analysisDensity: AnalysisDensity;
  enableLocalWhisper: boolean;
  whisperModel: 'Xenova/whisper-tiny.en' | 'Xenova/whisper-base.en';
  preferWebGPU: boolean;
  largeFileWarningMB: number;
}

export interface SystemCapabilities {
  hasWebGPU: boolean;
  hasWebAudio: boolean;
  hasSharedArrayBuffer: boolean;
  hasWorkers: boolean;
  hardwareConcurrency: number;
  deviceMemoryGB: number | null;
  userAgent: string;
}
