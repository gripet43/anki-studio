import React, { useEffect, useState } from 'react';
import {
  AVATAR_PRESET_IDS,
  type AvatarPresetId,
  type CustomAvatarConfig,
} from '../../bridge/pycmd';
import { useAppStore } from '../../stores/useAppStore';
import {
  getAvatarInitial,
  normalizeCustomAvatarConfig,
} from '../../utils/avatarImage';
import {
  type AccentColor,
  type AccentScale,
  getAccentScale,
  resolveThemeMode,
} from '../../utils/themeTokens';

export { AVATAR_PRESET_IDS };
export type { AvatarPresetId, CustomAvatarConfig };

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;

export interface UserAvatarProps {
  avatar?: CustomAvatarConfig | null;
  displayName?: string;
  size?: AvatarSize;
  brandHex?: string;
  accentColor?: AccentColor;
  isDark?: boolean;
  className?: string;
  alt?: string;
}

interface PresetPalette {
  bg: string;
  border: string;
  ink: string;
  paper: string;
  brand: string;
  brandText: string;
  gold: string;
  coral: string;
  sage: string;
}

const SIZE_CLASSES: Record<Exclude<AvatarSize, number>, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-16 h-16 text-xl',
};

function getPresetPalette(scale: AccentScale, isDark: boolean): PresetPalette {
  return isDark
    ? {
        bg: scale.brandSoftStrong,
        border: scale.brandBorder,
        ink: '#E7EBF5',
        paper: '#242836',
        brand: scale.brand,
        brandText: scale.brandText,
        gold: '#F5BD67',
        coral: '#F18BA5',
        sage: '#63D29B',
      }
    : {
        bg: scale.brandSoft,
        border: scale.brandBorder,
        ink: '#262B38',
        paper: '#FFFFFF',
        brand: scale.brand,
        brandText: scale.brandText,
        gold: '#DF8A28',
        coral: '#D45777',
        sage: '#2D9360',
      };
}

