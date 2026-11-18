import type {
  GameCategory,
  GamingClipPresetId,
  CaptionPresetId,
  VerticalLayout,
  ClipColorGrade,
  HighlightCategory,
} from '../types';

export interface GameCategoryConfig {
  id: GameCategory;
  label: string;
  shortLabel: string;
  description: string;
  momentFilters: string[];
  samplePrompts: string[];
  /** Signal weight tuning for heuristic scoring */
  weights: {
    audio: number;
    onset: number;
    voice: number;
    motion: number;
    sceneCut: number;
    flash: number;
  };
  defaultCategories: HighlightCategory[];
}

export const GAME_CATEGORIES: GameCategoryConfig[] = [
  {
    id: 'gta',
    label: 'GTA 5 / GTA 6',
    shortLabel: 'GTA',
    description: 'Police chases, car crashes, explosions, shootouts & chaotic NPC moments',
    momentFilters: [
      'Police chases',
      'Car crashes',
      'Explosions',
      'Shootouts',
      'Unexpected NPC behavior',
      'Funny situations',
      'Close escapes',
      'Cinematic moments',
    ],
    samplePrompts: [
      'Find car crashes and police chases',
      'Find the funniest GTA 6 moments',
      'Find explosions and intense shootouts',
      'Find unexpected moments and close escapes',
    ],
    weights: { audio: 0.22, onset: 0.2, voice: 0.16, motion: 0.2, sceneCut: 0.1, flash: 0.12 },
    defaultCategories: ['Chase', 'Explosion', 'Action', 'Funny', 'Unexpected Moment'],
  },
  {
    id: 'fortnite',
    label: 'Fortnite',
    shortLabel: 'Fortnite',
    description: 'Build fights, Victory Royales, snipes & high-speed edits',
    momentFilters: [
      'Victory Royales',
      'Snipe shots',
      'Build battles',
      'Squad wipes',
      'Funny eliminations',
      'Clutch endgame',
    ],
    samplePrompts: [
      'Find the best kills and snipe shots',
      'Find clutch moments and Victory Royales',
      'Find funny reactions',
    ],
    weights: { audio: 0.2, onset: 0.22, voice: 0.18, motion: 0.22, sceneCut: 0.1, flash: 0.08 },
    defaultCategories: ['Combat', 'Clutch', 'Action', 'Reaction'],
  },
  {
    id: 'pubg',
    label: 'PUBG',
    shortLabel: 'PUBG',
    description: 'Chicken dinners, bridge ambushes, vehicle flips & sniper duels',
    momentFilters: [
      'Chicken dinners',
      'Long-range snipes',
      'Vehicle chaos',
      'Squad wipes',
      'Grenade kills',
      'Final circle clutches',
    ],
    samplePrompts: [
      'Find intense gunfights and squad wipes',
      'Find car crashes and grenade explosions',
      'Find final circle clutch moments',
    ],
    weights: { audio: 0.25, onset: 0.24, voice: 0.16, motion: 0.15, sceneCut: 0.1, flash: 0.1 },
    defaultCategories: ['Combat', 'Clutch', 'Explosion', 'Action'],
  },
  {
    id: 'cod',
    label: 'Call of Duty',
    shortLabel: 'COD',
    description: 'Multi-kills, Warzone clutches, killstreaks & explosive firefights',
    momentFilters: [
      'Multi-kills',
      'Warzone clutches',
      'Killstreaks',
      'Quickscopes',
      'Intense gunfights',
      'Hot mic reactions',
    ],
    samplePrompts: [
      'Find intense gunfights and multi-kills',
      'Find clutch moments and hot mic reactions',
      'Find explosive killstreak action',
    ],
    weights: { audio: 0.22, onset: 0.25, voice: 0.15, motion: 0.2, sceneCut: 0.08, flash: 0.1 },
    defaultCategories: ['Combat', 'Action', 'Explosion', 'Clutch'],
  },
  {
    id: 'minecraft',
    label: 'Minecraft',
    shortLabel: 'Minecraft',
    description: 'Creeper ambushes, MLG water clutches, PvP combos & funny fails',
    momentFilters: [
      'Creeper explosions',
      'MLG clutches',
      'PvP combos',
      'Funny fails',
      'Rare discoveries',
      'Boss fights',
    ],
    samplePrompts: [
      'Find unexpected moments and Creeper explosions',
      'Find funny reactions and fails',
      'Find MLG clutch moments',
    ],
    weights: { audio: 0.2, onset: 0.2, voice: 0.26, motion: 0.16, sceneCut: 0.1, flash: 0.08 },
    defaultCategories: ['Funny', 'Unexpected Moment', 'Clutch', 'Reaction'],
  },
  {
    id: 'valorant',
    label: 'Valorant',
    shortLabel: 'Valorant',
    description: 'Aces, 1vX clutches, flick headshots & ability combos',
    momentFilters: [
      'Aces',
      '1vX clutches',
      'Flick headshots',
      'Ultimate combos',
      'Team comms reactions',
      'Knife kills',
    ],
    samplePrompts: [
      'Find the best kills and flick shots',
      'Find clutch moments and aces',
      'Find funny team reactions',
    ],
    weights: { audio: 0.22, onset: 0.24, voice: 0.22, motion: 0.14, sceneCut: 0.08, flash: 0.1 },
    defaultCategories: ['Clutch', 'Combat', 'Reaction', 'High Energy'],
  },
  {
    id: 'cs',
    label: 'Counter-Strike',
    shortLabel: 'CS2',
    description: 'AWP flicks, eco clutches, wallbangs & intense bomb defuses',
    momentFilters: [
      'AWP flicks',
      '1vX clutches',
      'Ace rounds',
      'Ninja defuses',
      'Deagle headshots',
      'Crowd/voice hype',
    ],
    samplePrompts: [
      'Find clutch moments and ace rounds',
      'Find intense gunfights and AWP kills',
      'Find all exciting moments',
    ],
    weights: { audio: 0.24, onset: 0.25, voice: 0.2, motion: 0.14, sceneCut: 0.08, flash: 0.09 },
    defaultCategories: ['Clutch', 'Combat', 'High Energy', 'Reaction'],
  },
  {
    id: 'horror',
    label: 'Horror Games',
    shortLabel: 'Horror',
    description: 'Jumpscares, screaming reactions, tense chases & unexpected scares',
    momentFilters: [
      'Jumpscares',
      'Loud screams',
      'Monster chases',
      'Unexpected scares',
      'Funny panic moments',
      'Close escapes',
    ],
    samplePrompts: [
      'Find jumpscares and loud reactions',
      'Find funny panic moments',
      'Find intense monster chases',
    ],
    weights: { audio: 0.26, onset: 0.28, voice: 0.22, motion: 0.1, sceneCut: 0.06, flash: 0.08 },
    defaultCategories: ['Reaction', 'Unexpected Moment', 'Chase', 'Funny'],
  },
  {
    id: 'racing',
    label: 'Racing Games',
    shortLabel: 'Racing',
    description: 'Photo finishes, high-speed overtakes, drifts & dramatic crashes',
    momentFilters: [
      'High-speed crashes',
      'Last-lap overtakes',
      'Clean drifts',
      'Photo finishes',
      'Close calls',
      'Engine/audio roars',
    ],
    samplePrompts: [
      'Find dramatic crashes and close calls',
      'Find high-speed overtakes and drifts',
      'Find all exciting moments',
    ],
    weights: { audio: 0.2, onset: 0.2, voice: 0.12, motion: 0.28, sceneCut: 0.12, flash: 0.08 },
    defaultCategories: ['Chase', 'Action', 'Cinematic', 'Unexpected Moment'],
  },
  {
    id: 'other',
    label: 'Other Gaming Content',
    shortLabel: 'General',
    description: 'Balanced audio, motion, scene-cut & speech highlight detection',
    momentFilters: [
      'Boss fights',
      'High-energy moments',
      'Funny reactions',
      'Unexpected twists',
      'Cinematic sequences',
      'Big wins',
    ],
    samplePrompts: [
      'Find all exciting moments',
      'Find funny reactions and unexpected moments',
      'Find intense action sequences',
    ],
    weights: { audio: 0.22, onset: 0.2, voice: 0.18, motion: 0.2, sceneCut: 0.1, flash: 0.1 },
    defaultCategories: ['High Energy', 'Action', 'Reaction', 'Funny', 'Unexpected Moment'],
  },
];

