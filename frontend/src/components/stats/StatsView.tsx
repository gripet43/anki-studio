import React, { useMemo } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const StatsView: React.FC = () => {
  const { advancedStats, dashboard, theme, accentColor, resolvedLang, isInitialSyncing, syncing, syncJustFinished } = useAppStore();
  const isZh = resolvedLang === 'zh-CN';
  const isSyncPending = isInitialSyncing || syncing;

  const isDark = theme === 'dark' || theme === 'oled';
  const accentScale = getAccentScale(accentColor, theme);
  const brandHex = accentScale.brand;

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-white'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-white'
      : 'bg-white border-[#EAECEF] text-[#1D1D1F]';

  const subText = 'text-[#8E8E93]';

  const { maturityBreakdown, forecast30d, retentionCurve, hourlyDistribution } = advancedStats;
  const maxForecast = Math.max(1, ...forecast30d.map((d) => d.total));
  const maxHourly = Math.max(1, ...hourlyDistribution.map((h) => h.count));

  const totalCards = Math.max(1, maturityBreakdown.total);
  const maturePct = (maturityBreakdown.mature / totalCards) * 100;
  const youngPct = (maturityBreakdown.young / totalCards) * 100;
  const learnPct = (maturityBreakdown.learning / totalCards) * 100;
  const newPct = (maturityBreakdown.newCards / totalCards) * 100;
  const suspPct = (maturityBreakdown.suspended / totalCards) * 100;
  const buriedPct = ((maturityBreakdown.buried || 0) / totalCards) * 100;

  const formatPctLabel = (count: number, rawPct: number) => {
    if (count === 0) return '0%';
    const rounded = Math.round(rawPct);
    if (rounded === 0) return '<1%';
    return `${rounded}%`;
  };

  // Dynamic retention baseline scaling so that variations (e.g. 78% vs 91%) are visually distinct
  const { retentionBaseline, latestRetention } = useMemo(() => {
    const valid = retentionCurve.filter((p) => p.reviews > 0);
    const minRate = valid.length > 0 ? Math.min(...valid.map((p) => p.retentionRate)) : 75;
    const baseline = Math.max(0, Math.min(70, Math.floor((minRate - 8) / 10) * 10));

    const lastPoint = retentionCurve[retentionCurve.length - 1];
    const latest =
      lastPoint && lastPoint.reviews > 0
        ? `${lastPoint.retentionRate}%`
        : dashboard.heatmap.retentionRate > 0
        ? `${dashboard.heatmap.retentionRate}%`
        : '0%';

    return { retentionBaseline: baseline, latestRetention: latest };
  }, [retentionCurve, dashboard.heatmap.retentionRate]);

  const peakHourSummary = useMemo(() => {
    const activeHours = hourlyDistribution.filter((h) => h.count > 0);
    if (activeHours.length === 0) {
      return isZh ? '暂无足够答题时段记录' : 'No hourly review data yet';
    }
    const sorted = [...activeHours].sort((a, b) => b.count - a.count);
    const top = sorted[0];
    return isZh
      ? `最活跃时段：${top.hour}（累计 ${top.count.toLocaleString()} 次复习，正确率 ${top.accuracy}%）`
      : `Peak hour: ${top.hour} (${top.count.toLocaleString()} reviews, ${top.accuracy}% accuracy)`;
  }, [hourlyDistribution, isZh]);

  return (
    <div className="flex-1 h-full overflow-y-auto px-8 py-6 pb-20 space-y-6 select-none">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            {isZh ? '学习统计与 FSRS 记忆分析' : 'Study Statistics & FSRS Analytics'}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                {isZh ? '正在从云端计算 FSRS 记忆留存与预测曲线...' : 'Syncing & calculating FSRS memory retention curves...'}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-in fade-in duration-300">
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                {isZh ? '✓ FSRS 算法矩阵已对齐最新数据' : '✓ FSRS algorithmic matrix updated'}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5`}>
              {isZh
                ? '科学追踪记忆衰减与 FSRS 算法调度状态'
                : 'Track memory decay & FSRS algorithmic scheduling'}
            </p>
          )}
        </div>

        <div className={`px-4 py-2 rounded-xl border text-[12px] font-medium shadow-xs ${cardSurface} ${syncJustFinished ? 'animate-sync-reveal' : ''}`}>
          {isZh ? '累计复习 ' : 'Total Reviews '}
          <span className="font-bold text-[var(--brand-text)]">
            {dashboard.heatmap.totalYearReviews.toLocaleString()}
          </span>
          {' · '}
          {isZh ? '平均留存率 ' : 'Avg Retention '}
          <span className="font-bold text-[var(--status-success)]">{dashboard.heatmap.retentionRate}%</span>
        </div>
      </header>

      {/* Top Row: 30-Day Review Load Forecast (col-span-8) + Card Maturity Breakdown (col-span-4) */}
      <section className="grid grid-cols-12 gap-4">
        {/* 1. 30-Day Review Load Forecast */}
        <div className={`col-span-8 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-bold">
                {isZh ? '未来 30 天复习负载预测 (Forecast)' : '30-Day Review Forecast'}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>
                {isZh
                  ? '基于 FSRS 稳定度计算的每日到期卡片量（深色：成熟卡 · 浅色：年轻卡）'
                  : 'Daily due cards scheduled by FSRS (Dark: Mature · Light: Young)'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: brandHex }} />
                <span>{isZh ? '成熟卡 (≥21天)' : 'Mature (≥21d)'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: accentScale.heatmap[1] }} />
                <span>{isZh ? '年轻卡 (<21天)' : 'Young (<21d)'}</span>
              </span>
            </div>
          </div>

          {/* Unified baseline bar columns */}
          <div className="h-[140px] flex items-end gap-1 px-1">
            {forecast30d.map((day) => {
              const totalH =
                day.total > 0 ? Math.max(8, Math.round((day.total / maxForecast) * 100)) : 3;
              const matureRatio = day.total > 0 ? Math.round((day.mature / day.total) * 100) : 0;
              return (
                <div
                  key={day.dayOffset}
                  title={`${day.label}: ${day.total} (${day.mature} / ${day.young})`}
                  className="flex-1 h-full flex flex-col justify-end items-center group cursor-pointer"
                >
                  <div
                    style={{
                      height: `${totalH}%`,
                      backgroundColor: day.total > 0 ? accentScale.heatmap[1] : accentScale.brandMutedBar,
                    }}
                    className="w-full max-w-[14px] rounded-t-sm overflow-hidden flex flex-col justify-end group-hover:brightness-110 transition-all"
                  >
                    <div
                      style={{ height: `${matureRatio}%`, backgroundColor: brandHex }}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Decoupled X-Axis Timeline Row (Zero text wrapping, zero baseline shifting!) */}
          <div className="pt-2 px-1 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
            <span className="font-semibold text-[var(--brand-text)]">{isZh ? '今天' : 'Today'}</span>
            <span>+5d</span>
            <span>+10d</span>
            <span>+15d</span>
            <span>+20d</span>
            <span>+25d</span>
            <span>+30d</span>
          </div>
        </div>

        {/* 2. Card Maturity Distribution Breakdown */}
        <div className={`col-span-4 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div>
            <h2 className="text-[15px] font-bold">
              {isZh ? '卡片成熟度分布' : 'Card Maturity Breakdown'}
            </h2>
            <p className={`text-[11px] ${subText} mt-0.5`}>
              {isZh
                ? `馆藏共 ${maturityBreakdown.total.toLocaleString()} 张卡片状态占比`
                : `Total ${maturityBreakdown.total.toLocaleString()} cards in collection`}
            </p>
          </div>

          <div className="my-4 space-y-3">
            {/* Seamless 100% full-width stacked progress bar including suspended & buried */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-[#ECECF2] dark:bg-[#2A2C36]">
              <div style={{ width: `${maturePct}%` }} className="bg-[var(--status-success)]" title="Mature" />
              <div style={{ width: `${youngPct}%`, backgroundColor: brandHex }} title="Young" />
              <div style={{ width: `${learnPct}%` }} className="bg-[var(--status-warning)]" title="Learning" />
              <div style={{ width: `${newPct}%` }} className="bg-[var(--status-info)]" title="New" />
              <div style={{ width: `${suspPct}%` }} className="bg-[#FF9F0A]" title="Suspended" />
              <div style={{ width: `${buriedPct}%` }} className="bg-[#8E8E93]/70" title="Buried" />
            </div>

            <div className="space-y-2 pt-1 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-success)]" />
                  <span>{isZh ? '成熟卡 (间隔 ≥ 21天)' : 'Mature (≥ 21d)'}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.mature.toLocaleString()} ({formatPctLabel(maturityBreakdown.mature, maturePct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandHex }} />
                  <span>{isZh ? '年轻卡 (巩固期 < 21天)' : 'Young (< 21d)'}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.young.toLocaleString()} ({formatPctLabel(maturityBreakdown.young, youngPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-info)]" />
                  <span>{isZh ? '未学新卡 (New)' : 'Unseen (New)'}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.newCards.toLocaleString()} ({formatPctLabel(maturityBreakdown.newCards, newPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-warning)]" />
                  <span>{isZh ? '学习中 / 重学中' : 'Learning / Relearning'}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.learning.toLocaleString()} ({formatPctLabel(maturityBreakdown.learning, learnPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF9F0A]" />
                  <span>{isZh ? '已暂停 (Suspended)' : 'Suspended'}</span>
                </span>
                <span className="font-medium font-mono text-[#FF9F0A]">
                  {maturityBreakdown.suspended.toLocaleString()} ({formatPctLabel(maturityBreakdown.suspended, suspPct)})
                </span>
              </div>

              <div className="flex items-center justify-between text-[#8E8E93]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8E8E93]" />
                  <span>{isZh ? '已搁置 (Buried)' : 'Buried'}</span>
                </span>
                <span className="font-medium font-mono">
                  {(maturityBreakdown.buried || 0).toLocaleString()} ({formatPctLabel(maturityBreakdown.buried || 0, buriedPct)})
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row: Historical Retention Curve (col-span-6) + 24-Hour Study Time Distribution (col-span-6) */}
      <section className="grid grid-cols-12 gap-4">
        {/* 3. Historical Retention Curve with Dynamic Baseline & Clean Timeline */}
        <div className={`col-span-6 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold">
                {isZh ? '真实历史留存率与遗忘率曲线' : 'Historical Retention Curve'}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>
                {isZh ? '过去 12 周实际记忆留存率演进' : 'Past 12 weeks retention rate trend'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-semibold">
              {isZh ? `最新留存 ${latestRetention}` : `Latest ${latestRetention}`}
            </span>
          </div>

          {/* Bars Container — Clean, non-overflowing spacing */}
          <div className="h-[135px] flex items-end gap-1.5 px-2">
            {retentionCurve.map((pt, idx) => {
              const barH =
                pt.reviews > 0
                  ? Math.max(
                      14,
                      Math.round(((pt.retentionRate - retentionBaseline) / (100 - retentionBaseline)) * 100)
                    )
                  : 4;
              const isLatest = idx === retentionCurve.length - 1;

              return (
                <div
                  key={pt.period}
                  title={`${pt.period}: ${pt.retentionRate}% (${pt.reviews} 次复习)`}
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer"
                >
                  <span className="text-[9px] font-semibold text-[var(--brand-text)] whitespace-nowrap mb-1 opacity-90 group-hover:opacity-100">
                    {pt.reviews > 0 ? `${pt.retentionRate}%` : '--'}
                  </span>
                  <div
                    style={{
                      height: `${barH}%`,
                      backgroundColor: isLatest ? brandHex : accentScale.heatmap[2],
                    }}
                    className={`w-full max-w-[24px] rounded-t-md transition-all group-hover:brightness-110 ${
                      isLatest ? 'shadow-xs' : 'opacity-85 group-hover:opacity-100'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Decoupled Timeline Axis — No overlapping, no right clipping, no wrapping! */}
          <div className="pt-2 px-2 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
            <span>{isZh ? '12周前' : '12w ago'}</span>
            <span>{isZh ? '9周前' : '9w ago'}</span>
            <span>{isZh ? '6周前' : '6w ago'}</span>
            <span>{isZh ? '3周前' : '3w ago'}</span>
            <span className="font-semibold text-[var(--brand-text)]">{isZh ? '本周' : 'This week'}</span>
          </div>
        </div>

        {/* 4. 24-Hour Study Time Distribution */}
        <div className={`col-span-6 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold">
                {isZh ? '24 小时答题时段热力分布' : '24-Hour Activity Distribution'}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>{peakHourSummary}</p>
            </div>
          </div>

          {/* Bars Container */}
          <div className="h-[135px] flex items-end gap-1 px-2">
            {hourlyDistribution.map((item) => {
              const hPct =
                item.count > 0 ? Math.max(8, Math.round((item.count / maxHourly) * 100)) : 3;
              const isPeak = item.count > 0 && item.count >= maxHourly * 0.65;
              return (
                <div
                  key={item.hour}
                  title={`${item.hour} - ${item.count} 次 (${item.accuracy}%)`}
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer"
                >
                  <div
                    style={{
                      height: `${hPct}%`,
                      backgroundColor: isPeak ? brandHex : accentScale.brandMutedBar,
                    }}
                    className="w-full max-w-[12px] rounded-t-sm transition-all group-hover:brightness-110"
                  />
                </div>
              );
            })}
          </div>

          {/* Decoupled Hourly Axis Labels */}
          <div className="pt-2 px-2 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
            <span>00:00</span>
            <span>04:00</span>
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
            <span>23:00</span>
          </div>
        </div>
      </section>
    </div>
  );
};
