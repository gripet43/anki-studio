// ============================================================================
// Anki Modern OS — Modern SaaS Perceptual Color & Theme Token Engine
// Inspired by Linear (LCH perceptual harmony), Radix Colors (12-step functional
// scales), Notion (warm low-chroma accents), and Material 3 Dark Theme guidelines.
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'oled';

export type AccentColor =
  | 'indigo'
  | 'emerald'
  | 'cyan'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'violet'
  | 'slate';

export interface AccentScale {
  /** Primary solid fill for CTA buttons, active toggles, and peak bars */
  brand: string;
  /** Hover solid fill for primary buttons */
  brandHover: string;
  /** RGB triplet string (e.g. "91, 91, 214") for rgba(var(--brand-rgb), alpha) */
  brandRgb: string;
  /** High-contrast readable text/icon accent color calibrated for light vs dark surfaces */
  brandText: string;
  /** Subtle pill/badge/active-nav background tint (Step 3) */
  brandSoft: string;
  /** Medium hover/active badge tint (Step 4) */
  brandSoftStrong: string;
  /** Selected card / row subtle surface tint (Step 2) */
  brandSurface: string;
  /** Subtle interactive border & focus ring color (Step 6-7) */
  brandBorder: string;
  /** Secondary / non-peak bar fill in charts (Weekly Rhythm, 30d Forecast, 24h Dist) */
  brandMutedBar: string;
  /** 4-level progressive heatmap scale [level1, level2, level3, level4] */
  heatmap: [string, string, string, string];
}

export interface AccentThemeMeta {
  id: AccentColor;
  nameZh: string;
  nameEn: string;
  shortNameZh: string;
  shortNameEn: string;
  isOfficial?: boolean;
  descZh: string;
  descEn: string;
  swatchHex: string;
  light: AccentScale;
  dark: AccentScale;
}

