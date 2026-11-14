import React from 'react';
import {
  AccentColor,
  getAccentAtmosphere,
  IllustrationPackId,
} from '../../utils/themeTokens';

interface IllustrationProps {
  accentColor: AccentColor;
  isDark?: boolean;
}

interface DeckEmblemProps extends IllustrationProps {
  deckAccent: string;
}

interface Palette {
  ink: string;
  soft: string;
  warm: string;
  gold: string;
  rose: string;
  leaf: string;
}

function getPalette(isDark: boolean): Palette {
  return isDark
    ? {
        ink: '#D5D8E4',
        soft: 'rgba(255, 255, 255, 0.10)',
        warm: 'rgba(255, 255, 255, 0.06)',
        gold: '#F2B866',
        rose: '#EF8BA3',
        leaf: '#6AD29D',
      }
    : {
        ink: '#353944',
        soft: 'rgba(30, 36, 48, 0.08)',
        warm: '#F3EEE4',
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
      className="hidden md:inline-flex items-center justify-center w-[98px] h-[40px] shrink-0 pointer-events-none select-none opacity-90"
      aria-hidden="true"
    >
      {pack === 'botanical' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <ellipse cx="76" cy="24" rx="22" ry="11" fill="var(--brand-soft)" />
          <path d="M18 33c18-11 40-15 66-14" stroke={p.leaf} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M36 25c-4-9 4-15 11-9-3 6-6 9-11 9z" fill={p.leaf} fillOpacity="0.28" stroke={p.leaf} strokeWidth="1.35" />
          <path d="M56 20c2-10 12-13 16-6-4 5-9 7-16 6z" fill={p.leaf} fillOpacity="0.22" stroke={p.leaf} strokeWidth="1.35" />
          <path d="M72 22c6-6 14-5 15 2-5 3-10 2-15-2z" fill="var(--brand)" fillOpacity="0.24" stroke="var(--brand)" strokeWidth="1.3" />
          <circle cx="94" cy="14" r="3" fill={p.gold} fillOpacity="0.65" />
        </svg>
      )}

      {pack === 'kyoto' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          {/* Circular shoji window + drifting ginkgo leaves + quiet mist (zero red cross) */}
          <circle cx="64" cy="22" r="16" fill="var(--brand-soft)" stroke="var(--brand-border)" strokeWidth="1.15" />
          <path d="M49 22h30M64 7v30" stroke="var(--brand-border)" strokeWidth="0.9" opacity="0.65" />
          <path
            d="M32 28c6-5 11-1 8 5-3 2-7 0-8-5z"
            fill={p.gold}
            fillOpacity="0.34"
            stroke={p.gold}
            strokeWidth="1.25"
          />
          <path
            d="M84 15c7-4 11 1 7 6-4 1-7-2-7-6z"
            fill="var(--brand)"
            fillOpacity="0.26"
            stroke="var(--brand)"
            strokeWidth="1.2"
          />
          <circle cx="93" cy="28" r="2.8" fill={p.rose} fillOpacity="0.6" />
        </svg>
      )}

      {pack === 'cafe' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <ellipse cx="64" cy="34" rx="30" ry="4" fill="var(--brand-soft)" />
          <path d="M24 33h60" stroke={p.ink} strokeOpacity="0.2" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M40 20h20v8a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9v-8z" fill={p.warm} stroke={p.ink} strokeWidth="1.4" />
          <path d="M60 22h3a3 3 0 0 1 0 6h-3" stroke={p.ink} strokeWidth="1.4" />
          <path d="M46 16c0-3 3-4 2-7M53 16c0-3 3-4 2-7" stroke="var(--brand)" strokeWidth="1.35" strokeLinecap="round" opacity="0.8" />
          <path d="M68 31c1-6 8-9 13-6 4 2 5 6 2 8H68z" fill={p.gold} fillOpacity="0.28" stroke={p.gold} strokeWidth="1.3" />
        </svg>
      )}

      {pack === 'neko' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <path d="M18 35h74" stroke={p.ink} strokeOpacity="0.22" strokeWidth="1.2" strokeLinecap="round" />
          {/* Cozy peeking study cat silhouette */}
          <path
            d="M42 35c0-10 6-16 14-16s14 6 14 16"
            fill={p.warm}
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path
            d="M44 23l-2-9 9 5M68 23l2-9-9 5"
            fill={p.warm}
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="51" cy="27" r="1.3" fill={p.ink} />
          <circle cx="61" cy="27" r="1.3" fill={p.ink} />
          <ellipse cx="48" cy="30" rx="2.2" ry="1.2" fill={p.rose} fillOpacity="0.55" />
          <ellipse cx="64" cy="30" rx="2.2" ry="1.2" fill={p.rose} fillOpacity="0.55" />
          <path d="M72 34c9 1 14-3 12-9" stroke={p.gold} strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      )}

      {pack === 'celestial' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="58" cy="22" r="16" fill="var(--brand-soft)" />
          <path
            d="M60 11a10.5 10.5 0 1 0 10 14 8.5 8.5 0 0 1-10-14z"
            fill={p.gold}
            fillOpacity="0.32"
            stroke={p.gold}
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <ellipse cx="58" cy="22" rx="24" ry="8" transform="rotate(-14 58 22)" stroke="var(--brand)" strokeWidth="1.15" strokeDasharray="3 3" />
          <path d="M34 15l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2z" fill="var(--brand)" fillOpacity="0.7" />
          <circle cx="88" cy="14" r="1.8" fill={p.gold} />
        </svg>
      )}

      {pack === 'cloudscape' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <path
            d="M28 31h32a6 6 0 0 0 1-12 8.5 8.5 0 0 0-16-2 7 7 0 0 0-12 4 5.5 5.5 0 0 0-5 10z"
            fill="var(--brand-soft)"
            stroke="var(--brand-border)"
            strokeWidth="1.25"
          />
          <path d="M22 33c16-4 28-8 42-15" stroke="var(--brand)" strokeWidth="1.15" strokeDasharray="2.5 3" strokeLinecap="round" />
          <path
            d="M71 14l22-5-11 16-3.5-6.5L71 14z"
            fill="var(--brand)"
            fillOpacity="0.22"
            stroke="var(--brand)"
            strokeWidth="1.35"
            strokeLinejoin="round"
          />
          <path d="M93 9l-14.5 10" stroke="var(--brand)" strokeWidth="1.15" />
        </svg>
      )}

      {pack === 'library' && (
        <svg viewBox="0 0 112 44" className="w-full h-full" fill="none" aria-hidden="true">
          <rect x="30" y="13" width="38" height="21" rx="3" fill={p.warm} stroke={p.ink} strokeWidth="1.3" />
          <path d="M49 13v21" stroke={p.ink} strokeOpacity="0.35" strokeWidth="1.1" />
          <path d="M35 20h9M35 25h7M54 20h9M54 25h7" stroke={p.ink} strokeOpacity="0.45" strokeWidth="1.15" strokeLinecap="round" />
          {/* Nib pen */}
          <path
            d="M78 30l13-16 4 4-13 16-6 2 2-6z"
            fill="var(--brand-soft)"
            stroke="var(--brand)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="88" cy="11" r="2.2" fill={p.gold} fillOpacity="0.7" />
        </svg>
      )}
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

