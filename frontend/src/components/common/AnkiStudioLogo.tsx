import React from 'react';

export interface AnkiStudioLogoProps {
  /** Size in pixels (width & height), defaults to 24 */
  size?: number;
  /** Custom additional className */
  className?: string;
  /** Custom left facet color (defaults to soft lavender-blue #BCB8F7) */
  leftColor?: string;
  /** Custom right facet color (defaults to primary brand blue #5E5CE6) */
  rightColor?: string;
}

/**
 * Anki Studio Official Brand Logo
 * Geometry: Isometric split-hexagon / dual-facet open knowledge prism.
 * - Left facet: #BCB8F7 (Soft lavender blue · Input / Question / Front)
 * - Right facet: #5E5CE6 (Deep Studio brand blue · Output / Answer / Back)
 */
export const AnkiStudioLogo: React.FC<AnkiStudioLogoProps> = ({
  size = 24,
  className = '',
  leftColor = '#BCB8F7',
  rightColor = '#5E5CE6',
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
