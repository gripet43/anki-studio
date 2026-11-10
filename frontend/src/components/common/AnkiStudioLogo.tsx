import React from 'react';

export interface AnkiStudioLogoProps {
  /** Size in pixels (width & height), defaults to 24 */
  size?: number;
  /** Custom additional className */
  className?: string;
  /** Custom left facet color (defaults to soft studio blue tint #A1C1E4) */
  leftColor?: string;
  /** Custom right facet color (defaults to primary brand blue #3076C3) */
  rightColor?: string;
}

/**
 * Anki Studio Official Brand Logo
 * Geometry: Isometric split-hexagon / dual-facet open knowledge prism.
 * - Left facet: #A1C1E4 (Soft studio blue tint · Input / Question / Front)
 * - Right facet: #3076C3 (Deep Studio brand blue · Output / Answer / Back)
 */
export const AnkiStudioLogo: React.FC<AnkiStudioLogoProps> = ({
  size = 24,
  className = '',
  leftColor = '#A1C1E4',
  rightColor = '#3076C3',
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-label="Anki Studio Logo"
    >
      {/* Left Facet: Input / Question / Soft Lavender Blue */}
      <path
        d="M 3 7.53 L 10.85 4.27 L 10.85 19.85 L 3 16.47 Z"
        fill={leftColor}
      />
      {/* Right Facet: Output / Answer / Deep Studio Blue */}
      <path
        d="M 13.15 4.15 L 21 7.53 L 21 16.47 L 13.15 19.85 Z"
        fill={rightColor}
      />
    </svg>
  );
};
