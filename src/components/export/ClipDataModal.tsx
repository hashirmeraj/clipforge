import React, { useEffect, useState } from 'react';
import {
  X,
  Copy,
  Check,
  RefreshCw,
  Hash,
  Tag,
  FileText,
  Sparkles,
  Plus,
  Download,
  TrendingUp,
} from 'lucide-react';
import type { Clip, ClipPublishingMetadata, Highlight, ProjectData } from '../../types';
import { generateClipPublishingMetadata } from '../../services/metadataGeneratorService';
import { sanitizeFilename } from '../../utils/format';

interface ClipDataModalProps {
  clip: Clip;
  project: ProjectData;
  highlight?: Highlight;
  onSaveMetadata: (meta: ClipPublishingMetadata) => void;
  onClose: () => void;
}

export const ClipDataModal: React.FC<ClipDataModalProps> = ({
  clip,
  project,
  highlight,
  onSaveMetadata,
  onClose,
}) => {
  const [variantSeed, setVariantSeed] = useState(0);
  const [meta, setMeta] = useState<ClipPublishingMetadata>(
    () =>
      clip.publishingMeta ??
      generateClipPublishingMetadata({ clip, project, highlight, variantSeed: 0 })
  );
  const [newHashtag, setNewHashtag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Persist initial auto-generated metadata cleanly onto the clip
  useEffect(() => {
    if (!clip.publishingMeta) {
      onSaveMetadata(meta);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMeta = (next: ClipPublishingMetadata) => {
    setMeta(next);
    onSaveMetadata(next);
  };

  const handleRegenerate = () => {
    const nextSeed = variantSeed + 1;
    setVariantSeed(nextSeed);
    const fresh = generateClipPublishingMetadata({
      clip,
      project,
      highlight,
      variantSeed: nextSeed,
    });
    updateMeta(fresh);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1800);
    } catch {
      // Fallback textarea copy
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1800);
    }
  };

  const addHashtag = () => {
    const clean = newHashtag.trim().replace(/^#+/, '').replace(/\s+/g, '');
    if (!clean) return;
    const formatted = `#${clean}`;
    if (!meta.hashtags.includes(formatted)) {
      updateMeta({ ...meta, hashtags: [...meta.hashtags, formatted] });
    }
    setNewHashtag('');
  };

  const removeHashtag = (tag: string) => {
    updateMeta({ ...meta, hashtags: meta.hashtags.filter((t) => t !== tag) });
  };

  const addKeyword = () => {
    const clean = newKeyword.trim().toLowerCase();
    if (!clean) return;
    if (!meta.keywords.includes(clean)) {
      updateMeta({ ...meta, keywords: [...meta.keywords, clean] });
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    updateMeta({ ...meta, keywords: meta.keywords.filter((k) => k !== kw) });
  };

  const fullPackText = [
    `TITLE:\n${meta.title}`,
    `\nDESCRIPTION:\n${meta.description}`,
    `\nHASHTAGS:\n${meta.hashtags.join(' ')}`,
    `\nKEYWORDS / TAGS:\n${meta.keywords.join(', ')}`,
  ].join('\n');

  const handleDownloadTxt = () => {
    const blob = new Blob([fullPackText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(clip.title)}_metadata.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const keywordCharCount = meta.keywords.join(', ').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="studio-panel-elevated flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#10131b] px-5 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-300">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-white">
                Video Data — Title, Description, Hashtags &amp; Keywords
              </h2>
              <p className="truncate text-[11px] text-zinc-400">
                Tailored for <span className="text-zinc-200">{clip.title}</span> ({clip.aspectRatio})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.1]"
              title="Generate fresh trending hook & metadata variation"
            >
              <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Close video data modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          {/* Trend & Signal Context Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {meta.trendNotes.map((note, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200"
              >
                <Sparkles className="h-3 w-3 shrink-0 text-sky-400" />
                {note}
              </span>
            ))}
          </div>

          {/* 1. Video Title */}
          <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0d1017] p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <FileText className="h-3.5 w-3.5 text-violet-400" />
                Video Title
                <span
                  className={`ml-1 font-mono text-[10px] ${
                    meta.title.length > 100 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  ({meta.title.length}/100)
                </span>
              </label>
              <button
                type="button"
                onClick={() => copyText('title', meta.title)}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                {copiedKey === 'title' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Title
                  </>
                )}
              </button>
            </div>

            <input
              type="text"
              value={meta.title}
              onChange={(e) => updateMeta({ ...meta, title: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#12151e] px-3 py-2 text-sm font-semibold text-white focus:border-violet-500 focus:outline-none"
            />

            {meta.alternativeTitles.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Trending Hook Alternatives (click to use)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {meta.alternativeTitles.map((alt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        updateMeta({
                          ...meta,
                          title: alt,
                          alternativeTitles: [
                            meta.title,
                            ...meta.alternativeTitles.filter((t) => t !== alt),
                          ],
                        })
                      }
                      className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-left text-[11px] text-zinc-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white"
                    >
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Video Description */}
          <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0d1017] p-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <FileText className="h-3.5 w-3.5 text-sky-400" />
                Video Description
              </label>
              <button
                type="button"
                onClick={() => copyText('desc', meta.description)}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                {copiedKey === 'desc' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Description
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={5}
              value={meta.description}
              onChange={(e) => updateMeta({ ...meta, description: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#12151e] p-3 text-xs leading-relaxed text-zinc-100 focus:border-violet-500 focus:outline-none"
            />
          </div>

          {/* 3. Trending Hashtags */}
          <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#0d1017] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Hash className="h-3.5 w-3.5 text-violet-400" />
                Trending Hashtags ({meta.hashtags.length})
              </div>
              <button
                type="button"
                onClick={() => copyText('hashtags', meta.hashtags.join(' '))}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                {copiedKey === 'hashtags' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Hashtags
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {meta.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-1 font-medium text-violet-200"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeHashtag(tag)}
                    className="ml-0.5 text-violet-300/70 hover:text-white"
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHashtag()}
                placeholder="Add custom hashtag (e.g. GTA6Hype)"
                className="flex-1 rounded-lg border border-white/10 bg-[#12151e] px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addHashtag}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          {/* 4. SEO Keywords / Tags */}
          <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-[#0d1017] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Tag className="h-3.5 w-3.5 text-emerald-400" />
                SEO Keywords &amp; Tags ({meta.keywords.length})
                <span
                  className={`ml-1 font-mono text-[10px] ${
                    keywordCharCount > 500 ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                >
                  ({keywordCharCount}/500 chars)
                </span>
              </div>
              <button
                type="button"
                onClick={() => copyText('keywords', meta.keywords.join(', '))}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                {copiedKey === 'keywords' ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy Keywords
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {meta.keywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-zinc-200"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="ml-0.5 text-zinc-500 hover:text-white"
                    aria-label={`Remove ${kw}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="Add custom keyword (e.g. gta 5 spiderman mod)"
                className="flex-1 rounded-lg border border-white/10 bg-[#12151e] px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="inline-flex items-center gap-1 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.12]"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-[#10131b] px-5 py-3">
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.1]"
          >
            <Download className="h-3.5 w-3.5 text-sky-400" />
            Download .TXT Metadata
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyText('all', fullPackText)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              {copiedKey === 'all' ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copied Full Pack!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy All (Title + Desc + Tags)
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-white/[0.1]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
