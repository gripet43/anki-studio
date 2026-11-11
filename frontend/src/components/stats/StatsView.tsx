import React, { useMemo } from 'react';
import { translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { getAccentScale } from '../../utils/themeTokens';

export const StatsView: React.FC = () => {
  const {
    advancedStats,
    dashboard,
    theme,
    accentColor,
    resolvedLang,
    isInitialSyncing,
    syncing,
    syncJustFinished,
  } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const isSyncPending = isInitialSyncing || syncing;

  const accentScale = getAccentScale(accentColor, theme);
  const brandHex = accentScale.brand;

  const cardSurface =
    theme === 'oled'
      ? 'bg-[#111216] border-[#22232B] text-white'
      : theme === 'dark'
      ? 'bg-[#1A1B21] border-[#2A2C36] text-white'
      : 'bg-white border-[#EAECEF] text-[#1D1D1F]';

  const subText = 'text-[#636366] dark:text-[#8E8E93]';

  const {
    maturityBreakdown,
    forecast30d,
    retentionCurve,
    hourlyDistribution,
    answerButtons,
    trueRetention,
    dailyLoad,
  } = advancedStats;
  const maxForecast = Math.max(1, ...forecast30d.map((d) => d.total));
  const maxHourly = Math.max(1, ...hourlyDistribution.map((h) => h.count));

  const buttonRows = [
    { key: 'again', value: answerButtons.again, label: t('rateAgain'), color: 'var(--status-danger)' },
    { key: 'hard', value: answerButtons.hard, label: t('rateHard'), color: 'var(--status-warning)' },
    { key: 'good', value: answerButtons.good, label: t('rateGood'), color: brandHex },
    { key: 'easy', value: answerButtons.easy, label: t('rateEasy'), color: 'var(--status-success)' },
  ];
  const maxButton = Math.max(1, ...buttonRows.map((r) => r.value));
  const againPct =
    answerButtons.total > 0
      ? Math.round((answerButtons.again / answerButtons.total) * 100)
      : 0;
  const formatRate = (rate: number, total: number) => (total > 0 ? `${rate}%` : '--');

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
      return t('statsNoHourlyData');
    }
    const sorted = [...activeHours].sort((a, b) => b.count - a.count);
    const top = sorted[0];
    return t('statsPeakHourSummary', {
      hour: top.hour,
      count: top.count.toLocaleString(),
      acc: top.accuracy,
    });
  }, [hourlyDistribution, resolvedLang]);

  return (
    <div className="flex-1 h-full overflow-y-auto px-8 py-6 pb-20 space-y-6 select-none">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">
            {t('statsPageTitle')}
          </h1>
          {isSyncPending ? (
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--status-warning)] animate-ping" />
              <span className="text-[12px] font-medium text-[var(--status-warning)] tracking-tight">
                {syncing ? t('statsSyncingCloud') : t('statsCalculatingLocal')}
              </span>
            </div>
          ) : syncJustFinished ? (
            <div className="flex items-center gap-1.5 mt-1 animate-in fade-in duration-300">
              <span className="text-[12px] font-semibold text-[var(--status-success)] tracking-tight">
                ✓ {t('syncCompleted')}
              </span>
            </div>
          ) : (
            <p className={`text-[13px] ${subText} mt-0.5`}>
              {t('statsPageSub')}
            </p>
          )}
        </div>

        <div className={`px-4 py-2 rounded-xl border text-[12px] font-medium shadow-xs ${cardSurface} ${syncJustFinished ? 'animate-sync-reveal' : ''}`}>
          {t('statsTotalReviewsLabel')}{' '}
          <span className="font-bold text-[var(--brand-text)]">
            {dashboard.heatmap.totalYearReviews.toLocaleString()}
          </span>
          {' · '}
          {t('statsAvgRetentionLabel')}{' '}
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
                {t('statsForecast30dTitle')}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>
                {t('statsForecast30dSub')}
                <span className="ms-2 font-semibold text-[var(--brand-text)]">
                  · {t('dailyAvg')} {dailyLoad}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: brandHex }} />
                <span>{t('statsMatureCardsLegend')}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: accentScale.heatmap[1] }} />
                <span>{t('statsYoungCardsLegend')}</span>
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

          {/* Decoupled X-Axis Timeline Row */}
          <div className="pt-2 px-1 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
            <span className="font-semibold text-[var(--brand-text)]">{t('todayLabel')}</span>
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
              {t('statsMaturityTitle')}
            </h2>
            <p className={`text-[11px] ${subText} mt-0.5`}>
              {t('statsMaturitySub', { total: maturityBreakdown.total.toLocaleString() })}
            </p>
          </div>

          <div className="my-4 space-y-3">
            {/* Seamless 100% full-width stacked progress bar */}
            <div
              role="img"
              aria-label={t('statsMaturityTitle')}
              className="w-full h-3 rounded-full overflow-hidden flex bg-[#ECECF2] dark:bg-[#2A2C36]"
            >
              <div
                style={{ width: `${maturePct}%` }}
                className="bg-[var(--status-success)] transition-all"
                title={`${t('statsMatureCardsLegend')}: ${maturityBreakdown.mature} (${formatPctLabel(maturityBreakdown.mature, maturePct)})`}
              />
              <div
                style={{ width: `${youngPct}%`, backgroundColor: brandHex }}
                className="transition-all"
                title={`${t('statsYoungCardsLegend')}: ${maturityBreakdown.young} (${formatPctLabel(maturityBreakdown.young, youngPct)})`}
              />
              <div
                style={{ width: `${learnPct}%` }}
                className="bg-[var(--status-warning)] transition-all"
                title={`${t('statsLearningCardsLegend')}: ${maturityBreakdown.learning} (${formatPctLabel(maturityBreakdown.learning, learnPct)})`}
              />
              <div
                style={{ width: `${newPct}%` }}
                className="bg-[var(--status-info)] transition-all"
                title={`${t('statsUnseenCardsLegend')}: ${maturityBreakdown.newCards} (${formatPctLabel(maturityBreakdown.newCards, newPct)})`}
              />
              <div
                style={{ width: `${suspPct}%` }}
                className="bg-[#FF9F0A] transition-all"
                title={`${t('statusSuspended')}: ${maturityBreakdown.suspended} (${formatPctLabel(maturityBreakdown.suspended, suspPct)})`}
              />
              <div
                style={{ width: `${buriedPct}%` }}
                className="bg-[#8E8E93]/70 transition-all"
                title={`${t('statusBuried')}: ${maturityBreakdown.buried || 0} (${formatPctLabel(maturityBreakdown.buried || 0, buriedPct)})`}
              />
            </div>

            <div className="space-y-2 pt-1 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-success)]" />
                  <span>{t('statsMatureCardsLegend')}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.mature.toLocaleString()} ({formatPctLabel(maturityBreakdown.mature, maturePct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: brandHex }} />
                  <span>{t('statsYoungCardsLegend')}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.young.toLocaleString()} ({formatPctLabel(maturityBreakdown.young, youngPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-info)]" />
                  <span>{t('statsUnseenCardsLegend')}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.newCards.toLocaleString()} ({formatPctLabel(maturityBreakdown.newCards, newPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--status-warning)]" />
                  <span>{t('statsLearningCardsLegend')}</span>
                </span>
                <span className="font-semibold font-mono">
                  {maturityBreakdown.learning.toLocaleString()} ({formatPctLabel(maturityBreakdown.learning, learnPct)})
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF9F0A]" />
                  <span>{t('statusSuspended')}</span>
                </span>
                <span className="font-medium font-mono text-[#FF9F0A]">
                  {maturityBreakdown.suspended.toLocaleString()} ({formatPctLabel(maturityBreakdown.suspended, suspPct)})
                </span>
              </div>

              <div className="flex items-center justify-between text-[#8E8E93]">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#8E8E93]" />
                  <span>{t('statusBuried')}</span>
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
                {t('statsRetentionCurveTitle')}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>
                {t('statsRetentionCurveSub')}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-semibold">
              {t('retentionRate')} {latestRetention}
            </span>
          </div>

          {/* Bars Container */}
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
                  tabIndex={0}
                  role="img"
                  aria-label={`${pt.period}: ${pt.reviews > 0 ? `${pt.retentionRate}%` : '--'} (${pt.reviews})`}
                  title={`${pt.period}: ${pt.retentionRate}% (${pt.reviews})`}
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 rounded-sm"
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

          {/* Decoupled Timeline Axis */}
          <div className="pt-2 px-2 flex items-center justify-between text-[10px] text-[#8E8E93] border-t border-black/[0.04] dark:border-white/[0.06] mt-2">
            <span>-12w</span>
            <span>-9w</span>
            <span>-6w</span>
            <span>-3w</span>
            <span className="font-semibold text-[var(--brand-text)]">{t('weekStudied')}</span>
          </div>
        </div>

        {/* 4. 24-Hour Study Time Distribution */}
        <div className={`col-span-6 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-bold">
                {t('statsHourlyTitle')}
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
                  tabIndex={0}
                  role="img"
                  aria-label={`${item.hour}: ${item.count} (${item.accuracy}%)`}
                  title={`${item.hour} - ${item.count} (${item.accuracy}%)`}
                  className="flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 rounded-sm"
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

      {/* Third Row: Anki official "Answer Buttons" + "True Retention" metrics */}
      <section className="grid grid-cols-12 gap-4">
        {/* 5. Answer Buttons — reveals card-quality and scheduling problems */}
        <div className={`col-span-6 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[15px] font-bold">
                {t('statsAnswerButtonsTitle')}
              </h2>
              <p className={`text-[11px] ${subText} mt-0.5`}>
                {t('statsAnswerButtonsSub', { total: answerButtons.total.toLocaleString() })}
              </p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[var(--status-danger-soft)] text-[var(--status-danger)] text-[11px] font-semibold">
              {t('rateAgain')} {againPct}%
            </span>
          </div>

          <div className="space-y-2.5">
            {buttonRows.map((row) => {
              const pct =
                answerButtons.total > 0
                  ? Math.round((row.value / answerButtons.total) * 100)
                  : 0;
              return (
                <div key={row.key} className="flex items-center gap-3 text-[11px]">
                  <span className={`w-[78px] shrink-0 ${subText}`}>{row.label}</span>
                  <div
                    role="progressbar"
                    aria-valuenow={row.value}
                    aria-valuemin={0}
                    aria-valuemax={maxButton}
                    aria-label={`${row.label}: ${row.value.toLocaleString()} (${pct}%)`}
                    className="flex-1 h-2 rounded-full bg-[#ECECF2] dark:bg-[#2A2C36] overflow-hidden"
                  >
                    <div
                      style={{ width: `${(row.value / maxButton) * 100}%`, backgroundColor: row.color }}
                      className="h-full rounded-full transition-all"
                    />
                  </div>
                  <span className="w-[76px] text-end font-mono font-semibold whitespace-nowrap">
                    {row.value.toLocaleString()} <span className={subText}>({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 grid grid-cols-2 gap-3 text-[11px] border-t border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <span className={subText}>{t('statsYoungPassRateLabel')}</span>
              <span className="font-semibold font-mono">
                {formatRate(answerButtons.young.rate, answerButtons.young.total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={subText}>{t('statsMaturePassRateLabel')}</span>
              <span className="font-semibold font-mono">
                {formatRate(answerButtons.mature.rate, answerButtons.mature.total)}
              </span>
            </div>
          </div>
        </div>

        {/* 6. True Retention — Anki's official FSRS calibration metric */}
        <div className={`col-span-6 rounded-2xl border p-6 flex flex-col justify-between shadow-xs ${cardSurface}`}>
          <div>
            <h2 className="text-[15px] font-bold">
              {t('statsTrueRetentionTitle')}
            </h2>
            <p className={`text-[11px] ${subText} mt-0.5`}>
              {t('statsTrueRetentionSub')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            {[
              { key: 'last30d', title: t('statsLast30dLabel'), data: trueRetention.last30d },
              { key: 'allTime', title: t('statsAllTimeLabel'), data: trueRetention.allTime },
            ].map((block) => (
              <div
                key={block.key}
                className="rounded-xl border border-black/[0.05] dark:border-white/[0.08] px-4 py-3"
              >
                <div className={`text-[11px] ${subText}`}>{block.title}</div>
                <div className="text-[26px] leading-tight font-bold font-mono" style={{ color: brandHex }}>
                  {formatRate(block.data.overall.rate, block.data.overall.total)}
                </div>
                <div className={`text-[10px] ${subText} mt-0.5`}>
                  {block.data.overall.pass.toLocaleString()} / {block.data.overall.total.toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-[11px] pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <span className={subText}>{t('statsYoungCardsLegend')} (30d / All)</span>
              <span className="font-semibold font-mono whitespace-nowrap">
                {formatRate(trueRetention.last30d.young.rate, trueRetention.last30d.young.total)}
                {' / '}
                {formatRate(trueRetention.allTime.young.rate, trueRetention.allTime.young.total)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={subText}>{t('statsMatureCardsLegend')} (30d / All)</span>
              <span className="font-semibold font-mono whitespace-nowrap">
                {formatRate(trueRetention.last30d.mature.rate, trueRetention.last30d.mature.total)}
                {' / '}
                {formatRate(trueRetention.allTime.mature.rate, trueRetention.allTime.mature.total)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
