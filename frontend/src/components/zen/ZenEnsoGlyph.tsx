import React from 'react';

export interface ZenEnsoGlyphProps {
  /** 'open' = classic unclosed Zen brushstroke circle; 'closed' = completed circle for closure ritual. */
  variant?: 'open' | 'closed';
  /** Animate clockwise brushstroke sweep on mount (used in entry threshold & closure). */
  animateDraw?: boolean;
  /** Render hand-carved vermilion hanko stamp (落款朱印「静」) on completion. */
  showSeal?: boolean;
  className?: string;
}

/**
 * Authentic sumi-e brushstroke Ensō (円相) backed by high-resolution transparent raster
 * calligraphy artwork (CSS alpha mask over `currentColor` for seamless light/dark/high-contrast
 * ink rendering) paired with a hand-carved vermilion cinnabar colophon stamp.
 */
export const ZenEnsoGlyph: React.FC<ZenEnsoGlyphProps> = ({
  variant = 'open',
  animateDraw = false,
  showSeal = false,
  className = 'w-36 h-36',
}) => {
  return (
    <span
      aria-hidden="true"
      data-zen-enso={variant}
      className={`zen-enso-frame ${className}`}
    >
      <span
        className={`zen-enso-sweep ${
          animateDraw ? `zen-enso-stroke zen-enso-stroke--${variant}` : ''
        }`}
      >
        <span className={`zen-enso-ink zen-enso-ink--${variant}`} />
      </span>

      {showSeal && <span className="zen-seal-dot zen-seal-stamp" />}
    </span>
  );
};
