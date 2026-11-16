import React from 'react';
import {
  AccentColor,
  getAccentAtmosphere,
  IllustrationPackId,
} from '../../utils/themeTokens';
import type { IllustrationPalette, ThemeIllustrationPack } from './illustrations/types';
import { botanicalPack } from './illustrations/botanical';
import { kyotoPack } from './illustrations/kyoto';
import { cafePack } from './illustrations/cafe';
import { nekoPack } from './illustrations/neko';
import { celestialPack } from './illustrations/celestial';
import { cloudscapePack } from './illustrations/cloudscape';
import { libraryPack } from './illustrations/library';

interface IllustrationProps {
  accentColor: AccentColor;
  isDark?: boolean;
}

interface DeckEmblemProps extends IllustrationProps {
  deckAccent: string;
}

const ILLUSTRATION_PACKS: Record<Exclude<IllustrationPackId, 'none'>, ThemeIllustrationPack> = {
  botanical: botanicalPack,
  kyoto: kyotoPack,
  cafe: cafePack,
  neko: nekoPack,
  celestial: celestialPack,
  cloudscape: cloudscapePack,
  library: libraryPack,
};

function getPalette(isDark: boolean): IllustrationPalette {
  return isDark
    ? {
        ink: '#D5D8E4',
        soft: 'rgba(255, 255, 255, 0.10)',
        warm: 'rgba(255, 255, 255, 0.06)',
        paper: '#242734',
        brand: 'var(--brand)',
        brandSoft: 'var(--brand-soft)',
        gold: '#F2B866',
        rose: '#EF8BA3',
        leaf: '#6AD29D',
      }
    : {
        ink: '#353944',
        soft: 'rgba(30, 36, 48, 0.08)',
        warm: '#F3EEE4',
        paper: '#FCFBF7',
        brand: 'var(--brand)',
        brandSoft: 'var(--brand-soft)',
        gold: '#C57F2D',
        rose: '#CC5875',
        leaf: '#2F9461',
      };
}

export function resolveIllustrationPack(accentColor: AccentColor): IllustrationPackId {
  return getAccentAtmosphere(accentColor).pack;
}

export function hasIllustrationPack(accentColor: AccentColor): boolean {
  return resolveIllustrationPack(accentColor) !== 'none';
}

/**
 * 位点 A · 首页问候右侧微景插画（完全避开 Hero 区域连胜火苗）。
 * 经典蓝默认主题返回 null，保持极简零装饰。
 */
export const GreetingVignette: React.FC<IllustrationProps> = ({ accentColor, isDark = false }) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;
  const p = getPalette(isDark);

  return (
    <span
      className="hidden md:inline-flex items-center justify-center shrink-0 pointer-events-none select-none w-[112px] h-[44px] opacity-95"
      aria-hidden="true"
    >
      {ILLUSTRATION_PACKS[pack].greeting(p)}
    </span>
  );
};

/**
 * 位点 B · 牌组藏书票微章（按 `deck.accent` 的 6 个形态槽位呈现）。
 * 当选中主题为经典蓝默认（pack === 'none'）时返回 null，交由原生极简线条图标渲染。
 */