export interface GamingClipPresetConfig {
  id: GamingClipPresetId;
  name: string;
  description: string;
  badge: string;
  layout: VerticalLayout;
  captionPreset: CaptionPresetId;
  introText: string;
  outroText: string;
  colorGrade: ClipColorGrade;
}

export const GAMING_CLIP_PRESETS: GamingClipPresetConfig[] = [
  {
    id: 'none',
    name: 'Custom / None',
    description: 'Manual settings without preset overrides',
    badge: 'Manual',
    layout: 'smart-crop',
    captionPreset: 'mrbeast',
    introText: '',
    outroText: '',
    colorGrade: { contrast: 1, saturation: 1, brightness: 0 },
  },
  {
    id: 'gta-cinematic',
    name: 'GTA-Style Cinematic',
    description: 'Rich contrast, blurred widescreen framing & bold cinematic subtitles',
    badge: 'GTA',
    layout: 'blurred-bg',
    captionPreset: 'cinematic',
    introText: 'WAIT FOR THIS...',
    outroText: 'FOLLOW FOR MORE',
    colorGrade: { contrast: 1.12, saturation: 1.18, brightness: 0.02 },
  },
  {
    id: 'funny-gameplay',
    name: 'Funny Gameplay',
    description: 'Punchy MrBeast captions, bright colors & quick hook opener',
    badge: 'Comedy',
    layout: 'smart-crop',
    captionPreset: 'mrbeast',
    introText: 'NO WAY THIS HAPPENED 😂',
    outroText: '',
    colorGrade: { contrast: 1.06, saturation: 1.15, brightness: 0.03 },
  },
  {
    id: 'kill-montage',
    name: 'Kill Montage',
    description: 'Tight center action crop, crisp neon captions & high-contrast punch',
    badge: 'FPS',
    layout: 'center-crop',
    captionPreset: 'gaming-neon',
    introText: 'INSANE PLAY 🔥',
    outroText: 'GG',
    colorGrade: { contrast: 1.16, saturation: 1.2, brightness: 0 },
  },
  {
    id: 'clutch-moment',
    name: 'Clutch Moment',
    description: 'Smart-tracked action framing with yellow keyword emphasis',
    badge: 'Clutch',
    layout: 'smart-crop',
    captionPreset: 'yellow-keywords',
    introText: '1vX CLUTCH',
    outroText: 'CLUTCHED IT',
    colorGrade: { contrast: 1.1, saturation: 1.1, brightness: 0 },
  },
  {
    id: 'horror-reaction',
    name: 'Horror Reaction',
    description: 'Stacked gameplay + facecam layout with high-contrast karaoke captions',
    badge: 'Horror',
    layout: 'stacked',
    captionPreset: 'karaoke',
    introText: 'VOLUME WARNING 🔊',
    outroText: '',
    colorGrade: { contrast: 1.15, saturation: 0.92, brightness: 0.04 },
  },
  {
    id: 'racing-action',
    name: 'Racing Action',
    description: 'Full-width gameplay visibility with clean minimal captions',
    badge: 'Racing',
    layout: 'full-gameplay',
    captionPreset: 'minimal-white',
    introText: 'FULL SEND 🏎️',
    outroText: '',
    colorGrade: { contrast: 1.12, saturation: 1.22, brightness: 0.01 },
  },
  {
    id: 'explosive-action',
    name: 'Explosive Action',
    description: 'High-impact saturated visuals, neon captions & smart vertical focus',
    badge: 'Action',
    layout: 'smart-crop',
    captionPreset: 'gaming-neon',
    introText: 'PURE CHAOS 💥',
    outroText: '',
    colorGrade: { contrast: 1.18, saturation: 1.28, brightness: 0.02 },
  },
];