/**
 * 位点 C · 学习专注页左下与右下外围轻巧边饰（仅辅助情绪氛围，不抢卡片焦点）。
 */
export const ReviewerCornerDecor: React.FC<IllustrationProps> = ({ accentColor, isDark = false }) => {
  const pack = resolveIllustrationPack(accentColor);
  if (pack === 'none') return null;
  const p = getPalette(isDark);

  return (
    <div
      className={`pointer-events-none select-none hidden sm:block fixed inset-x-0 bottom-14 z-0 ${
        isDark ? 'opacity-50' : 'opacity-65'
      }`}
      aria-hidden="true"
    >
      <div className="w-full h-28 relative">
        {/* Bottom-Left Corner */}
        <div className="absolute bottom-2 start-6 w-24 h-24">
          {pack === 'botanical' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M14 84c2-24 14-42 36-52" stroke={p.leaf} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M22 62c-12-3-16-14-6-18 6 4 9 11 6 18z" fill={p.leaf} fillOpacity="0.2" stroke={p.leaf} strokeWidth="1.35" />
              <path d="M32 48c3-13 14-18 19-9-4 7-11 10-19 9z" fill={p.leaf} fillOpacity="0.16" stroke={p.leaf} strokeWidth="1.35" />
            </svg>
          )}
          {pack === 'kyoto' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M18 86l12-46M26 60l14-8M21 72l-9-9" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M40 52c6-4 11-1 9 4-4 1-7 0-9-4z" fill="var(--brand)" fillOpacity="0.22" stroke="var(--brand)" strokeWidth="1.2" />
              <ellipse cx="26" cy="84" rx="14" ry="4" fill={p.soft} />
            </svg>
          )}
          {pack === 'cafe' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M18 82h34" stroke={p.ink} strokeOpacity="0.24" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M24 58h20v12a9 9 0 0 1-9 9h-2a9 9 0 0 1-9-9V58z" fill={p.warm} stroke={p.ink} strokeWidth="1.4" />
              <path d="M44 62h3.5a3.5 3.5 0 0 1 0 7H44" stroke={p.ink} strokeWidth="1.4" />
              <path d="M31 52c0-4 4-6 3-10M38 52c0-4 4-6 3-10" stroke={p.gold} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
          {pack === 'neko' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <ellipse cx="38" cy="74" rx="22" ry="12" fill={p.warm} stroke={p.ink} strokeWidth="1.4" />
              <path d="M24 66l-2-10 9 5M45 64l3-9-8 5" fill={p.warm} stroke={p.ink} strokeWidth="1.35" strokeLinejoin="round" />
              <path d="M56 76c10 3 18-3 15-11" stroke={p.gold} strokeWidth="2.1" strokeLinecap="round" />
              <circle cx="31" cy="70" r="1.2" fill={p.ink} />
              <circle cx="40" cy="70" r="1.2" fill={p.ink} />
            </svg>
          )}
          {pack === 'celestial' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <circle cx="24" cy="68" r="2.2" fill={p.gold} />
              <circle cx="40" cy="52" r="2.2" fill="var(--brand)" />
              <circle cx="58" cy="62" r="2" fill={p.gold} />
              <path d="M24 68L40 52L58 62" stroke="var(--brand)" strokeWidth="1.15" strokeDasharray="3 3" />
            </svg>
          )}
          {pack === 'cloudscape' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M14 76h42a7.5 7.5 0 0 0 1-14.8 10 10 0 0 0-19-2.2 8 8 0 0 0-14 4.5 6.5 6.5 0 0 0-10 12.5z" fill="var(--brand-soft)" stroke="var(--brand-border)" strokeWidth="1.25" />
            </svg>
          )}
          {pack === 'library' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M26 52h16v6l6 7v15H20V65l6-7v-6z" fill={p.warm} stroke={p.ink} strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M25 58h18M34 52v-6" stroke={p.ink} strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Bottom-Right Corner */}
        <div className="absolute bottom-2 end-6 w-24 h-24">
          {pack === 'botanical' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M80 84c-2-20-12-34-28-44" stroke={p.leaf} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="52" cy="40" r="6" fill={p.gold} fillOpacity="0.22" stroke={p.gold} strokeWidth="1.3" />
              <path d="M68 62c10-4 14-12 6-16-6 3-8 10-6 16z" fill={p.leaf} fillOpacity="0.18" stroke={p.leaf} strokeWidth="1.3" />
            </svg>
          )}
          {pack === 'kyoto' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              {/* Unfolded paper fan (sensu) + round sun motif */}
              <path d="M54 78L34 48c14-10 34-6 44 10L54 78z" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.35" strokeLinejoin="round" />
              <path d="M54 78L48 44M54 78L62 47" stroke="var(--brand-border)" strokeWidth="1" />
              <circle cx="62" cy="36" r="4" fill={p.rose} fillOpacity="0.45" />
            </svg>
          )}
          {pack === 'cafe' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M40 76c2-11 10-16 16-14s13 6 15 14H40z" fill={p.gold} fillOpacity="0.24" stroke={p.gold} strokeWidth="1.4" />
              <circle cx="32" cy="74" r="3" fill={p.ink} fillOpacity="0.25" />
            </svg>
          )}
          {pack === 'neko' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <ellipse cx="64" cy="70" rx="10" ry="8" fill={p.rose} fillOpacity="0.22" stroke={p.rose} strokeWidth="1.35" />
              <circle cx="54" cy="56" r="3" fill={p.rose} fillOpacity="0.4" />
              <circle cx="62" cy="52" r="3" fill={p.rose} fillOpacity="0.4" />
              <circle cx="71" cy="54" r="3" fill={p.rose} fillOpacity="0.4" />
              <circle cx="76" cy="61" r="2.8" fill={p.rose} fillOpacity="0.4" />
            </svg>
          )}
          {pack === 'celestial' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M62 46a13 13 0 1 0 12 17 10.5 10.5 0 0 1-12-17z" fill={p.gold} fillOpacity="0.24" stroke={p.gold} strokeWidth="1.35" />
              <circle cx="44" cy="52" r="1.5" fill="var(--brand)" />
            </svg>
          )}
          {pack === 'cloudscape' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <path d="M22 76c14-4 24-10 34-18" stroke="var(--brand)" strokeWidth="1.15" strokeDasharray="3 3" strokeLinecap="round" />
              <path d="M58 52l22-7-10 17-3.5-6-8.5-4z" fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth="1.35" strokeLinejoin="round" />
            </svg>
          )}
          {pack === 'library' && (
            <svg viewBox="0 0 96 96" className="w-full h-full" fill="none" aria-hidden="true">
              <circle cx="64" cy="66" r="11" fill={p.rose} fillOpacity="0.22" stroke={p.rose} strokeWidth="1.35" />
              <circle cx="64" cy="66" r="5" stroke={p.rose} strokeWidth="1.15" />
            </svg>
          )}
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
    <div className="w-[164px] h-[112px] mx-auto flex items-center justify-center" aria-hidden="true">
      {pack === 'botanical' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="105" cy="66" r="46" fill="var(--brand-soft)" />
          <path d="M40 102h130" stroke={p.ink} strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
          <path
            d="M54 98V66c16-4 34-2 51 6v28c-17-6-35-8-51-2zM156 98V66c-16-4-34-2-51 6v28c17-6 35-8 51-2z"
            fill={p.warm}
            stroke={p.ink}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M105 72c0-20 2-32 10-44" stroke={p.leaf} strokeWidth="1.75" strokeLinecap="round" />
          <path d="M105 56c-12-4-17-14-9-20 7 4 10 12 9 20z" fill={p.leaf} fillOpacity="0.28" stroke={p.leaf} strokeWidth="1.45" />
          <path d="M109 44c6-11 18-13 21-4-6 5-13 6-21 4z" fill={p.leaf} fillOpacity="0.24" stroke={p.leaf} strokeWidth="1.45" />
          <path d="M138 78h16v13a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7V78z" fill={p.warm} stroke={p.ink} strokeWidth="1.45" />
          <circle cx="72" cy="40" r="3" fill={p.gold} fillOpacity="0.6" />
        </svg>
      )}

      {pack === 'kyoto' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          {/* Calm shoji circle · steaming matcha bowl · spaced origami crane · floating ginkgo · zero red cross */}
          <circle cx="105" cy="64" r="44" fill="var(--brand-soft)" stroke="var(--brand-border)" strokeWidth="1.2" />
          <path d="M62 64h86M105 21v86" stroke="var(--brand-border)" strokeWidth="0.9" opacity="0.5" />
          <path d="M44 102h122" stroke={p.ink} strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
          {/* Matcha bowl on left */}
          <path d="M60 80h34v6a17 17 0 0 1-34 0v-6z" fill={p.warm} stroke={p.ink} strokeWidth="1.5" />
          <path d="M70 72c0-4 3-6 2-10M81 72c0-4 3-6 2-10" stroke={p.leaf} strokeWidth="1.4" strokeLinecap="round" />
          {/* Origami crane cleanly spaced on right */}
          <path
            d="M112 96l16-17 16 17h-32zm16-17l13-11 4 4-9 10"
            fill={p.warm}
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path d="M124 85l17-19" stroke="var(--brand)" strokeWidth="1.3" strokeLinecap="round" />
          {/* Drifting ginkgo leaves top */}
          <path d="M84 42c8-5 14 0 10 7-5 2-9-1-10-7z" fill={p.gold} fillOpacity="0.34" stroke={p.gold} strokeWidth="1.3" />
          <path d="M114 38c8-4 13 2 8 7-5 1-8-2-8-7z" fill="var(--brand)" fillOpacity="0.26" stroke="var(--brand)" strokeWidth="1.25" />
          {/* Soft round artist moon seal (pure circle — no cross strokes!) */}
          <circle cx="155" cy="90" r="6" fill={p.rose} fillOpacity="0.82" />
          <circle cx="153.5" cy="88.5" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />
        </svg>
      )}

      {pack === 'cafe' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="105" cy="64" r="44" fill="var(--brand-soft)" />
          <path d="M40 102h130" stroke={p.ink} strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M74 68h42v17a15 15 0 0 1-15 15H89a15 15 0 0 1-15-15V68z" fill={p.warm} stroke={p.ink} strokeWidth="1.6" />
          <path d="M116 74h6a5 5 0 0 1 0 10h-6" stroke={p.ink} strokeWidth="1.55" />
          <path d="M86 58c0-6 5-7 3-14M98 56c0-6 5-7 3-14M109 59c0-5 4-6 3-12" stroke={p.gold} strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M128 98c2-11 10-16 18-13 6 2 8 8 5 13h-23z"
            fill={p.gold}
            fillOpacity="0.28"
            stroke={p.gold}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path d="M56 38v28M48 38h16l-2-10H50l-2 10z" fill={p.gold} fillOpacity="0.2" stroke={p.ink} strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      )}

      {pack === 'neko' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="105" cy="64" r="44" fill="var(--brand-soft)" />
          <path d="M44 102h122" stroke={p.ink} strokeOpacity="0.22" strokeWidth="1.4" strokeLinecap="round" />
          {/* Stack of hardcovers + happy resting cat */}
          <rect x="66" y="88" width="78" height="12" rx="4" fill={p.warm} stroke={p.ink} strokeWidth="1.45" />
          <rect x="74" y="76" width="62" height="12" rx="4" fill={p.soft} stroke={p.ink} strokeWidth="1.45" />
          <path d="M86 76c0-15 8-24 19-24s19 9 19 24H86z" fill={p.warm} stroke={p.ink} strokeWidth="1.55" />
          <path d="M90 58l-3-12 12 7M120 58l3-12-12 7" fill={p.warm} stroke={p.ink} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M97 64q2.5-2.5 5 0M108 64q2.5-2.5 5 0" stroke={p.ink} strokeWidth="1.55" strokeLinecap="round" />
          <ellipse cx="95" cy="69" rx="3" ry="1.6" fill={p.rose} fillOpacity="0.55" />
          <ellipse cx="115" cy="69" rx="3" ry="1.6" fill={p.rose} fillOpacity="0.55" />
          <path d="M124 76c14 2 22-5 18-16" stroke={p.gold} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )}

      {pack === 'celestial' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="105" cy="64" r="46" fill="var(--brand-soft)" />
          <ellipse cx="105" cy="64" rx="56" ry="16" transform="rotate(-14 105 64)" stroke="var(--brand)" strokeWidth="1.25" strokeDasharray="4 4" />
          <path
            d="M110 26a21 21 0 1 0 18 29 17 17 0 0 1-18-29z"
            fill={p.gold}
            fillOpacity="0.32"
            stroke={p.gold}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M66 96V74c14-3 26 0 39 5v22c-13-5-25-7-39-5zM144 96V74c-14-3-26 0-39 5v22c13-5 25-7 39-5z"
            fill={p.warm}
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          <path d="M58 42l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={p.gold} fillOpacity="0.8" />
          <circle cx="148" cy="40" r="2.2" fill="var(--brand)" />
        </svg>
      )}

      {pack === 'cloudscape' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <path d="M46 94a59 59 0 0 1 118 0" stroke="var(--brand)" strokeOpacity="0.22" strokeWidth="10" strokeLinecap="round" />
          <path d="M58 94a47 47 0 0 1 94 0" stroke={p.gold} strokeOpacity="0.25" strokeWidth="7" strokeLinecap="round" />
          <path d="M38 98h42a8 8 0 0 0 1-15.8 11 11 0 0 0-21-2.5 8 8 0 0 0-15 5A7 7 0 0 0 38 98z" fill="var(--brand-soft)" stroke="var(--brand-border)" strokeWidth="1.35" />
          <path d="M126 98h44a7.5 7.5 0 0 0 1-14.8 10 10 0 0 0-19-2.2 8 8 0 0 0-14 4.5 6.5 6.5 0 0 0-12 12.5z" fill="var(--brand-soft)" stroke="var(--brand-border)" strokeWidth="1.35" />
          <path
            d="M116 40l32-11-16 26-5.5-9.5-10.5-5.5z"
            fill="var(--brand)"
            fillOpacity="0.26"
            stroke="var(--brand)"
            strokeWidth="1.55"
            strokeLinejoin="round"
          />
          <path d="M148 29l-21.5 16.5" stroke="var(--brand)" strokeWidth="1.25" />
        </svg>
      )}

      {pack === 'library' && (
        <svg viewBox="0 0 210 132" className="w-full h-full" fill="none" aria-hidden="true">
          <circle cx="105" cy="64" r="44" fill="var(--brand-soft)" />
          <rect x="64" y="42" width="82" height="54" rx="8" fill={p.warm} stroke={p.ink} strokeWidth="1.5" />
          <path d="M78 56h38M78 66h28" stroke={p.ink} strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="122" cy="84" r="10" fill={p.rose} fillOpacity="0.3" stroke={p.rose} strokeWidth="1.45" />
          <circle cx="122" cy="84" r="4.5" stroke={p.rose} strokeWidth="1.2" />
          <path
            d="M150 40l9 9-20 24-11 3 3-11 19-25z"
            fill={p.gold}
            fillOpacity="0.28"
            stroke={p.gold}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
        </svg>
      )}
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
    <div className="w-[120px] h-[84px] mx-auto mb-1 flex items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 136 90" className="w-full h-full" fill="none" aria-hidden="true">
        <ellipse cx="68" cy="48" rx="44" ry="26" fill="var(--brand-soft)" />
        <path d="M26 74h84" stroke={p.ink} strokeOpacity="0.2" strokeWidth="1.3" strokeLinecap="round" />

        {pack === 'botanical' && (
          <>
            <path d="M52 72V44l16-6 16 6v28" fill={p.warm} stroke={p.ink} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M68 58c0-10 3-16 9-19" stroke={p.leaf} strokeWidth="1.5" strokeLinecap="round" />
            <path d="M68 50c-8-3-10-10-4-13 5 2 6 8 4 13z" fill={p.leaf} fillOpacity="0.28" stroke={p.leaf} strokeWidth="1.25" />
          </>
        )}

        {pack === 'kyoto' && (
          <>
            {/* Serene shoji arch + teacup (zero cross) */}
            <circle cx="68" cy="46" r="19" fill={p.warm} stroke="var(--brand-border)" strokeWidth="1.3" />
            <path d="M54 62h28v6a14 14 0 0 1-28 0v-6z" fill={p.warm} stroke={p.ink} strokeWidth="1.4" />
            <path d="M77 37c6-4 10 0 7 5-4 1-7-1-7-5z" fill={p.gold} fillOpacity="0.38" stroke={p.gold} strokeWidth="1.2" />
          </>
        )}

        {pack === 'cafe' && (
          <>
            <path d="M52 50h26v12a10 10 0 0 1-10 10h-6a10 10 0 0 1-10-10V50z" fill={p.warm} stroke={p.ink} strokeWidth="1.45" />
            <path d="M78 53h4a3.5 3.5 0 0 1 0 7h-4" stroke={p.ink} strokeWidth="1.4" />
            <path d="M60 44c0-3 3-4 2-8M68 44c0-3 3-4 2-8" stroke={p.gold} strokeWidth="1.35" strokeLinecap="round" />
          </>
        )}

        {pack === 'neko' && (
          <>
            <ellipse cx="68" cy="58" rx="20" ry="13" fill={p.warm} stroke={p.ink} strokeWidth="1.45" />
            <path d="M54 50l-2-9 8 4M76 49l3-9-8 5" fill={p.warm} stroke={p.ink} strokeWidth="1.35" strokeLinejoin="round" />
            <path d="M60 56q2 2 4 0M72 56q2 2 4 0" stroke={p.ink} strokeWidth="1.4" strokeLinecap="round" />
          </>
        )}

        {pack === 'celestial' && (
          <>
            <path d="M70 26a15 15 0 1 0 13 21 12 12 0 0 1-13-21z" fill={p.gold} fillOpacity="0.32" stroke={p.gold} strokeWidth="1.45" />
            <circle cx="48" cy="36" r="2" fill="var(--brand)" />
            <circle cx="90" cy="48" r="1.8" fill={p.gold} />
          </>
        )}

        {pack === 'cloudscape' && (
          <>
            <path d="M44 62h44a7.5 7.5 0 0 0 1-14.8 10 10 0 0 0-19-2.2 8 8 0 0 0-14 4.5 6.5 6.5 0 0 0-12 12.5z" fill={p.warm} stroke="var(--brand)" strokeWidth="1.35" />
            <path d="M76 34l16-6-7 13-3-4-6-3z" fill="var(--brand)" fillOpacity="0.24" stroke="var(--brand)" strokeWidth="1.25" />
          </>
        )}

        {pack === 'library' && (
          <>
            <rect x="46" y="40" width="44" height="30" rx="5" fill={p.warm} stroke={p.ink} strokeWidth="1.4" />
            <path d="M56 50h18M56 58h12" stroke={p.ink} strokeOpacity="0.4" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="80" cy="60" r="5" fill={p.rose} fillOpacity="0.3" stroke={p.rose} strokeWidth="1.25" />
          </>
        )}
      </svg>
    </div>
  );
};