function renderPresetArtwork(presetId: AvatarPresetId, p: PresetPalette): React.ReactNode {
  switch (presetId) {
    case 'book':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Hardcover jacket */}
          <path
            d="M7.5 12.2C11.2 10.6 15.2 10.9 18 12.5C20.8 10.9 24.8 10.6 28.5 12.2V25.5C24.8 24 20.8 24.3 18 25.8C15.2 24.3 11.2 24 7.5 25.5V12.2Z"
            fill={p.brand}
            fillOpacity="0.34"
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Open pages */}
          <path
            d="M9.5 10.8C12.6 9.5 15.6 9.9 18 11.4C20.4 9.9 23.4 9.5 26.5 10.8V23.4C23.4 22.1 20.4 22.4 18 23.9C15.6 22.4 12.6 22.1 9.5 23.4V10.8Z"
            fill={p.paper}
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18 11.4V23.9"
            stroke={p.ink}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          {/* Subtle page lines */}
          <path
            d="M11.8 14.5C13.4 14 14.8 14.1 16 14.7M11.8 17.8C13.4 17.3 14.8 17.4 16 18"
            stroke={p.brandText}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M24.2 14.5C22.6 14 21.2 14.1 20 14.7"
            stroke={p.brandText}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Warm gold bookmark ribbon */}
          <path
            d="M21.2 10.1V19.6L23 18.1L24.8 19.6V10.4"
            fill={p.gold}
            fillOpacity="0.9"
            stroke={p.ink}
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'owl':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Body / head silhouette */}
          <path
            d="M10.5 12.5L9.2 8.2L13.8 10.4C15.1 9.9 16.5 9.7 18 9.7C19.5 9.7 20.9 9.9 22.2 10.4L26.8 8.2L25.5 12.5C27.1 14.4 28 16.9 28 19.6C28 24.8 23.7 28 18 28C12.3 28 8 24.8 8 19.6C8 16.9 8.9 14.4 10.5 12.5Z"
            fill={p.brand}
            fillOpacity="0.34"
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Spectacle eye discs */}
          <circle
            cx="14"
            cy="17"
            r="4.1"
            fill={p.paper}
            stroke={p.ink}
            strokeWidth="1.35"
          />
          <circle
            cx="22"
            cy="17"
            r="4.1"
            fill={p.paper}
            stroke={p.ink}
            strokeWidth="1.35"
          />
          {/* Pupils */}
          <circle cx="14.2" cy="17" r="1.7" fill={p.brandText} />
          <circle cx="21.8" cy="17" r="1.7" fill={p.brandText} />
          <circle cx="14.8" cy="16.3" r="0.6" fill={p.paper} />
          <circle cx="22.4" cy="16.3" r="0.6" fill={p.paper} />
          {/* Beak */}
          <path
            d="M16.5 19.5L18 22.3L19.5 19.5Z"
            fill={p.gold}
            stroke={p.ink}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Cozy chest feathers */}
          <path
            d="M14.5 24.4C15.6 25.3 16.8 25.5 18 24.6C19.2 25.5 20.4 25.3 21.5 24.4"
            stroke={p.brandText}
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'leaf':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Ground curve */}
          <path
            d="M11 27.5C13.5 26 22.5 26 25 27.5"
            stroke={p.brandText}
            strokeWidth="1.35"
            strokeLinecap="round"
          />
          {/* Main stem */}
          <path
            d="M18 26.8V16.5"
            stroke={p.ink}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Left botanical leaf */}
          <path
            d="M18 20.5C12.2 20.5 8.8 16.5 9.2 10.5C15 10.2 18.6 13.8 18 20.5Z"
            fill={p.sage}
            fillOpacity="0.65"
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M12.2 13.5C14.2 15.6 16.1 17.8 17.6 19.8"
            stroke={p.ink}
            strokeWidth="1.1"
            strokeOpacity="0.65"
            strokeLinecap="round"
          />
          {/* Right tender sprout leaf */}
          <path
            d="M18 17.2C18.2 11.4 21.6 8.4 27 9.2C26.8 14.6 23.2 17.8 18 17.2Z"
            fill={p.brand}
            fillOpacity="0.52"
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M24 11.6C22.2 13.4 20.3 15.1 18.5 16.7"
            stroke={p.ink}
            strokeWidth="1.1"
            strokeOpacity="0.65"
            strokeLinecap="round"
          />
          {/* Morning dewdrop accent */}
          <circle
            cx="24.5"
            cy="21.5"
            r="1.6"
            fill={p.gold}
            fillOpacity="0.9"
          />
        </svg>
      );

    case 'spark':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Subtle orbital ring */}
          <circle
            cx="18"
            cy="18"
            r="11.5"
            stroke={p.brandText}
            strokeOpacity="0.26"
            strokeWidth="1.1"
            strokeDasharray="2.5 3"
          />
          {/* Primary 4-point star */}
          <path
            d="M17.2 8.2L19.6 15.2L26.6 17.6L19.6 20L17.2 27L14.8 20L7.8 17.6L14.8 15.2L17.2 8.2Z"
            fill={p.gold}
            fillOpacity="0.88"
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          {/* Inner light facet */}
          <path
            d="M17.2 12.2L18.3 16.5L22.6 17.6L18.3 18.7L17.2 23L16.1 18.7L11.8 17.6L16.1 16.5L17.2 12.2Z"
            fill={p.paper}
            fillOpacity="0.55"
          />
          {/* Companion mini star */}
          <path
            d="M26 8.5L26.9 11.1L29.5 12L26.9 12.9L26 15.5L25.1 12.9L22.5 12L25.1 11.1L26 8.5Z"
            fill={p.brand}
            fillOpacity="0.85"
            stroke={p.ink}
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
          {/* Warm star mote */}
          <circle cx="10.5" cy="11" r="1.4" fill={p.coral} />
        </svg>
      );

    case 'cat':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Cat head & ears */}
          <path
            d="M9.6 15.5L8.8 9L14.2 11.8C15.4 11.4 16.7 11.2 18 11.2C19.3 11.2 20.6 11.4 21.8 11.8L27.2 9L26.4 15.5C27.4 17 28 18.8 28 20.6C28 25.1 23.6 28 18 28C12.4 28 8 25.1 8 20.6C8 18.8 8.6 17 9.6 15.5Z"
            fill={p.paper}
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner ears */}
          <path d="M10.4 11.3L10.8 14.7L13.7 13.1Z" fill={p.coral} fillOpacity="0.7" />
          <path d="M25.6 11.3L25.2 14.7L22.3 13.1Z" fill={p.coral} fillOpacity="0.7" />
          {/* Rosy cheeks */}
          <ellipse cx="12.2" cy="21.5" rx="1.9" ry="1.1" fill={p.coral} fillOpacity="0.45" />
          <ellipse cx="23.8" cy="21.5" rx="1.9" ry="1.1" fill={p.coral} fillOpacity="0.45" />
          {/* Happy eyes */}
          <path
            d="M12.3 18.6C13.1 17.3 14.7 17.3 15.5 18.6"
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M20.5 18.6C21.3 17.3 22.9 17.3 23.7 18.6"
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Nose & :3 smile */}
          <path d="M17.1 20.4L18 21.5L18.9 20.4Z" fill={p.coral} />
          <path
            d="M15.8 22.6C16.6 23.5 17.5 23.2 18 22C18.5 23.2 19.4 23.5 20.2 22.6"
            stroke={p.ink}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Whiskers */}
          <path
            d="M8.8 19.6L6.4 19M8.8 21.5L6.2 21.8M27.2 19.6L29.6 19M27.2 21.5L29.8 21.8"
            stroke={p.brandText}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'mountain':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Warm rising sun */}
          <circle
            cx="24.2"
            cy="12.5"
            r="3.6"
            fill={p.gold}
            fillOpacity="0.88"
            stroke={p.ink}
            strokeWidth="1.2"
          />
          {/* Secondary peak */}
          <path
            d="M17.5 26L23.5 16.5L29.5 26H17.5Z"
            fill={p.brand}
            fillOpacity="0.45"
            stroke={p.ink}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Primary tall peak */}
          <path
            d="M6.8 26L14.8 11.8L22.8 26H6.8Z"
            fill={p.brand}
            fillOpacity="0.72"
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />
          {/* Snow cap */}
          <path
            d="M14.8 11.8L11.7 17.3L13.8 16.3L15.1 17.8L16.5 16.2L17.9 17.3L14.8 11.8Z"
            fill={p.paper}
            stroke={p.ink}
            strokeWidth="1.15"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'compass':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Compass dial */}
          <circle
            cx="18"
            cy="18"
            r="10.2"
            fill={p.paper}
            fillOpacity="0.88"
            stroke={p.ink}
            strokeWidth="1.45"
          />
          {/* Cardinal ticks */}
          <path
            d="M18 9.2V10.8M18 25.2V26.8M9.2 18H10.8M25.2 18H26.8"
            stroke={p.brandText}
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {/* North-East needle */}
          <path
            d="M22.6 13.4L19.6 19.6L16.4 16.4L22.6 13.4Z"
            fill={p.coral}
            fillOpacity="0.88"
            stroke={p.ink}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          {/* South-West needle */}
          <path
            d="M13.4 22.6L16.4 16.4L19.6 19.6L13.4 22.6Z"
            fill={p.brand}
            fillOpacity="0.8"
            stroke={p.ink}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          {/* Center pivot */}
          <circle cx="18" cy="18" r="1.4" fill={p.paper} stroke={p.ink} strokeWidth="1.1" />
        </svg>
      );

    case 'flame':
      return (
        <svg
          className="w-full h-full"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Ambient glow */}
          <circle cx="18" cy="19.5" r="9.5" fill={p.gold} fillOpacity="0.16" />
          {/* Outer flame body */}
          <path
            d="M18.6 8.2C20.2 11.4 25.2 14.3 25.2 20.1C25.2 24.4 22 27.6 18 27.6C13.8 27.6 10.8 24.5 10.8 20.3C10.8 17.1 12.6 14.7 14.1 13.4C14.1 15.2 15.1 16.3 15.9 16.5C15.5 13.7 16.5 10.6 18.6 8.2Z"
            fill={p.coral}
            fillOpacity="0.82"
            stroke={p.ink}
            strokeWidth="1.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner golden core */}
          <path
            d="M18.2 16.5C19.6 18.2 21.4 19.8 21.4 22.2C21.4 24.3 19.9 25.8 18 25.8C16.1 25.8 14.6 24.3 14.6 22.2C14.6 20 16.3 18.3 18.2 16.5Z"
            fill={p.gold}
            fillOpacity="0.92"
            stroke={p.ink}
            strokeWidth="1.15"
            strokeLinejoin="round"
          />
          {/* Rising spark dot */}
          <circle cx="24.5" cy="10.8" r="1.35" fill={p.gold} />
        </svg>
      );
  }
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  displayName,
  size = 'sm',
  brandHex,
  accentColor,
  isDark,
  className = '',
  alt = '',
}) => {
  const store = useAppStore();
  const normalized = normalizeCustomAvatarConfig(
    avatar !== undefined ? avatar : store.customAvatar
  );
  const resolvedName =
    displayName !== undefined ? displayName : store.dashboard.userName || '';
  const effectiveAccent = accentColor ?? store.accentColor;
  const effectiveIsDark =
    isDark !== undefined
      ? isDark
      : resolveThemeMode(store.theme, store.systemDark) === 'dark';
  const accentScale = getAccentScale(
    effectiveAccent,
    effectiveIsDark ? 'dark' : 'light'
  );
  const effectiveBrandHex = brandHex || accentScale.brand;

  const imageSrc = normalized.kind === 'image' ? normalized.dataUrl : '';
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [imageSrc]);

  const isNumericSize = typeof size === 'number';
  const sizeClass = isNumericSize ? '' : SIZE_CLASSES[size] || SIZE_CLASSES.sm;
  const numericDimension = isNumericSize ? Math.max(16, Math.round(size)) : undefined;
  const numericFontSize =
    numericDimension !== undefined
      ? Math.max(10, Math.round(numericDimension * 0.4))
      : undefined;

  const baseSizeStyle: React.CSSProperties =
    numericDimension !== undefined
      ? {
          width: `${numericDimension}px`,
          height: `${numericDimension}px`,
          fontSize: `${numericFontSize}px`,
        }
      : {};

  if (normalized.kind === 'image' && imageSrc && !imgFailed) {
    return (
      <div
        data-avatar-kind="image"
        style={baseSizeStyle}
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 bg-black/[0.04] dark:bg-white/[0.06] ring-1 ring-black/10 dark:ring-white/15 ${className}`}
      >
        <img
          src={imageSrc}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  if (normalized.kind === 'preset') {
    const palette = getPresetPalette(accentScale, effectiveIsDark);
    return (
      <div
        data-avatar-kind="preset"
        data-avatar-preset={normalized.presetId}
        style={{
          ...baseSizeStyle,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        }}
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 border flex items-center justify-center ${className}`}
      >
        {renderPresetArtwork(normalized.presetId, palette)}
      </div>
    );
  }

  const initialChar = getAvatarInitial(resolvedName);
  return (
    <div
      data-avatar-kind="initial"
      style={{
        ...baseSizeStyle,
        backgroundColor: effectiveBrandHex,
      }}
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-semibold shrink-0 ${className}`}
    >
      <span aria-hidden="true">{initialChar}</span>
    </div>
  );
};