export const EXCITING_SPEECH_PHRASES: { phrase: string; weight: number; category: HighlightCategory }[] = [
  { phrase: 'oh my god', weight: 1.0, category: 'Reaction' },
  { phrase: 'no way', weight: 0.95, category: 'Unexpected Moment' },
  { phrase: "let's go", weight: 0.95, category: 'Clutch' },
  { phrase: 'lets go', weight: 0.95, category: 'Clutch' },
  { phrase: 'what just happened', weight: 1.0, category: 'Unexpected Moment' },
  { phrase: 'are you serious', weight: 0.9, category: 'Reaction' },
  { phrase: 'are you kidding me', weight: 0.9, category: 'Reaction' },
  { phrase: 'holy', weight: 0.8, category: 'Reaction' },
  { phrase: 'insane', weight: 0.85, category: 'High Energy' },
  { phrase: 'clutch', weight: 0.95, category: 'Clutch' },
  { phrase: 'ace', weight: 0.85, category: 'Combat' },
  { phrase: 'headshot', weight: 0.85, category: 'Combat' },
  { phrase: 'exploded', weight: 0.85, category: 'Explosion' },
  { phrase: 'boom', weight: 0.75, category: 'Explosion' },
  { phrase: 'run', weight: 0.65, category: 'Chase' },
  { phrase: 'police', weight: 0.75, category: 'Chase' },
  { phrase: 'cops', weight: 0.75, category: 'Chase' },
  { phrase: 'crashed', weight: 0.8, category: 'Chase' },
  { phrase: 'wtf', weight: 0.9, category: 'Unexpected Moment' },
  { phrase: 'what the', weight: 0.85, category: 'Unexpected Moment' },
  { phrase: 'bro', weight: 0.45, category: 'Funny' },
  { phrase: 'haha', weight: 0.75, category: 'Funny' },
  { phrase: 'lmao', weight: 0.8, category: 'Funny' },
  { phrase: 'watch this', weight: 0.8, category: 'Action' },
  { phrase: 'clip that', weight: 1.0, category: 'High Energy' },
  { phrase: 'clipped', weight: 0.9, category: 'High Energy' },
  { phrase: 'one hp', weight: 0.9, category: 'Clutch' },
  { phrase: 'eliminated', weight: 0.75, category: 'Combat' },
  { phrase: 'killed', weight: 0.7, category: 'Combat' },
  { phrase: 'scared', weight: 0.85, category: 'Reaction' },
];

export const CLIP_DURATION_PRESETS = [
  { seconds: 15, label: '15s' },
  { seconds: 30, label: '30s' },
  { seconds: 45, label: '45s' },
  { seconds: 60, label: '60s' },
  { seconds: 90, label: '90s' },
  { seconds: 120, label: '2 min' },
  { seconds: 180, label: '3 min' },
];

export function getGameConfig(id: GameCategory): GameCategoryConfig {
  return GAME_CATEGORIES.find((g) => g.id === id) ?? GAME_CATEGORIES[GAME_CATEGORIES.length - 1];
}
