import type {
  Clip,
  ClipPublishingMetadata,
  GameCategory,
  Highlight,
  HighlightCategory,
  ProjectData,
} from '../types';
import { getGameConfig } from '../constants/gaming';
import { formatTime } from '../utils/format';

interface GameTrendPack {
  hashtags: string[];
  keywords: string[];
  trendAngle: string;
}

const GAME_TREND_PACKS: Record<GameCategory, GameTrendPack> = {
  gta: {
    hashtags: ['#GTA5', '#GTA6', '#GTARP', '#GTAOnline', '#GTAClips', '#LosSantos'],
    keywords: [
      'gta 5 funny moments',
      'gta 6 hype',
      'gta 5 shorts',
      'gta rp clips',
      'gta police chase',
      'gta 5 chaos',
      'gta viral clip',
    ],
    trendAngle: 'GTA 5 / GTA 6 chaos & RP Shorts trend',
  },
  fortnite: {
    hashtags: ['#Fortnite', '#FortniteShorts', '#FortniteClips', '#VictoryRoyale', '#FortniteBR'],
    keywords: [
      'fortnite shorts',
      'fortnite highlights',
      'fortnite funny moments',
      'fortnite clutch',
      'fortnite new update',
      'fortnite viral clip',
    ],
    trendAngle: 'Fortnite Chapter clips & creator reaction trend',
  },
  pubg: {
    hashtags: ['#PUBG', '#PUBGMobile', '#BGMI', '#PUBGClips', '#WinnerWinnerChickenDinner'],
    keywords: [
      'pubg shorts',
      'pubg clutch',
      'pubg squad wipe',
      'pubg funny moments',
      'pubg sniper highlights',
    ],
    trendAngle: 'PUBG / BGMI squad-wipe & sniper Shorts trend',
  },
  cod: {
    hashtags: ['#CallOfDuty', '#Warzone', '#CODClips', '#BlackOps', '#WarzoneClips'],
    keywords: [
      'call of duty warzone clips',
      'cod shorts',
      'warzone clutch',
      'cod multi kill',
      'warzone hot mic',
      'call of duty highlights',
    ],
    trendAngle: 'Warzone / Call of Duty high-tempo killfeed trend',
  },
  minecraft: {
    hashtags: ['#Minecraft', '#MinecraftShorts', '#MinecraftMemes', '#MinecraftClutch', '#MCYT'],
    keywords: [
      'minecraft shorts',
      'minecraft clutch',
      'minecraft funny moments',
      'minecraft survival',
      'minecraft viral clip',
    ],
    trendAngle: 'Minecraft rapid-hook Shorts & clutch trend',
  },
  valorant: {
    hashtags: ['#Valorant', '#ValorantClips', '#ValorantShorts', '#ValorantClutch', '#VCT'],
    keywords: [
      'valorant shorts',
      'valorant ace',
      'valorant 1v5 clutch',
      'valorant ranked clips',
      'valorant highlights',
    ],
    trendAngle: 'Valorant ranked clutch & flick-shot Shorts trend',
  },
  cs: {
    hashtags: ['#CS2', '#CounterStrike', '#CS2Clips', '#CSGO', '#AWP'],
    keywords: [
      'cs2 clips',
      'counter strike 2 shorts',
      'cs2 clutch',
      'cs2 awp highlights',
      'cs2 funny moments',
    ],
    trendAngle: 'CS2 precision clutch & highlight Shorts trend',
  },
  horror: {
    hashtags: ['#HorrorGaming', '#Jumpscare', '#HorrorShorts', '#ScaryGames', '#StreamerReaction'],
    keywords: [
      'horror game jumpscare',
      'scary game reaction',
      'funny horror clips',
      'streamer scream',
      'indie horror shorts',
    ],
    trendAngle: 'Indie horror jumpscare & reaction Shorts trend',
  },
  racing: {
    hashtags: ['#RacingGames', '#SimRacing', '#Forza', '#Drift', '#RacingClips'],
    keywords: [
      'racing game highlights',
      'sim racing overtake',
      'drift clips shorts',
      'racing game crash',
      'forza horizon clips',
    ],
    trendAngle: 'High-speed overtake & close-call racing trend',
  },
  other: {
    hashtags: ['#Gaming', '#GamingShorts', '#GamingClips', '#Gameplay', '#StreamerClips'],
    keywords: [
      'gaming shorts',
      'best gaming clips',
      'funny gaming moments',
      'viral gameplay',
      'streamer highlights',
    ],
    trendAngle: 'Viral short-form gaming highlights trend',
  },
};

