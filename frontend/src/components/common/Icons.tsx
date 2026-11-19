import React from 'react';

export interface IconProps {
  className?: string;
  strokeWidth?: number;
}

const baseProps = (className: string, strokeWidth: number) => ({
  className: `shrink-0 ${className}`.trim(),
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
});

export const SyncArrowsIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

export const SpinnerIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.4,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export const CloseIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.4,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  strokeWidth = 2.1,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const PlayTriangleIcon: React.FC<Pick<IconProps, 'className'>> = ({
  className = 'w-3 h-3',
}) => (
  <svg
    className={`shrink-0 fill-current ${className}`.trim()}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <polygon points="6 4 20 12 6 20 6 4" />
  </svg>
);

export const AlertTriangleIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const DownloadIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const UploadIcon: React.FC<IconProps> = ({
  className = 'w-4 h-4',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

export const MinusIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2.2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const AlignLeftIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <line x1="3" y1="18" x2="18" y2="18" />
  </svg>
);

export const AlignCenterIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="6" y1="12" x2="18" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
);

export const AlignRightIcon: React.FC<IconProps> = ({
  className = 'w-3.5 h-3.5',
  strokeWidth = 2,
}) => (
  <svg {...baseProps(className, strokeWidth)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="9" y1="12" x2="21" y2="12" />
    <line x1="6" y1="18" x2="21" y2="18" />
  </svg>
);
