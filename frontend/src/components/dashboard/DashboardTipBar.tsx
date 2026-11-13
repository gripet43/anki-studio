import React, { useEffect, useState } from 'react';
import { LEARNING_TIPS, resolveTipLocale } from '../../content/learningTips';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { translate } from '../../i18n/translations';

const ROTATE_MS = 10000;

/**
 * 首页 Hero 卡片底部的「学习小贴士」轮播。
 *
 * 设计约束：不新增独立卡片——它嵌在 Hero 卡片内部、用一条发丝分隔线承接，
 * 保持首页「一张 Hero + 牌组 + 图表」的简洁结构。10 秒自动轮播，hover 暂停，
 * 可手动切换或收起（收起偏好写入配置，可在设置 → 外观恢复）。
 */
export const DashboardTipBar: React.FC = () => {
  const { resolvedLang, tipsDismissed } = useAppStore();
  const locale = resolveTipLocale(resolvedLang);
  const [index, setIndex] = useState(() => Math.floor(Math.random() * LEARNING_TIPS.length));
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || tipsDismissed) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % LEARNING_TIPS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused, tipsDismissed]);

  if (tipsDismissed) return null;

  const tip = LEARNING_TIPS[index] ?? LEARNING_TIPS[0];
  const go = (delta: number) =>
    setIndex((prev) => (prev + delta + LEARNING_TIPS.length) % LEARNING_TIPS.length);

  return (
    <div
      className="relative z-10 mt-5 pt-3.5 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center gap-2 min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <svg
        className="w-3.5 h-3.5 shrink-0 text-[var(--brand-text)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
      </svg>

      <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)]">
        {tip.category[locale]}
      </span>

      <p
        key={tip.id}
        className="tip-fade-in min-w-0 flex-1 truncate text-[11.5px] leading-relaxed text-[#6E6E73] dark:text-[#A6A8B6]"
        title={tip.text[locale]}
      >
        {tip.text[locale]}
      </p>

      <div className="flex items-center gap-0.5 shrink-0 text-[#8E8E93]">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous tip"
          className="w-5 h-5 rounded-md flex items-center justify-center cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[10px] tabular-nums w-8 text-center select-none">
          {index + 1}/{LEARNING_TIPS.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next tip"
          className="w-5 h-5 rounded-md flex items-center justify-center cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => appActions.updatePreferences({ tipsDismissed: true })}
          aria-label={translate(resolvedLang, 'close')}
          className="w-5 h-5 ms-0.5 rounded-md flex items-center justify-center cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};
