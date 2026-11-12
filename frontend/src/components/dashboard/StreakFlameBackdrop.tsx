import React, { useId } from 'react';

/**
 * 连胜区块的背景火焰插画与暖色氛围柔光（纯装饰）。
 * 顶部预留充足呼吸留白（不顶到卡片上沿），采用外焰柔光 + 主外焰 + 内焰芯双层叠加。
 */
export const StreakFlameBackdrop: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const uid = useId().replace(/:/g, '');
  const outerGradId = `streak-flame-outer-${uid}`;
  const innerGradId = `streak-flame-inner-${uid}`;
  const glowGradId = `streak-flame-glow-${uid}`;

  return (
    <svg
      className="pointer-events-none absolute bottom-0 right-2 hidden h-[138px] w-[204px] lg:block"
      viewBox="0 0 220 156"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowGradId} cx="0.68" cy="0.68" r="0.65">
          <stop offset="0%" stopColor="#FF9A3C" stopOpacity={isDark ? '0.20' : '0.15'} />
          <stop offset="55%" stopColor="#FFB86C" stopOpacity={isDark ? '0.07' : '0.05'} />
          <stop offset="100%" stopColor="#FFB86C" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={outerGradId} x1="0.5" y1="1" x2="0.5" y2="0.08">
          <stop offset="0%" stopColor="#FF8A2B" stopOpacity="0.05" />
          <stop offset="28%" stopColor="#FF9436" stopOpacity={isDark ? '0.38' : '0.28'} />
          <stop offset="72%" stopColor="#FFB366" stopOpacity={isDark ? '0.26' : '0.19'} />
          <stop offset="100%" stopColor="#FFD099" stopOpacity={isDark ? '0.10' : '0.07'} />
        </linearGradient>

        <linearGradient id={innerGradId} x1="0.5" y1="1" x2="0.5" y2="0.22">
          <stop offset="0%" stopColor="#FF7A1A" stopOpacity="0.04" />
          <stop offset="35%" stopColor="#FF8C2E" stopOpacity={isDark ? '0.34' : '0.24'} />
          <stop offset="85%" stopColor="#FFB060" stopOpacity={isDark ? '0.18' : '0.14'} />
          <stop offset="100%" stopColor="#FFD19A" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 右侧暖色环境柔光 */}
      <ellipse cx="148" cy="104" rx="106" ry="76" fill={`url(#${glowGradId})`} />

      {/* 外层主火苗剪影（顶部留白 y=20，不顶卡片上边框） */}
      <path
        fill={`url(#${outerGradId})`}
        d="M142 156 C 108 156 93 138 95 112 C 96 92 110 74 119 56 C 123 48 126 39 127 30 C 133 38 137 48 139 57 C 146 43 153 30 155 18 C 168 38 178 64 179 88 C 183 81 186 73 187 65 C 194 80 198 98 196 116 C 194 140 176 156 142 156 Z"
      />

      {/* 内层暖芯火苗 */}
      <path
        fill={`url(#${innerGradId})`}
        d="M145 156 C 122 156 112 141 114 121 C 116 105 127 90 135 74 C 140 82 143 89 144 96 C 150 83 154 70 156 58 C 166 76 174 96 173 118 C 172 141 160 156 145 156 Z"
      />
    </svg>
  );
};
