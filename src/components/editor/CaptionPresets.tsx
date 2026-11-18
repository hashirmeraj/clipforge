import React from 'react';
import { CAPTION_PRESETS } from '../../constants/captions';
import type { CaptionPresetId, CaptionStyle } from '../../types';

interface CaptionPresetsProps {
  activePresetId: CaptionPresetId;
  onSelectPreset: (style: CaptionStyle) => void;
}

export const CaptionPresets: React.FC<CaptionPresetsProps> = ({
  activePresetId,
  onSelectPreset,
}) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CAPTION_PRESETS.map((preset) => {
        const active = preset.id === activePresetId;
        const st = preset.style;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset({ ...st })}
            className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition ${
              active
                ? 'border-violet-500 bg-violet-500/15'
                : 'border-white/[0.08] bg-[#0d1017] hover:border-white/20'
            }`}
          >
            <div className="flex w-full items-center justify-center rounded-md bg-black/80 px-2 py-2.5">
              <span
                style={{
                  fontFamily: st.fontFamily,
                  color: st.presetId === 'karaoke' || st.presetId === 'yellow-keywords' ? st.highlightColor : st.textColor,
                  fontWeight: st.bold ? 900 : 500,
                  fontStyle: st.italic ? 'italic' : 'normal',
                  textTransform: st.uppercase ? 'uppercase' : 'none',
                  textShadow: st.shadow ? '0 2px 6px rgba(0,0,0,0.95)' : 'none',
                  WebkitTextStroke: st.outlineThickness > 3 ? `1px ${st.outlineColor}` : undefined,
                }}
                className="truncate text-xs tracking-tight"
              >
                {preset.previewText}
              </span>
            </div>
            <div className="mt-2 text-xs font-semibold text-zinc-100">{preset.name}</div>
            <div className="mt-0.5 line-clamp-1 text-[10px] text-zinc-500">{preset.description}</div>
          </button>
        );
      })}
    </div>
  );
};
