import type { Config } from 'tailwindcss';

/*
 * ⚠️ 本文件不参与构建。
 *
 * 项目已迁到 Tailwind v4：`src/index.css` 用 `@import "tailwindcss"` +
 * `@custom-variant dark` + `@theme` 定义一切，全仓库没有任何 `@config` 指令，
 * 所以 v4 的 Vite 插件根本不会读这个文件；`brand-*` / `surface-*` 这类工具类
 * 在 `src/` 里也一次都没用到。留在这里只作历史参考。
 *
 * 真正的设计令牌来源是 `src/themeTokens.ts`（8 套 accent 色板）与
 * `src/index.css` 的 `:root` 变量；改配色请改这两处，不要改这里。
 */

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          white: '#FFFFFF',
          light: '#F4F4F6',
          dark: '#16161A',
          oled: '#0A0A0D',
        },
        // 仅为与本文件的历史值保持一致而保留，非当前品牌色；
        // 当前 indigo = #3076C3（Studio Blue），见 themeTokens.ts。
        brand: {
          indigo: '#3076C3',
          cyan: '#007AFF',
          emerald: '#28CD41',
          rose: '#FF375F',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"PingFang SC"',
          '"Noto Sans SC"',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
};

export default config;