export const ThemedDeckEmblem: React.FC<DeckEmblemProps> = ({
  accentColor,
  deckAccent,
  isDark = false,
}) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;

  const slot: 'book' | 'code' | 'heart' | 'folder' | 'sparkles' | 'layers' =
    deckAccent === 'blue'
      ? 'code'
      : deckAccent === 'emerald'
      ? 'heart'
      : deckAccent === 'amber'
      ? 'folder'
      : deckAccent === 'rose'
      ? 'sparkles'
      : deckAccent === 'purple'
      ? 'layers'
      : 'book';

  const ink = 'currentColor';
  const washAlpha = isDark ? 0.22 : 0.16;

  return (
    <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {pack === 'botanical' && (
        <>
          {slot === 'book' && (
            <>
              <rect x="4" y="4" width="16" height="16" rx="3" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M12 16c0-5 2.5-8.5 5-9.5M12 14c-2.5-.8-4-2.8-3.8-5.2 2.2.2 3.8 1.6 3.8 5.2z" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {slot === 'code' && (
            <>
              <rect x="4" y="5" width="16" height="14" rx="3.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M10 9l-3 3 3 3M14 9l3 3-3 3" stroke={ink} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M6 17c0-7.5 6-12 12-12 0 7-4.5 12-12 12z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
              <path d="M6 17c2.8-3 6-6.2 9.5-9.2M5 18.5L7.5 16" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M12 15c0-2.8 1.8-4.5 3.6-4.8" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M12 4c2.2 4 5 6.8 8 8-3 1.2-5.8 4-8 8-2.2-4-5-6.8-8-8 3-1.2 5.8-4 8-8z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="18" cy="6" r="1.4" fill={ink} />
            </>
          )}
          {slot === 'layers' && (
            <>
              <path d="M7 10h10v6a5 5 0 0 1-10 0v-6z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M17 11.5h1.5a2 2 0 0 1 0 4H17M9.5 6.5c0-1.3 1-1.8.8-2.8M13.5 6.5c0-1.3 1-1.8.8-2.8" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </>
      )}

      {pack === 'kyoto' && (
        /* Washi & Matcha: stitch-bound books, inkstone/brush, chawan cup, envelope, ginkgo, two-tier box (ZERO red cross) */
        <>
          {slot === 'book' && (
            <>
              <rect x="5" y="4" width="14" height="16" rx="2.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M8.5 4v16M5.5 8.5h2.5M5.5 15.5h2.5" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
            </>
          )}
          {slot === 'code' && (
            <>
              <ellipse cx="12" cy="14" rx="7" ry="4.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M7 5l8 7M14.5 11.5l2 2" stroke={ink} strokeWidth="1.7" strokeLinecap="round" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M5 11h14v3.5a6.5 6.5 0 0 1-13 0V11z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M8 20h8M10 7.5c0-1.4 1.5-2 1-3.2M14 7.5c0-1.4 1.5-2 1-3.2" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <rect x="4" y="6" width="16" height="12" rx="2.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M4.5 7l7.5 5.5L19.5 7" stroke={ink} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M12 18V12M12 12C7 11 5.5 7 8 5c2.2 1.2 3.4 1.8 4 1.8S13.8 6.2 16 5c2.5 2 1 6-4 7z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <rect x="5" y="7" width="14" height="5" rx="1.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <rect x="5" y="13.5" width="14" height="5" rx="1.5" fill={ink} fillOpacity={washAlpha * 0.7} stroke={ink} strokeWidth="1.6" />
              <path d="M9.5 7l2.5-2.5L14.5 7" stroke={ink} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </>
      )}

      {pack === 'cafe' && (
        <>
          {slot === 'book' && (
            <>
              <path d="M5 10h11v5a5.5 5.5 0 0 1-11 0v-5z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M16 11h1.8a2 2 0 0 1 0 4H16M8.5 6.5c0-1.2 1.2-1.8.8-2.8M12 6.5c0-1.2 1.2-1.8.8-2.8" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'code' && (
            <>
              <path d="M6 17h12l-1.5-8h-9L6 17z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 9c1-2.5 5-2.5 6 0M16 11h3v2.5" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M5 15c1-4.8 4.8-7.5 7-7.5s6 2.7 7 7.5c0 2-1.5 3-3.2 2.2-1.2-.6-2.4-.9-3.8-.9s-2.6.3-3.8.9C6.5 18 5 17 5 15z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M10 8.5l-.6 6M14 8.5l.6 6" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <rect x="4" y="6" width="16" height="13" rx="2.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M8 10h8M8 14h5" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M7 12h10l-1.5-6h-7L7 12z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
              <path d="M12 12v6M9 18h6" stroke={ink} strokeWidth="1.65" strokeLinecap="round" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <path d="M4 15.5h16M7 10a5 5 0 0 1 10 0v3.5H7V10z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
            </>
          )}
        </>
      )}

      {pack === 'neko' && (
        <>
          {slot === 'book' && (
            <>
              <path d="M6 10l-1-5 4 3h6l4-3-1 5v4a6 6 0 0 1-12 0v-4z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
              <circle cx="9.8" cy="13" r="1" fill={ink} />
              <circle cx="14.2" cy="13" r="1" fill={ink} />
            </>
          )}
          {slot === 'code' && (
            <>
              <ellipse cx="12" cy="14.5" rx="4.2" ry="3.2" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <circle cx="7.5" cy="9.5" r="1.45" fill={ink} />
              <circle cx="10.5" cy="7.5" r="1.45" fill={ink} />
              <circle cx="13.8" cy="7.5" r="1.45" fill={ink} />
              <circle cx="16.5" cy="9.5" r="1.45" fill={ink} />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M5 12c2.5-3.8 7.8-4 11 0 1.4-1.5 2.5-2.2 3.2-2.2v4.4c-.7 0-1.8-.7-3.2-2.2-3.2 4-8.5 3.8-11 0z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <circle cx="12" cy="12" r="7" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <path d="M7.5 9.5c3 1.5 6.5 1.5 9 0M7 14c3.2-1.5 6.8-1.5 10 0" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M7 9l2-3 3 2 3-2 2 3v6a5 5 0 0 1-10 0V9z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M11 13.5l1 1 1-1" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <rect x="4.5" y="13" width="15" height="4.5" rx="1.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <rect x="6" y="7.5" width="12" height="4.5" rx="1.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
            </>
          )}
        </>
      )}

      {pack === 'celestial' && (
        <>
          {slot === 'book' && (
            <>
              <path d="M13.5 5a7 7 0 1 0 5.5 11.2 5.8 5.8 0 0 1-5.5-11.2z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
              <circle cx="17" cy="7.5" r="1.2" fill={ink} />
            </>
          )}
          {slot === 'code' && (
            <>
              <circle cx="12" cy="12" r="5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <ellipse cx="12" cy="12" rx="9" ry="3.2" transform="rotate(-24 12 12)" stroke={ink} strokeWidth="1.45" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M12 4.5l1.9 5.1L19 11.5l-5.1 1.9L12 18.5l-1.9-5.1L5 11.5l5.1-1.9z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <circle cx="6.5" cy="15.5" r="1.7" fill={ink} />
              <circle cx="11.5" cy="9.5" r="1.7" fill={ink} />
              <circle cx="17.5" cy="12.5" r="1.7" fill={ink} />
              <path d="M6.5 15.5L11.5 9.5L17.5 12.5" stroke={ink} strokeWidth="1.5" strokeDasharray="2 2" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M12 5v14M7 10l10 0M8.5 7l7 10" stroke={ink} strokeWidth="1.55" strokeLinecap="round" />
              <circle cx="12" cy="10" r="2.2" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.4" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <path d="M4.5 7.5C7 7 9.8 7.5 12 9c2.2-1.5 5-2 7.5-1.5v10C17 17 14.2 17.5 12 19c-2.2-1.5-5-2-7.5-1.5v-10z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 9v10" stroke={ink} strokeWidth="1.4" />
            </>
          )}
        </>
      )}

      {pack === 'cloudscape' && (
        <>
          {slot === 'book' && (
            <path d="M7 16.5h10a3.5 3.5 0 0 0 .5-6.9 5 5 0 0 0-9.4-1.3A3.8 3.8 0 0 0 7 16.5z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" strokeLinejoin="round" />
          )}
          {slot === 'code' && (
            <>
              <path d="M4.5 12l15-6-5.5 13-2.5-4.5L4.5 12z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M19.5 6l-8 8.5" stroke={ink} strokeWidth="1.4" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M12 5a5.2 5.2 0 0 1 5.2 5.2c0 2.5-2.1 4.8-3.4 5.8h-3.6c-1.3-1-3.4-3.3-3.4-5.8A5.2 5.2 0 0 1 12 5z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <rect x="10.2" y="17.8" width="3.6" height="2.4" rx="0.8" stroke={ink} strokeWidth="1.4" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <path d="M4.5 15a7.5 7.5 0 0 1 15 0M7.5 15a4.5 4.5 0 0 1 9 0" stroke={ink} strokeWidth="1.65" strokeLinecap="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <path d="M12 4.5l5.5 5.5-5.5 7.5L6.5 10 12 4.5z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 17.5c0 1.8 1.5 2.5 2.5 2" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <path d="M5 14h14l-2 4.5H7L5 14z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M12 14V6l4.5 6.2H12" stroke={ink} strokeWidth="1.5" strokeLinejoin="round" />
            </>
          )}
        </>
      )}

      {pack === 'library' && (
        <>
          {slot === 'book' && (
            <>
              <circle cx="12" cy="11.5" r="5.5" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.65" />
              <circle cx="12" cy="11.5" r="2.3" stroke={ink} strokeWidth="1.35" />
              <path d="M9.5 16l-1.5 3.5 4-1.5 4 1.5L14.5 16" stroke={ink} strokeWidth="1.45" strokeLinejoin="round" />
            </>
          )}
          {slot === 'code' && (
            <>
              <path d="M14.5 4.5l5 5-8 8-5.5 1.5 1.5-5.5 7-9z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M10.5 13.5L14 10" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'heart' && (
            <>
              <path d="M9.5 6h5v2.2l2.8 3.2v6.6a1.5 1.5 0 0 1-1.5 1.5H8.2a1.5 1.5 0 0 1-1.5-1.5v-6.6l2.8-3.2V6z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            </>
          )}
          {slot === 'folder' && (
            <>
              <rect x="5" y="5" width="14" height="14" rx="2" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" stroke={ink} strokeWidth="1.45" strokeLinecap="round" />
            </>
          )}
          {slot === 'sparkles' && (
            <>
              <circle cx="12" cy="12" r="7" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" />
              <path d="M12 8v4l2.8 1.8" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
            </>
          )}
          {slot === 'layers' && (
            <>
              <path d="M6 17h12M7.5 13.5h9l-1-6h-7l-1 6z" fill={ink} fillOpacity={washAlpha} stroke={ink} strokeWidth="1.6" strokeLinejoin="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
};

export interface ReviewerCornerDecorProps extends IllustrationProps {
  /** 侧边 Inspector 抽屉打开时自动淡出，避免与面板边缘发生视觉碰撞 */
  inspectorOpen?: boolean;
}

/**
 * 位点 C · 学习专注页左下与右下外围轻巧边饰（仅辅助情绪氛围，不抢卡片焦点）。
 */
export const ReviewerCornerDecor: React.FC<ReviewerCornerDecorProps> = ({
  accentColor,
  isDark = false,
  inspectorOpen = false,
}) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;
  const p = getPalette(isDark);
  const illustrationPack = ILLUSTRATION_PACKS[pack];

  return (
    <div
      className={`reviewer-corner-decor pointer-events-none select-none hidden sm:block absolute inset-x-0 bottom-0 z-0 transition-opacity duration-200 ${
        inspectorOpen ? 'opacity-0' : isDark ? 'opacity-45' : 'opacity-65'
      }`}
      aria-hidden="true"
    >
      <div className="w-full h-28 relative">
        {/* Bottom-Left Corner */}
        <div className="absolute bottom-0 start-0 w-24 h-24 md:w-28 md:h-28">
          {illustrationPack.cornerLeft(p)}
        </div>

        {/* Bottom-Right Corner */}
        <div className="absolute bottom-0 end-0 w-24 h-24 md:w-28 md:h-28">
          {illustrationPack.cornerRight(p)}
        </div>
      </div>
    </div>
  );
};

/**
 * 位点 D1 · 学习完成仪式页中心主插画。
 * 默认经典蓝保留原有 ✓ 对勾徽章；其他 7 个配色渲染仪式感治愈插画。
 */
export const CelebrationIllustration: React.FC<IllustrationProps> = ({
  accentColor,
  isDark = false,
}) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;
  const p = getPalette(isDark);

  return (
    <div
      className="w-[210px] h-[132px] max-w-full mx-auto flex items-center justify-center"
      aria-hidden="true"
    >
      {ILLUSTRATION_PACKS[pack].celebration(p)}
    </div>
  );
};

/**
 * 位点 D2 · 空状态引导小插画（暂无牌组 / 搜索清空等安静空白场景）。
 */
export const EmptyStateIllustration: React.FC<IllustrationProps> = ({
  accentColor,
  isDark = false,
}) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;
  const p = getPalette(isDark);

  return (
    <div
      className="w-[136px] h-[90px] mx-auto mb-1 flex items-center justify-center"
      aria-hidden="true"
    >
      {ILLUSTRATION_PACKS[pack].empty(p)}
    </div>
  );
};
