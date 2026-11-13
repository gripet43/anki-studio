import React, { useEffect, useState } from 'react';
import { LEARNING_TIPS, resolveTipLocale } from '../../content/learningTips';
import { appActions, useAppStore } from '../../stores/useAppStore';
import { translate } from '../../i18n/translations';
import { localDateKey } from '../../utils/localDate';

const ROTATE_MS = 10000;

/**
 * 「我的牌组」标题旁的轻量学习小贴士。
 *
 * 设计：不占独立卡片，一行灰字嵌在牌组标题行右侧；hover 时才浮出两个小图标
 * （换一条 / 今天不再显示）。「今天不再显示」只隐藏当天，明天自动恢复。
 */
export const DashboardTipLine: React.FC = () => {
  const { resolvedLang, tipsHiddenOn } = useAppStore();
  const locale = resolveTipLocale(resolvedLang);
  const today = localDateKey();
  const hiddenToday = tipsHiddenOn === today;

  const [index, setIndex] = useState(() => Math.floor(Math.random() * LEARNING_TIPS.length));
  const [textVisible, setTextVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  const switchTip = (delta: number) => {
    setTextVisible(false);
    window.setTimeout(() => {
      setIndex((prev) => (prev + delta + LEARNING_TIPS.length) % LEARNING_TIPS.length);
      setTextVisible(true);
    }, 160);
  };

  useEffect(() => {
    if (paused || hiddenToday) return;
    const timer = window.setInterval(() => switchTip(1), ROTATE_MS);
    return () => window.clearInterval(timer);
    // switchTip 只依赖函数式 setState，无需进依赖数组
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, hiddenToday]);

  if (hiddenToday) return null;

  const tip = LEARNING_TIPS[index] ?? LEARNING_TIPS[0];

  return (
    <div
      className="group/tip flex items-center gap-1.5 min-w-0 max-w-[620px] flex-1 self-center ms-2.5"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <svg
        className="w-3 h-3 shrink-0 text-[var(--brand-text)] opacity-70"
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

      <span
        className={`min-w-0 truncate text-[11.5px] leading-relaxed text-[#8E8E93] dark:text-[#8E8E93] transition-opacity duration-150 ${
          textVisible ? 'opacity-100' : 'opacity-0'
        }`}
        title={tip.text[locale]}
      >
        {tip.text[locale]}
      </span>

      <span className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 transition-opacity duration-150">
        <button
          type="button"
          onClick={() => switchTip(1)}
          title={translate(resolvedLang, 'tipShuffle')}
          aria-label={translate(resolvedLang, 'tipShuffle')}
          className="w-5 h-5 rounded-md flex items-center justify-center cursor-pointer text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => appActions.updatePreferences({ tipsHiddenOn: today })}
          title={translate(resolvedLang, 'tipHideToday')}
          aria-label={translate(resolvedLang, 'tipHideToday')}
          className="w-5 h-5 rounded-md flex items-center justify-center cursor-pointer text-[#8E8E93] hover:text-[var(--brand-text)] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-colors"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
            <path d="m2 2 20 20" />
          </svg>
        </button>
      </span>
    </div>
  );
};