const CATEGORY_TAGS: Record<HighlightCategory, { hashtags: string[]; keywords: string[]; hookWord: string }> = {
  Action: {
    hashtags: ['#ActionGaming', '#InsanePlay', '#EpicMoment'],
    keywords: ['insane gaming action', 'epic gameplay moment', 'fast paced gaming clip'],
    hookWord: 'INSANE ACTION',
  },
  Combat: {
    hashtags: ['#FPSClips', '#SquadWipe', '#Headshot'],
    keywords: ['intense gunfight', 'best kills montage', 'fps combat clip'],
    hookWord: 'UNREAL FIGHT',
  },
  Clutch: {
    hashtags: ['#Clutch', '#1vX', '#ClutchMoment'],
    keywords: ['insane clutch play', 'how did he survive', 'last second clutch'],
    hookWord: 'UNBELIEVABLE CLUTCH',
  },
  Explosion: {
    hashtags: ['#PureChaos', '#Explosive', '#GamingChaos'],
    keywords: ['explosive gaming chaos', 'unexpected explosion', 'craziest chaos clip'],
    hookWord: 'PURE CHAOS',
  },
  Reaction: {
    hashtags: ['#GamingReaction', '#StreamerMoments', '#NoWay'],
    keywords: ['loudest gaming reaction', 'streamer reaction clip', 'unexpected reaction'],
    hookWord: 'WAIT FOR THE REACTION',
  },
  Funny: {
    hashtags: ['#FunnyGaming', '#GamingFails', '#GamingHumor'],
    keywords: ['funniest gaming moment', 'try not to laugh gaming', 'hilarious gameplay clip'],
    hookWord: 'FUNNIEST MOMENT',
  },
  'Unexpected Moment': {
    hashtags: ['#PlotTwist', '#WaitForIt', '#Unexpected'],
    keywords: ['wait for the ending', 'unexpected gaming twist', 'nobody saw this coming'],
    hookWord: 'WAIT FOR THE ENDING',
  },
  Chase: {
    hashtags: ['#PoliceChase', '#CloseCall', '#HighSpeed'],
    keywords: ['craziest chase escape', 'high speed chase clip', 'close call gaming'],
    hookWord: 'CRAZIEST CHASE',
  },
  Cinematic: {
    hashtags: ['#CinematicGaming', '#NextGenGaming', '#GamingEdits'],
    keywords: ['cinematic gameplay clip', 'gaming edit shorts', 'movie like gaming moment'],
    hookWord: 'MOVIE-LEVEL MOMENT',
  },
  'High Energy': {
    hashtags: ['#PeakGaming', '#HypeMoment', '#ViralClip'],
    keywords: ['peak gaming hype', 'exciting gameplay clip', 'viral gaming moment'],
    hookWord: 'PEAK HYPE',
  },
};

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'just', 'like', 'your', 'you',
  'are', 'was', 'were', 'been', 'will', 'what', 'when', 'where', 'they', 'them', 'their',
  'there', 'here', 'about', 'into', 'over', 'then', 'than', 'only', 'also', 'very', 'more',
  'some', 'such', 'could', 'would', 'should', 'going', 'gonna', 'yeah', 'okay', 'well',
  'right', 'look', 'guys', 'literally', 'really', 'actually', 'doing', 'being', 'clip',
  'video', 'rapid', 'action', 'sequence', 'moment', 'moments', 'gameplay', 'captioned',
  'videoplayback', 'highlights',
]);

