import React, { useId } from 'react';

/**
 * 连胜区块的背景火焰插画（纯装饰）。
 *
 * 只保留清晰的火苗剪影：不做高斯模糊、不铺底部径向光晕——
 * 这两样叠在一起会在卡片底边糊出一片橙雾，看着像没擦干净的渐变。
 * 底部靠渐变自身的 stop-opacity 渐隐，被卡片圆角裁切时不会留硬边。
 */
export const StreakFlameBackdrop: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const uid = useId().replace(/:/g, '');
  const flameGradId = `streak-flame-grad-${uid}`;

  return (
    <svg
      className="pointer-events-none absolute bottom-0 right-4 h-[142px] w-[186px]"
      viewBox="0 0 150 150"
      preserveAspectRatio="xMaxYMax meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={flameGradId} x1="0" y1="1" x2="0" y2="0">
          {/* 底部透明 → 中下部最浓 → 顶部略淡，靠渐变本身收边，不用模糊 */}
          <stop offset="0%" stopColor="#FF4D21" stopOpacity="0" />
          <stop offset="30%" stopColor="#FF8A00" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#FFB23C" stopOpacity="0.6" />
        </linearGradient>
      </defs>

      <path
        fill={`url(#${flameGradId})`}
        opacity={isDark ? 0.3 : 0.22}
        d="M70 150 C 34 150 20 136 20 115 C 20 95 34 78 45 58 C 53 45 59 23 61 4 C 70 23 78 34 85 45 C 89 53 92 45 97 34 C 103 23 110 15 114 4 C 127 41 138 73 143 95 C 146 108 146 120 146 127 C 146 140 116 150 70 150 Z"
      />
    </svg>
  );
};