export const ACCENT_THEMES: Record<AccentColor, AccentThemeMeta> = {
  indigo: {
    id: 'indigo',
    nameZh: '经典蓝 · Studio Blue',
    nameEn: 'Studio Blue',
    shortNameZh: '经典蓝',
    shortNameEn: 'Studio Blue',
    isOfficial: true,
    descZh: 'Anki Studio 官方固定品牌色',
    descEn: 'Official Anki Studio brand blue',
    swatchHex: '#3076C3',
    light: {
      brand: '#3076C3',
      brandHover: '#2663A7',
      brandRgb: '48, 118, 195',
      brandText: '#235F9F',
      brandSoft: '#ECF3FA',
      brandSoftStrong: '#D9E8F6',
      brandSurface: '#F4F8FC',
      brandBorder: '#B0D0EF',
      brandMutedBar: '#BCD7F1',
      heatmap: ['#DBEAF7', '#A6CEF0', '#63A6E4', '#3076C3'],
    },
    dark: {
      brand: '#3E8AD9',
      brandHover: '#4E9BE8',
      brandRgb: '62, 138, 217',
      brandText: '#86C2F8',
      brandSoft: 'rgba(62, 138, 217, 0.16)',
      brandSoftStrong: 'rgba(62, 138, 217, 0.26)',
      brandSurface: '#131F2B',
      brandBorder: 'rgba(134, 194, 248, 0.35)',
      brandMutedBar: '#203448',
      heatmap: ['#182635', '#223E59', '#2E618E', '#3E8AD9'],
    },
  },
  emerald: {
    id: 'emerald',
    nameZh: '松石绿 · Sage',
    nameEn: 'Sage Forest',
    shortNameZh: '松石绿',
    shortNameEn: 'Sage',
    descZh: '护眼温润的自然鼠尾草与松林绿',
    descEn: 'Soothing botanical sage green',
    swatchHex: '#2F9461',
    light: {
      brand: '#2F9461',
      brandHover: '#267E52',
      brandRgb: '47, 148, 97',
      brandText: '#23754B',
      brandSoft: '#EAF6F0',
      brandSoftStrong: '#D5EDE0',
      brandSurface: '#F3FAF6',
      brandBorder: '#AEDCC3',
      brandMutedBar: '#BBE2CD',
      heatmap: ['#DCF1E6', '#A7DDC0', '#66BA90', '#2F9461'],
    },
    dark: {
      brand: '#359A67',
      brandHover: '#41AD77',
      brandRgb: '53, 154, 103',
      brandText: '#72D5A1',
      brandSoft: 'rgba(53, 154, 103, 0.16)',
      brandSoftStrong: 'rgba(53, 154, 103, 0.26)',
      brandSurface: '#15231C',
      brandBorder: 'rgba(114, 213, 161, 0.35)',
      brandMutedBar: '#213A2E',
      heatmap: ['#192C23', '#234536', '#2C6A4E', '#39A56F'],
    },
  },
  cyan: {
    id: 'cyan',
    nameZh: '雾海蓝 · Ocean',
    nameEn: 'Nordic Ocean',
    shortNameZh: '雾海蓝',
    shortNameEn: 'Ocean',
    descZh: '清澈克制的北欧深海蓝',
    descEn: 'Clear, balanced cerulean blue',
    swatchHex: '#2B7ABF',
    light: {
      brand: '#2B7ABF',
      brandHover: '#2267A4',
      brandRgb: '43, 122, 191',
      brandText: '#1F619B',
      brandSoft: '#EBF4FC',
      brandSoftStrong: '#D6E8F8',
      brandSurface: '#F3F8FD',
      brandBorder: '#ADD1F1',
      brandMutedBar: '#BCD7F1',
      heatmap: ['#DCEBFA', '#A7CDF1', '#67A5E0', '#2B7ABF'],
    },
    dark: {
      brand: '#3783C6',
      brandHover: '#4693D6',
      brandRgb: '55, 131, 198',
      brandText: '#7EC1F8',
      brandSoft: 'rgba(55, 131, 198, 0.16)',
      brandSoftStrong: 'rgba(55, 131, 198, 0.26)',
      brandSurface: '#15202B',
      brandBorder: 'rgba(126, 193, 248, 0.35)',
      brandMutedBar: '#223548',
      heatmap: ['#192836', '#244059', '#2F6089', '#3E8DD2'],
    },
  },
  rose: {
    id: 'rose',
    nameZh: '赤陶粉 · Rose',
    nameEn: 'Dusty Rose',
    shortNameZh: '赤陶粉',
    shortNameEn: 'Rose',
    descZh: '柔和低饱和的复古赤陶灰粉',
    descEn: 'Warm, muted terracotta rose',
    swatchHex: '#C44D6C',
    light: {
      brand: '#C44D6C',
      brandHover: '#AE3F5C',
      brandRgb: '196, 77, 108',
      brandText: '#A43955',
      brandSoft: '#FCEEF2',
      brandSoftStrong: '#F7DCE4',
      brandSurface: '#FDF5F7',
      brandBorder: '#EEB6C5',
      brandMutedBar: '#EDBFCC',
      heatmap: ['#F9DFE6', '#EEB3C4', '#DC7C97', '#C44D6C'],
    },
    dark: {
      brand: '#CB5775',
      brandHover: '#D96784',
      brandRgb: '203, 87, 117',
      brandText: '#F398B0',
      brandSoft: 'rgba(203, 87, 117, 0.16)',
      brandSoftStrong: 'rgba(203, 87, 117, 0.26)',
      brandSurface: '#28171C',
      brandBorder: 'rgba(243, 152, 176, 0.35)',
      brandMutedBar: '#41252E',
      heatmap: ['#2F1B22', '#4C2835', '#7A3B50', '#D15E7C'],
    },
  },
  amber: {
    id: 'amber',
    nameZh: '琥珀金 · Ochre',
    nameEn: 'Warm Ochre',
    shortNameZh: '琥珀金',
    shortNameEn: 'Ochre',
    descZh: '知性温暖的秋日琥珀与羊皮纸色调',
    descEn: 'Editorial warm amber & bronze',
    swatchHex: '#C27429',
    light: {
      brand: '#C27429',
      brandHover: '#AB631E',
      brandRgb: '194, 116, 41',
      brandText: '#9B5818',
      brandSoft: '#FDF3E8',
      brandSoftStrong: '#F9E4CD',
      brandSurface: '#FEF8F2',
      brandBorder: '#F0C699',
      brandMutedBar: '#ECD0B1',
      heatmap: ['#F9E7D3', '#EEC59A', '#DA995A', '#C27429'],
    },
    dark: {
      brand: '#CA7F33',
      brandHover: '#D88E43',
      brandRgb: '202, 127, 51',
      brandText: '#F4B675',
      brandSoft: 'rgba(202, 127, 51, 0.16)',
      brandSoftStrong: 'rgba(202, 127, 51, 0.26)',
      brandSurface: '#271E14',
      brandBorder: 'rgba(244, 182, 117, 0.35)',
      brandMutedBar: '#402F1E',
      heatmap: ['#2E2216', '#4B351F', '#79532D', '#D2873B'],
    },
  },
  teal: {
    id: 'teal',
    nameZh: '峡湾青 · Fjord',
    nameEn: 'Fjord Teal',
    shortNameZh: '峡湾青',
    shortNameEn: 'Fjord',
    descZh: '冷静理性的蓝绿平衡色',
    descEn: 'Serene, analytical blue-green',
    swatchHex: '#23868C',
    light: {
      brand: '#23868C',
      brandHover: '#1B7277',
      brandRgb: '35, 134, 140',
      brandText: '#18696E',
      brandSoft: '#EAF6F6',
      brandSoftStrong: '#D3EBED',
      brandSurface: '#F2FAFA',
      brandBorder: '#A5D7DB',
      brandMutedBar: '#B5DDE0',
      heatmap: ['#D8EFF0', '#A2D7DB', '#5EB0B6', '#23868C'],
    },
    dark: {
      brand: '#2A9298',
      brandHover: '#35A3AA',
      brandRgb: '42, 146, 152',
      brandText: '#6CD2D8',
      brandSoft: 'rgba(42, 146, 152, 0.16)',
      brandSoftStrong: 'rgba(42, 146, 152, 0.26)',
      brandSurface: '#142325',
      brandBorder: 'rgba(108, 210, 216, 0.35)',
      brandMutedBar: '#1E393C',
      heatmap: ['#182B2D', '#224448', '#2B686E', '#339CA3'],
    },
  },
  violet: {
    id: 'violet',
    nameZh: '暮光紫 · Iris',
    nameEn: 'Twilight Iris',
    shortNameZh: '暮光紫',
    shortNameEn: 'Iris',
    descZh: '优雅静谧的创意工作室紫晶色',
    descEn: 'Refined, creative studio violet',
    swatchHex: '#7A50B6',
    light: {
      brand: '#7A50B6',
      brandHover: '#6941A1',
      brandRgb: '122, 80, 182',
      brandText: '#623C98',
      brandSoft: '#F3EEFA',
      brandSoftStrong: '#E5DBF5',
      brandSurface: '#F8F5FC',
      brandBorder: '#CCB7ED',
      brandMutedBar: '#D4C3EE',
      heatmap: ['#E9E0F7', '#C7B1EB', '#9C7AD4', '#7A50B6'],
    },
    dark: {
      brand: '#865EC2',
      brandHover: '#946ED0',
      brandRgb: '134, 94, 194',
      brandText: '#BFA0F2',
      brandSoft: 'rgba(134, 94, 194, 0.16)',
      brandSoftStrong: 'rgba(134, 94, 194, 0.26)',
      brandSurface: '#1F182A',
      brandBorder: 'rgba(191, 160, 242, 0.35)',
      brandMutedBar: '#332645',
      heatmap: ['#261C34', '#3B2B54', '#593E82', '#8D65C9'],
    },
  },
  slate: {
    id: 'slate',
    nameZh: '石墨灰 · Graphite',
    nameEn: 'Graphite Slate',
    shortNameZh: '石墨灰',
    shortNameEn: 'Graphite',
    descZh: '纯粹无干扰的 Notion 极简黑白灰风格',
    descEn: 'Distraction-free monochrome slate',
    swatchHex: '#475569',
    light: {
      brand: '#475569',
      brandHover: '#334155',
      brandRgb: '71, 85, 105',
      brandText: '#334155',
      brandSoft: '#EEF2F6',
      brandSoftStrong: '#E2E8F0',
      brandSurface: '#F5F7FA',
      brandBorder: '#CBD5E1',
      brandMutedBar: '#CBD5E1',
      heatmap: ['#E2E8F0', '#CBD5E1', '#94A3B8', '#475569'],
    },
    dark: {
      brand: '#64748B',
      brandHover: '#7788A1',
      brandRgb: '100, 116, 139',
      brandText: '#CBD5E1',
      brandSoft: 'rgba(100, 116, 139, 0.18)',
      brandSoftStrong: 'rgba(100, 116, 139, 0.28)',
      brandSurface: '#1B1F26',
      brandBorder: 'rgba(203, 213, 225, 0.35)',
      brandMutedBar: '#2D3542',
      heatmap: ['#21262F', '#323A47', '#4B5668', '#76879F'],
    },
  },
};

