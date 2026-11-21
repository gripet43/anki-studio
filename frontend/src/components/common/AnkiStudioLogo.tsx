import React from 'react';

export type AnkiStudioLogoVariant = 'titanium' | 'ink' | 'brand';

export interface AnkiStudioLogoProps {
  /** Size in pixels (width & height), defaults to 24 */
  size?: number;
  /** Visual variant: 'titanium' (default matte dual-tone titanium for all 8 themes), 'ink' (monochrome ink), or 'brand' (classic Studio Blue) */
  variant?: AnkiStudioLogoVariant;
  /** Custom additional className */
  className?: string;
  /** Custom left facet color (overrides variant default) */
  leftColor?: string;
  /** Custom right facet color (overrides variant default) */
  rightColor?: string;
}

/**
 * Anki Studio Official Brand Logo
 * Geometry: Isometric split-hexagon / dual-facet open knowledge prism.
 * - Default ('titanium'): Solid matte dual-tone titanium (#B8BEC8 / #474C56 in light,
 *   #787E8C / #E4E7EE in dark) — zero translucent muddiness, calm visual weight, and
 *   zero hue clash across all 8 paper-craft themes.
 * - 'ink': Monochrome ink with 36% opacity left facet.
 * - 'brand': Classic Studio Blue (#A1C1E4 left / #3076C3 right) for external brand surfaces.
 */
export const AnkiStudioLogo: React.FC<AnkiStudioLogoProps> = ({
  size = 24,
  variant = 'titanium',
  className = '',
  leftColor,
  rightColor,
}) => {
  const isBrand = variant === 'brand';
  const isInk = variant === 'ink';
  const isTitanium = !isBrand && !isInk;

  const resolvedLeft = leftColor ?? (isBrand ? '#A1C1E4' : isInk ? 'currentColor' : undefined);
  const resolvedRight = rightColor ?? (isBrand ? '#3076C3' : isInk ? 'currentColor' : undefined);
  const leftOpacity = isInk && !leftColor ? 0.36 : undefined;
  const inkToneClass =
    isInk && !leftColor && !rightColor ? 'text-[#1D1D1F] dark:text-[#F2F3F7]' : '';
  const leftFacetClass =
    isTitanium && !leftColor ? 'fill-[#B8BEC8] dark:fill-[#787E8C]' : undefined;
  const rightFacetClass =
    isTitanium && !rightColor ? 'fill-[#474C56] dark:fill-[#E4E7EE]' : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${inkToneClass} ${className}`.trim()}
      aria-label="Anki Studio Logo"
    >
      {/* Left Facet: Input / Question */}
      <path
        d="M 3 7.53 L 10.85 4.27 L 10.85 19.85 L 3 16.47 Z"
        fill={resolvedLeft}
        fillOpacity={leftOpacity}
        className={leftFacetClass}
      />
      {/* Right Facet: Output / Answer */}
      <path
        d="M 13.15 4.15 L 21 7.53 L 21 16.47 L 13.15 19.85 Z"
        fill={resolvedRight}
        className={rightFacetClass}
      />
    </svg>
  );
};
