import type React from 'react';

export interface IllustrationPalette {
  ink: string;
  soft: string;
  warm: string;
  paper: string;
  brand: string;
  brandSoft: string;
  gold: string;
  rose: string;
  leaf: string;
}

export type IllustrationRenderer = (palette: IllustrationPalette) => React.ReactNode;

export interface ThemeIllustrationPack {
  greeting: IllustrationRenderer;
  cornerLeft: IllustrationRenderer;
  cornerRight: IllustrationRenderer;
  celebration: IllustrationRenderer;
  empty: IllustrationRenderer;
}