export const ACCENT_COLOR_LIST: AccentThemeMeta[] = [
  ACCENT_THEMES.indigo,
  ACCENT_THEMES.emerald,
  ACCENT_THEMES.cyan,
  ACCENT_THEMES.rose,
  ACCENT_THEMES.amber,
  ACCENT_THEMES.teal,
  ACCENT_THEMES.violet,
  ACCENT_THEMES.slate,
];

export function isValidAccentColor(val: unknown): val is AccentColor {
  return typeof val === 'string' && val in ACCENT_THEMES;
}

export function getAccentScale(accent: AccentColor, theme: ThemeMode): AccentScale {
  const meta = ACCENT_THEMES[accent] || ACCENT_THEMES.indigo;
  const isDark = theme === 'dark' || theme === 'oled';
  return isDark ? meta.dark : meta.light;
}

/**
 * Computes inline CSS variable declarations for the root container and documentElement
 * so that all descendant components and modals automatically inherit the active theme.
 */
export function buildThemeCssVars(accent: AccentColor, theme: ThemeMode): Record<string, string> {
  const s = getAccentScale(accent, theme);
  const isDark = theme === 'dark' || theme === 'oled';

  return {
    '--brand': s.brand,
    '--brand-hover': s.brandHover,
    '--brand-rgb': s.brandRgb,
    '--brand-text': s.brandText,
    '--brand-soft': s.brandSoft,
    '--brand-soft-strong': s.brandSoftStrong,
    '--brand-surface': s.brandSurface,
    '--brand-border': s.brandBorder,
    '--brand-muted-bar': s.brandMutedBar,
    '--heatmap-0': isDark ? (theme === 'oled' ? '#191920' : '#25252E') : '#ECECEF',
    '--heatmap-1': s.heatmap[0],
    '--heatmap-2': s.heatmap[1],
    '--heatmap-3': s.heatmap[2],
    '--heatmap-4': s.heatmap[3],
    // Calibrated low-glare semantic colors (Again / Hard / Good / Easy)
    '--status-danger': isDark ? '#E05A66' : '#D44854',
    '--status-danger-soft': isDark ? 'rgba(224, 90, 102, 0.16)' : '#FCECEE',
    '--status-warning': isDark ? '#E0933E' : '#CC7A25',
    '--status-warning-soft': isDark ? 'rgba(224, 147, 62, 0.16)' : '#FDF3E7',
    '--status-success': isDark ? '#3FAE78' : '#2F9461',
    '--status-success-soft': isDark ? 'rgba(63, 174, 120, 0.16)' : '#EAF6F0',
    '--status-info': isDark ? '#4693D6' : '#2B7ABF',
    '--status-info-soft': isDark ? 'rgba(70, 147, 214, 0.16)' : '#EBF4FC',
  };
}