function extractMeaningfulTerms(text: string, limit = 8): string[] {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  for (const w of words) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function toHashtag(phrase: string): string {
  const cleaned = phrase
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');
  return cleaned ? `#${cleaned}` : '';
}

function pickBestTranscriptQuote(clip: Clip): string | null {
  if (!clip.captions || clip.captions.length === 0) return null;
  const scored = clip.captions
    .map((seg) => {
      const txt = seg.text.trim();
      let score = txt.length >= 10 && txt.length <= 68 ? 10 : 2;
      if (/[!?]/.test(txt)) score += 6;
      if (/god|way|insane|crazy|stars|clutch|win|die|boom|fire|epic|lol/i.test(txt)) score += 8;
      return { txt, score };
    })
    .filter((s) => s.txt.length >= 6)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.txt ?? null;
}

/**
 * Generates platform-ready title, alternative hooks, description, hashtags, and SEO keywords
 * tailored to the actual video clip, transcript, analysis signals, game category, and current
 * short-form gaming trends. Runs 100% locally in the browser.
 */
export function generateClipPublishingMetadata(params: {
  clip: Clip;
  project: ProjectData;
  highlight?: Highlight;
  variantSeed?: number;
}): ClipPublishingMetadata {
  const { clip, project, highlight, variantSeed = 0 } = params;
  const gameCfg = getGameConfig(project.gameCategory);
  const trendPack = GAME_TREND_PACKS[project.gameCategory] ?? GAME_TREND_PACKS.other;
  const catPack = CATEGORY_TAGS[clip.category] ?? CATEGORY_TAGS['High Energy'];

  const isVertical = clip.aspectRatio === '9:16';
  const durationSec = Math.max(1, Math.round(clip.end - clip.start));
  const transcriptText = clip.captions.map((c) => c.text).join(' ').trim();
  const bestQuote = pickBestTranscriptQuote(clip);

  // Extract real keywords from transcript + project name + clip title + custom prompt
  const sourceText = [
    transcriptText,
    project.name,
    clip.title.replace(/^VP\d+\s+Clip\s+\d+\s*-?\s*/i, ''),
    project.customInstructions,
    project.momentFilters.join(' '),
  ].join(' ');
  const extractedTerms = extractMeaningfulTerms(sourceText, 8);

  const cleanProjectTopic = project.name
    .replace(/videoplayback\s*\(?\d*\)?/gi, '')
    .replace(/highlights?/gi, '')
    .trim();

  const gameShort = gameCfg.shortLabel === 'General' ? 'Gaming' : gameCfg.shortLabel;
  const topicLabel = cleanProjectTopic
    ? cleanProjectTopic.slice(0, 38)
    : `${gameShort} ${clip.category}`;

  const shortQuoteSnippet = bestQuote
    ? bestQuote.replace(/["“”]/g, '').replace(/[.!?]+$/, '').slice(0, 44)
    : null;

  // Build 4 distinct title hooks based on real video data + trending Shorts formulas
  const candidateTitles = [
    shortQuoteSnippet
      ? `"${shortQuoteSnippet}!" — ${gameShort} ${catPack.hookWord} 🔥`
      : `${catPack.hookWord} in ${gameShort}! You Won't Believe This Clip 🔥`,
    `${topicLabel}: ${catPack.hookWord} (${durationSec}s ${isVertical ? '#Shorts' : 'Highlight'})`,
    `Wait For This ${gameShort} ${clip.category} Moment... 😱`,
    `${gameShort} ${clip.category} Gone Wild! (${clip.score}/100 Peak Moment) 💥`,
  ].map((t) => t.slice(0, 98));

  const primaryIdx = Math.abs(variantSeed) % candidateTitles.length;
  const title = candidateTitles[primaryIdx];
  const alternativeTitles = candidateTitles.filter((_, i) => i !== primaryIdx);

  // Build Hashtags (Format trends + Game trends + Category trends + Video-specific extracted terms)
  const formatHashtags = isVertical
    ? ['#Shorts', '#YouTubeShorts', '#GamingShorts', '#ViralGaming', '#TikTokGaming', '#Reels']
    : ['#Gaming', '#Gameplay', '#GamingHighlights', '#ViralGaming'];

  const dynamicTermTags = extractedTerms
    .slice(0, 4)
    .map((t) => toHashtag(t))
    .filter((tag) => tag.length >= 4 && tag.length <= 24);

  const hashtags = Array.from(
    new Set([
      ...trendPack.hashtags.slice(0, 4),
      ...catPack.hashtags.slice(0, 2),
      ...formatHashtags.slice(0, 4),
      ...dynamicTermTags,
    ])
  ).slice(0, 14);

  // Build SEO Keywords (YouTube Studio Tags)
  const dynamicKeywords = extractedTerms.slice(0, 5).map((t) => `${gameShort.toLowerCase()} ${t}`);
  const formatKeywords = isVertical
    ? ['youtube shorts gaming', 'gaming tiktok', 'gaming reels', 'viral shorts 2026']
    : ['gaming highlights', 'best gameplay moments', 'gaming clips 2026'];

  const keywords = Array.from(
    new Set([
      gameCfg.label.toLowerCase(),
      `${gameShort.toLowerCase()} ${clip.category.toLowerCase()}`,
      ...trendPack.keywords,
      ...catPack.keywords,
      ...dynamicKeywords,
      ...formatKeywords,
    ])
  ).slice(0, 18);

  // Build ready-to-paste Description
  const descLines: string[] = [];
  if (bestQuote) {
    descLines.push(`"${bestQuote}" — Peak ${gameShort} ${clip.category.toLowerCase()} moment!`);
  } else {
    descLines.push(`One of the craziest ${clip.category.toLowerCase()} moments from ${topicLabel}!`);
  }

  if (highlight?.reason) {
    descLines.push(
      `Highlight captured at ${formatTime(clip.start)}–${formatTime(clip.end)} (${durationSec}s) — ${highlight.reason}`
    );
  } else {
    descLines.push(`Clipped from ${formatTime(clip.start)}–${formatTime(clip.end)} (${durationSec}s).`);
  }

  descLines.push('');
  descLines.push(
    isVertical
      ? 'Drop a LIKE & SUBSCRIBE for daily gaming Shorts and insane clips! 🔥'
      : 'Like, comment your favorite part, and subscribe for more gaming highlights! 🔥'
  );
  descLines.push('');
  descLines.push(hashtags.slice(0, 8).join(' '));

  const trendNotes: string[] = [
    trendPack.trendAngle,
    isVertical ? 'Optimized for YouTube Shorts, TikTok & Instagram Reels (9:16)' : `Optimized for ${clip.aspectRatio} video feed`,
  ];

  if (clip.captions.length > 0) {
    trendNotes.push(`Extracted spoken topics from ${clip.captions.length} caption segments`);
  } else {
    trendNotes.push('Tip: Run Local Whisper in Clip Editor to include exact spoken quotes in metadata');
  }
  if (highlight) {
    trendNotes.push(`Scored ${highlight.score}/100 (${highlight.category} signals)`);
  }

  return {
    title,
    alternativeTitles,
    description: descLines.join('\n'),
    hashtags,
    keywords,
    trendNotes,
    generatedAt: new Date().toISOString(),
  };
}
