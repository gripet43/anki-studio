import React, { useId, useMemo, useState } from 'react';
import { translate } from '../../i18n/translations';
import { useAppStore } from '../../stores/useAppStore';
import { getAccentScale, resolveThemeMode } from '../../utils/themeTokens';
import { HoverCard } from '../common/HoverCard';
import {
  ChartTooltipContent,
  ChartTooltipPortal,
  Tooltip,
  type ChartTooltipRow,
} from '../common/Tooltip';
import { CheckIcon } from '../common/Icons';

const RETENTION_SVG_W = 420;
const RETENTION_SVG_H = 140;
const RETENTION_PAD_X = 12;
const RETENTION_PAD_TOP = 14;
const RETENTION_PAD_BOTTOM = 10;

interface PlottedPoint {
  idx: number;
  x: number;
  y: number;
  xPct: number;
  yPct: number;
  period: string;
  reviews: number;
  retentionRate: number;
}

function stripParenthetical(label: string): string {
  return label.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim() || label;
}

function normalizeHourLabel(rawHour: string): string {
  const trimmed = rawHour.trim();
  if (!trimmed) return '--:--';
  return trimmed.includes(':') ? trimmed : `${trimmed.padStart(2, '0')}:00`;
}

function extractHourNumber(rawHour: string): string {
  return normalizeHourLabel(rawHour).replace(/:00$/, '');
}

/**
 * Builds Fritsch-Carlson monotone cubic spline SVG paths (stroke + closed area fill)
 * across contiguous non-empty weeks so the curve stays smooth and never overshoots bounds.
 */
function buildMonotoneSplinePaths(
  segments: PlottedPoint[][],
  bottomY: number,
): Array<{ linePath: string; areaPath: string }> {
  const result: Array<{ linePath: string; areaPath: string }> = [];

  for (const pts of segments) {
    if (pts.length < 2) continue;

    const n = pts.length;
    const slopes: number[] = new Array(n - 1);
    for (let i = 0; i < n - 1; i += 1) {
      const dx = pts[i + 1].x - pts[i].x;
      slopes[i] = dx !== 0 ? (pts[i + 1].y - pts[i].y) / dx : 0;
    }

    const tangents: number[] = new Array(n);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];
    for (let i = 1; i < n - 1; i += 1) {
      if (slopes[i - 1] * slopes[i] <= 0) {
        tangents[i] = 0;
      } else {
        tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
      }
    }

    let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const dx = p1.x - p0.x;
      const cp1x = p0.x + dx / 3;
      const cp1y = Math.max(
        RETENTION_PAD_TOP,
        Math.min(bottomY, p0.y + (tangents[i] * dx) / 3),
      );
      const cp2x = p1.x - dx / 3;
      const cp2y = Math.max(
        RETENTION_PAD_TOP,
        Math.min(bottomY, p1.y - (tangents[i + 1] * dx) / 3),
      );
      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }

    const first = pts[0];
    const last = pts[n - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${bottomY.toFixed(1)} L ${first.x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
    result.push({ linePath, areaPath });
  }

  return result;
}

interface CardInfoHintProps {
  heading: string;
  body: React.ReactNode;
}

const CardInfoHint: React.FC<CardInfoHintProps> = ({ heading, body }) => (
  <HoverCard
    size="sm"
    side="bottom"
    align="start"
    offset={6}
    ariaLabel={heading}
    content={
      <div className="space-y-1 text-[11px] leading-[1.55]">
        <div className="font-semibold text-[var(--text-primary)]">{heading}</div>
        <div className="text-[var(--text-secondary)]">{body}</div>
      </div>
    }
  >
    <button
      type="button"
      aria-label={heading}
      className="w-6 h-6 -my-0.5 rounded-full inline-flex items-center justify-center text-[var(--text-muted)]/75 hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1"
    >
      <svg
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    </button>
  </HoverCard>
);

export const StatsView: React.FC = () => {
  const {
    advancedStats,
    dashboard,
    theme,
    systemDark,
    accentColor,
    resolvedLang,
    isInitialSyncing,
    syncing,
    syncJustFinished,
  } = useAppStore();
  const t = (key: any, params?: Record<string, string | number>) =>
    translate(resolvedLang, key, params);
  const isSyncPending = isInitialSyncing || syncing;

  const resolvedTheme = resolveThemeMode(theme, systemDark);
  const accentScale = getAccentScale(accentColor, resolvedTheme);
  const brandHex = accentScale.brand;
  const retentionGradId = `stats-retention-grad-${useId().replace(/:/g, '')}`;

  // 面板入场错峰：与卡片库 Gallery（LibraryView）共用同一套节奏 ——
  // 每档 28ms、最多 12 档。上限既是防止大屏上一屏几十块面板排队到失去耐心，
  // 也因为视觉上超过 ~330ms 的延迟就不像"一起进来"而像"一个个蹦出来"了。
  // 实际动效定义在 index.css 的 `.stats-panel-enter`（与 `.library-card-enter` 同源）。
  const ENTER_STAGGER_MS = 28;
  const ENTER_STAGGER_MAX = 12;
  const enterDelay = (index: number): React.CSSProperties => ({
    animationDelay: `${Math.min(index, ENTER_STAGGER_MAX) * ENTER_STAGGER_MS}ms`,
  });

  // Interactive hover state unified with ChartTooltipPortal / ChartTooltipContent
  const [hoveredForecastIdx, setHoveredForecastIdx] = useState<number | null>(null);
  const [forecastAnchorEl, setForecastAnchorEl] = useState<HTMLElement | null>(null);
  const [activeMaturityKey, setActiveMaturityKey] = useState<string | null>(null);
  const [hoveredMaturitySeg, setHoveredMaturitySeg] = useState<{
    label: string;
    count: number;
    pctLabel: string;
    tone: ChartTooltipRow['tone'];
  } | null>(null);
  const [maturityAnchorEl, setMaturityAnchorEl] = useState<HTMLElement | null>(null);
  const [hoveredRetentionIdx, setHoveredRetentionIdx] = useState<number | null>(null);
  const [retentionAnchorEl, setRetentionAnchorEl] = useState<HTMLElement | null>(null);
  const [hoveredHourlyIdx, setHoveredHourlyIdx] = useState<number | null>(null);
  const [hourlyAnchorEl, setHourlyAnchorEl] = useState<HTMLElement | null>(null);

  const {
    maturityBreakdown,
    forecast30d,
    retentionCurve,
    hourlyDistribution,
    answerButtons,
    trueRetention,
    dailyLoad,
  } = advancedStats;

  const showSkeleton =
    isSyncPending &&
    maturityBreakdown.total === 0 &&
    answerButtons.total === 0;

  const maxForecast = Math.max(1, dailyLoad, ...forecast30d.map((d) => d.total));
  const dailyLoadLinePct =
    dailyLoad > 0 ? Math.min(92, Math.max(8, (dailyLoad / maxForecast) * 100)) : 0;
  const maxHourly = Math.max(1, ...hourlyDistribution.map((h) => h.count));

  const buttonRows = [
    {
      key: 'again',
      value: answerButtons.again,
      label: t('rateAgain'),
      color: 'var(--status-danger)',
    },
    {
      key: 'hard',
      value: answerButtons.hard,
      label: t('rateHard'),
      color: 'var(--status-warning)',
    },
    {
      key: 'good',
      value: answerButtons.good,
      label: t('rateGood'),
      color: brandHex,
    },
    {
      key: 'easy',
      value: answerButtons.easy,
      label: t('rateEasy'),
      color: 'var(--status-success)',
    },
  ];
  const answerTotal = Math.max(1, answerButtons.total);
  const againPct =
    answerButtons.total > 0
      ? Math.round((answerButtons.again / answerButtons.total) * 100)
      : 0;

  const formatRateFixed = (rate: number, total: number) =>
    total > 0 ? `${Number(rate).toFixed(1)}%` : '--';

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

  // Unified 6-stage lifecycle palette (consistent with Forecast card: Mature=brand, Young=brand-tint;
  // Unseen recedes into neutral track-new so mastered/active progress stands out clearly).
  const maturitySegments: Array<{
    key: string;
    widthPct: number;
    count: number;
    pctLabel: string;
    label: string;
    shortLabel: string;
    swatchStyle: React.CSSProperties;
    textToneClass: string;
    tone: ChartTooltipRow['tone'];
  }> = [
    {
      key: 'mature',
      widthPct: maturePct,
      count: maturityBreakdown.mature,
      pctLabel: formatPctLabel(maturityBreakdown.mature, maturePct),
      label: t('statsMatureCardsLegend'),
      shortLabel: stripParenthetical(t('statsMatureCardsLegend')),
      swatchStyle: { backgroundColor: brandHex },
      textToneClass: 'text-[var(--text-primary)]',
      tone: 'brand',
    },
    {
      key: 'young',
      widthPct: youngPct,
      count: maturityBreakdown.young,
      pctLabel: formatPctLabel(maturityBreakdown.young, youngPct),
      label: t('statsYoungCardsLegend'),
      shortLabel: stripParenthetical(t('statsYoungCardsLegend')),
      swatchStyle: { backgroundColor: accentScale.heatmap[2] },
      textToneClass: 'text-[var(--text-primary)]',
      tone: 'info',
    },
    {
      key: 'learning',
      widthPct: learnPct,
      count: maturityBreakdown.learning,
      pctLabel: formatPctLabel(maturityBreakdown.learning, learnPct),
      label: t('statsLearningCardsLegend'),
      shortLabel: stripParenthetical(t('statsLearningCardsLegend')),
      swatchStyle: { backgroundColor: 'var(--status-warning)' },
      textToneClass: 'text-[var(--text-primary)]',
      tone: 'warning',
    },
    {
      key: 'new',
      widthPct: newPct,
      count: maturityBreakdown.newCards,
      pctLabel: formatPctLabel(maturityBreakdown.newCards, newPct),
      label: t('statsUnseenCardsLegend'),
      shortLabel: t('statsUnseenCardsLegend'),
      swatchStyle: { backgroundColor: 'var(--dashboard-track-new)' },
      textToneClass: 'text-[var(--text-secondary)]',
      tone: 'muted',
    },
    {
      key: 'suspended',
      widthPct: suspPct,
      count: maturityBreakdown.suspended,
      pctLabel: formatPctLabel(maturityBreakdown.suspended, suspPct),
      label: t('statusSuspended'),
      shortLabel: t('statusSuspended'),
      swatchStyle: { backgroundColor: 'var(--status-danger)' },
      textToneClass:
        maturityBreakdown.suspended > 0
          ? 'text-[var(--status-danger-text)]'
          : 'text-[var(--text-muted)]',
      tone: 'danger',
    },
    {
      key: 'buried',
      widthPct: buriedPct,
      count: maturityBreakdown.buried || 0,
      pctLabel: formatPctLabel(maturityBreakdown.buried || 0, buriedPct),
      label: t('statusBuried'),
      shortLabel: t('statusBuried'),
      swatchStyle: { backgroundColor: 'var(--text-muted)', opacity: 0.6 },
      textToneClass: 'text-[var(--text-muted)]',
      tone: 'muted',
    },
  ];

  // Dynamic retention baseline + smooth area-line SVG geometry
  const {
    retentionBaseline,
    latestRetention,
    plottedPoints,
    splineSegments,
    target90YPct,
    hasRetentionData,
  } = useMemo(() => {
    const valid = retentionCurve.filter((p) => p.reviews > 0);
    const minRate =
      valid.length > 0 ? Math.min(...valid.map((p) => p.retentionRate)) : 75;
    const baseline = Math.max(0, Math.min(75, Math.floor((minRate - 6) / 10) * 10));

    const lastPoint = retentionCurve[retentionCurve.length - 1];
    const latest =
      lastPoint && lastPoint.reviews > 0
        ? `${Number(lastPoint.retentionRate).toFixed(1)}%`
        : dashboard.heatmap.retentionRate > 0
        ? `${Number(dashboard.heatmap.retentionRate).toFixed(1)}%`
        : '--';

    const usableW = RETENTION_SVG_W - RETENTION_PAD_X * 2;
    const usableH = RETENTION_SVG_H - RETENTION_PAD_TOP - RETENTION_PAD_BOTTOM;
    const denom = Math.max(1, 100 - baseline);
    const totalPts = Math.max(1, retentionCurve.length);

    const pts: PlottedPoint[] = retentionCurve.map((pt, idx) => {
      const clamped = Math.max(baseline, Math.min(100, pt.retentionRate));
      const x =
        totalPts === 1
          ? RETENTION_SVG_W / 2
          : RETENTION_PAD_X + (idx / (totalPts - 1)) * usableW;
      const y = RETENTION_PAD_TOP + ((100 - clamped) / denom) * usableH;
      return {
        idx,
        x,
        y,
        xPct: (x / RETENTION_SVG_W) * 100,
        yPct: (y / RETENTION_SVG_H) * 100,
        period: pt.period,
        reviews: pt.reviews,
        retentionRate: pt.retentionRate,
      };
    });

    const contiguous: PlottedPoint[][] = [];
    let currentRun: PlottedPoint[] = [];
    for (const p of pts) {
      if (p.reviews > 0) {
        currentRun.push(p);
      } else if (currentRun.length > 0) {
        contiguous.push(currentRun);
        currentRun = [];
      }
    }
    if (currentRun.length > 0) contiguous.push(currentRun);

    const splines = buildMonotoneSplinePaths(
      contiguous,
      RETENTION_SVG_H - RETENTION_PAD_BOTTOM,
    );

    const y90 =
      baseline < 90
        ? ((RETENTION_PAD_TOP + ((100 - 90) / denom) * usableH) / RETENTION_SVG_H) * 100
        : null;

    return {
      retentionBaseline: baseline,
      latestRetention: latest,
      plottedPoints: pts,
      splineSegments: splines,
      target90YPct: y90,
      hasRetentionData: valid.length > 0,
    };
  }, [retentionCurve, dashboard.heatmap.retentionRate]);

  // Peak hour summary (fixes double `:00:00` across all 16 locales)
  const { peakHourTop, peakHourSummary } = useMemo(() => {
    const activeHours = hourlyDistribution.filter((h) => h.count > 0);
    if (activeHours.length === 0) {
      return {
        peakHourTop: null as { hour: string; count: number; accuracy: number } | null,
        peakHourSummary: t('statsNoHourlyData'),
      };
    }
    const sorted = [...activeHours].sort((a, b) => b.count - a.count);
    const top = sorted[0];
    return {
      peakHourTop: {
        hour: normalizeHourLabel(top.hour),
        count: top.count,
        accuracy: top.accuracy,
      },
      peakHourSummary: t('statsPeakHourSummary', {
        hour: extractHourNumber(top.hour),
        count: top.count.toLocaleString(),
        acc: top.accuracy,
      }),
    };
  }, [hourlyDistribution, resolvedLang]);

  const formatForecastLabel = (day: { dayOffset: number; label: string }) => {
    if (day.dayOffset === 0) return t('todayLabel');
    if (/^\+\d+d$/i.test(day.label.trim())) {
      return t('statsDaysLater', { n: day.dayOffset });
    }
    return day.label;
  };

  const formatRetentionPeriod = (idx: number, total: number) => {
    const weeksAgo = Math.max(0, total - 1 - idx);
    return weeksAgo === 0 ? t('statsThisWeekLabel') : t('statsWeeksAgo', { n: weeksAgo });
  };

  const hoveredForecastDay =
    hoveredForecastIdx !== null ? forecast30d[hoveredForecastIdx] ?? null : null;
  const hoveredRetentionPt =
    hoveredRetentionIdx !== null ? retentionCurve[hoveredRetentionIdx] ?? null : null;
  const hoveredHourlyItem =
    hoveredHourlyIdx !== null ? hourlyDistribution[hoveredHourlyIdx] ?? null : null;

  const matureShortLabel = stripParenthetical(t('statsMatureCardsLegend'));
  const youngShortLabel = stripParenthetical(t('statsYoungCardsLegend'));
  const cardBase = 'dashboard-surface rounded-2xl border p-5 sm:p-6 flex flex-col justify-between relative';

  return (
    <div className="flex-1 h-full overflow-y-auto select-none">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-8 py-6 pb-20 space-y-5">
        {/* Minimal Single-Row Header — Zero marketing copy */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-[20px] font-bold tracking-tight text-[var(--text-primary)]">
              {t('statsPageTitle')}
            </h1>
            {isSyncPending ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--status-warning-text)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] motion-safe:animate-ping" />
                <span>{syncing ? t('statsSyncingCloud') : t('statsCalculatingLocal')}</span>
              </span>
            ) : syncJustFinished ? (
              <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--status-success-text)] animate-sync-reveal">
                <CheckIcon className="w-3.5 h-3.5" strokeWidth={2.6} />
                <span>{t('syncCompleted')}</span>
              </span>
            ) : null}
          </div>

          <div
            className={`flex items-center gap-3 text-[12px] text-[var(--text-secondary)] tabular-nums ${
              syncJustFinished ? 'animate-sync-reveal' : ''
            }`}
          >
            <span>
              {t('statsTotalReviewsLabel')}{' '}
              <strong className="font-semibold text-[var(--text-primary)]">
                {dashboard.heatmap.totalYearReviews.toLocaleString()}
              </strong>
            </span>
            <span aria-hidden="true" className="w-px h-3.5 bg-[var(--border-subtle)]" />
            <span>
              {t('statsAvgRetentionLabel')}{' '}
              <strong className="font-semibold text-[var(--status-success-text)]">
                {dashboard.heatmap.retentionRate}%
              </strong>
            </span>
          </div>
        </header>

        {/* Row 1: 30-Day Forecast (8) + Card Maturity (4) */}
        <section className="grid grid-cols-12 gap-4">
          {/* 1. 30-Day Review Load Forecast */}
          <div
            className={`stats-panel-enter col-span-12 xl:col-span-8 ${cardBase}`}
            style={enterDelay(0)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsForecast30dTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsForecast30dTitle')}
                  body={
                    <div className="space-y-1">
                      <p>{t('statsForecast30dSub')}</p>
                      <p className="text-[10.5px] text-[var(--text-muted)]">
                        {t('statsMatureCardsLegend')} · {t('statsYoungCardsLegend')}
                      </p>
                    </div>
                  }
                />
              </div>

              <div className="flex items-center gap-3.5 text-[11.5px] tabular-nums">
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: brandHex }}
                  />
                  <span>{matureShortLabel}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span
                    className="w-2 h-2 rounded-xs shrink-0"
                    style={{ backgroundColor: accentScale.heatmap[2] }}
                  />
                  <span>{youngShortLabel}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11px] font-semibold">
                  {t('dailyAvg')} {dailyLoad}
                </span>
              </div>
            </div>

            {showSkeleton ? (
              <div className="h-[148px] flex items-end gap-1.5 px-1">
                {[55, 72, 42, 65, 80, 48, 35, 62, 50, 44, 68, 58, 36, 46, 52].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className="flex-1 rounded-t-sm animate-skeleton-shimmer opacity-50"
                  />
                ))}
              </div>
            ) : (
              <div
                dir="ltr"
                className="h-[148px] flex items-end gap-1 px-1 relative"
                onMouseLeave={() => {
                  setHoveredForecastIdx(null);
                  setForecastAnchorEl(null);
                }}
              >
                {/* Subtle horizontal gridlines */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 inset-y-0 flex flex-col justify-between"
                >
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div />
                </div>

                {/* Daily average dashed reference line */}
                {dailyLoadLinePct > 0 && (
                  <div
                    aria-hidden="true"
                    style={{ bottom: `${dailyLoadLinePct}%` }}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--brand)]/35 z-10"
                  />
                )}

                <ChartTooltipPortal
                  open={Boolean(hoveredForecastDay && forecastAnchorEl)}
                  anchorEl={forecastAnchorEl}
                  repositionKey={hoveredForecastIdx}
                  onClose={() => {
                    setHoveredForecastIdx(null);
                    setForecastAnchorEl(null);
                  }}
                  content={
                    hoveredForecastDay ? (
                      <ChartTooltipContent
                        eyebrow={`${formatForecastLabel(hoveredForecastDay)} · ${hoveredForecastDay.total.toLocaleString()} ${t('cardsUnit')}`}
                        rows={[
                          {
                            label: t('statsMatureCardsLegend'),
                            value: hoveredForecastDay.mature.toLocaleString(),
                            tone: 'brand',
                          },
                          {
                            label: t('statsYoungCardsLegend'),
                            value: hoveredForecastDay.young.toLocaleString(),
                            tone: 'info',
                          },
                        ]}
                      />
                    ) : null
                  }
                />

                {forecast30d.map((day, idx) => {
                  const totalH =
                    day.total > 0
                      ? Math.max(6, Math.round((day.total / maxForecast) * 100))
                      : 0;
                  const matureRatio =
                    day.total > 0 ? Math.round((day.mature / day.total) * 100) : 0;
                  const hasBoth = day.mature > 0 && day.young > 0;
                  const isHovered = hoveredForecastIdx === idx;
                  return (
                    <div
                      key={day.dayOffset}
                      tabIndex={0}
                      role="img"
                      aria-label={`${formatForecastLabel(day)}: ${day.total} (${day.mature} / ${day.young})`}
                      onMouseEnter={(e) => {
                        setHoveredForecastIdx(idx);
                        setForecastAnchorEl(e.currentTarget);
                      }}
                      onFocus={(e) => {
                        setHoveredForecastIdx(idx);
                        setForecastAnchorEl(e.currentTarget);
                      }}
                      onBlur={() => {
                        setHoveredForecastIdx(null);
                        setForecastAnchorEl(null);
                      }}
                      className="relative z-10 flex-1 h-full flex flex-col justify-end items-center group cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 rounded-sm"
                    >
                      {day.total > 0 ? (
                        <div
                          style={{
                            height: `${totalH}%`,
                            backgroundColor: accentScale.heatmap[2],
                          }}
                          className={`w-full max-w-[14px] rounded-t-[4px] overflow-hidden flex flex-col justify-end transition-[height,background-color,opacity,transform,filter] duration-200 ${
                            isHovered
                              ? 'scale-x-110 ring-2 ring-[var(--brand)]/60 brightness-105'
                              : 'group-hover:brightness-105'
                          }`}
                        >
                          {day.mature > 0 && (
                            <div
                              style={{
                                height: `${matureRatio}%`,
                                backgroundColor: brandHex,
                              }}
                              className={`w-full ${
                                hasBoth ? 'border-t border-white/45 dark:border-black/25' : ''
                              }`}
                            />
                          )}
                        </div>
                      ) : (
                        <div className="w-full max-w-[10px] h-[2px] rounded-full bg-[var(--dashboard-track)] opacity-60" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              dir="ltr"
              className="pt-2 px-1 flex items-center justify-between text-[10.5px] tabular-nums text-[var(--text-muted)] border-t border-[var(--border-subtle)]/75 mt-2"
            >
              <span className="font-semibold text-[var(--brand-text)]">{t('todayLabel')}</span>
              <span>{t('statsDaysLater', { n: 5 })}</span>
              <span>{t('statsDaysLater', { n: 10 })}</span>
              <span>{t('statsDaysLater', { n: 15 })}</span>
              <span>{t('statsDaysLater', { n: 20 })}</span>
              <span>{t('statsDaysLater', { n: 25 })}</span>
              <span>{t('statsDaysLater', { n: 29 })}</span>
            </div>
          </div>

          {/* 2. Card Maturity Distribution Breakdown */}
          <div
            className={`stats-panel-enter col-span-12 xl:col-span-4 ${cardBase}`}
            style={enterDelay(1)}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsMaturityTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsMaturityTitle')}
                  body={
                    <div className="space-y-1">
                      <p>
                        {t('statsMaturitySub', {
                          total: maturityBreakdown.total.toLocaleString(),
                        })}
                      </p>
                      <p className="text-[10.5px] text-[var(--text-muted)]">
                        {t('statsMatureCardsLegend')} · {t('statsYoungCardsLegend')}
                      </p>
                    </div>
                  }
                />
              </div>
              <span className="text-[12px] font-medium tabular-nums text-[var(--text-secondary)] shrink-0">
                {maturityBreakdown.total.toLocaleString()} {t('cardsUnit')}
              </span>
            </div>

            {showSkeleton ? (
              <div className="space-y-3 my-auto">
                <div className="w-full h-2.5 rounded-full animate-skeleton-shimmer" />
                <div className="space-y-2.5 pt-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="h-4 rounded animate-skeleton-shimmer opacity-60" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between gap-4 relative">
                <ChartTooltipPortal
                  open={Boolean(hoveredMaturitySeg && maturityAnchorEl)}
                  anchorEl={maturityAnchorEl}
                  repositionKey={hoveredMaturitySeg?.label}
                  onClose={() => {
                    setHoveredMaturitySeg(null);
                    setMaturityAnchorEl(null);
                  }}
                  content={
                    hoveredMaturitySeg ? (
                      <ChartTooltipContent
                        eyebrow={hoveredMaturitySeg.label}
                        rows={[
                          {
                            label: hoveredMaturitySeg.pctLabel,
                            value: `${hoveredMaturitySeg.count.toLocaleString()} ${t('cardsUnit')}`,
                            tone: hoveredMaturitySeg.tone,
                          },
                        ]}
                      />
                    ) : null
                  }
                />

                {/* Full-width stacked progress bar (same order as legend below) */}
                <div
                  role="img"
                  aria-label={t('statsMaturityTitle')}
                  onMouseLeave={() => {
                    setActiveMaturityKey(null);
                    setHoveredMaturitySeg(null);
                    setMaturityAnchorEl(null);
                  }}
                  className="w-full h-2.5 rounded-full overflow-hidden flex gap-[1px] bg-[var(--dashboard-track)]"
                >
                  {maturitySegments.map((seg) => {
                    if (seg.count <= 0) return null;
                    const isDimmed =
                      activeMaturityKey !== null && activeMaturityKey !== seg.key;
                    return (
                      <div
                        key={seg.key}
                        tabIndex={0}
                        role="img"
                        aria-label={`${seg.label}: ${seg.count.toLocaleString()} ${t('cardsUnit')} (${seg.pctLabel})`}
                        style={{
                          width: `${seg.widthPct}%`,
                          minWidth: seg.count > 0 ? '3px' : undefined,
                          ...seg.swatchStyle,
                          opacity: isDimmed ? 0.32 : seg.swatchStyle.opacity ?? 1,
                        }}
                        onMouseEnter={(e) => {
                          setActiveMaturityKey(seg.key);
                          setHoveredMaturitySeg({
                            label: seg.label,
                            count: seg.count,
                            pctLabel: seg.pctLabel,
                            tone: seg.tone,
                          });
                          setMaturityAnchorEl(e.currentTarget);
                        }}
                        onFocus={(e) => {
                          setActiveMaturityKey(seg.key);
                          setHoveredMaturitySeg({
                            label: seg.label,
                            count: seg.count,
                            pctLabel: seg.pctLabel,
                            tone: seg.tone,
                          });
                          setMaturityAnchorEl(e.currentTarget);
                        }}
                        onBlur={() => {
                          setActiveMaturityKey(null);
                          setHoveredMaturitySeg(null);
                          setMaturityAnchorEl(null);
                        }}
                        className="h-full transition-[width,opacity,filter] duration-150 cursor-pointer hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--text-primary)]"
                      />
                    );
                  })}
                </div>

                {/* Synchronized legend rows with bidirectional highlight */}
                <div
                  className="space-y-1 text-[12px]"
                  onMouseLeave={() => setActiveMaturityKey(null)}
                >
                  {maturitySegments.map((seg) => {
                    const isActive = activeMaturityKey === seg.key;
                    const isZero = seg.count === 0;
                    return (
                      <div
                        key={seg.key}
                        onMouseEnter={() => {
                          if (!isZero) setActiveMaturityKey(seg.key);
                        }}
                        className={`flex items-center justify-between gap-2 px-1.5 -mx-1.5 py-1 rounded-lg transition-colors duration-150 ${
                          isActive
                            ? 'bg-[var(--bg-subtle)]'
                            : isZero
                            ? 'opacity-65'
                            : 'hover:bg-[var(--bg-subtle)]/70'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={seg.swatchStyle}
                          />
                          <span
                            className={`truncate ${
                              isZero
                                ? 'text-[var(--text-muted)]'
                                : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {seg.shortLabel}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className={`font-semibold ${seg.textToneClass}`}>
                            {seg.count.toLocaleString()}
                          </span>
                          <span className="w-[38px] text-end text-[11px] text-[var(--text-secondary)]">
                            {seg.pctLabel}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Row 2: 12-Week Retention Curve (6) + 24-Hour Activity (6) */}
        <section className="grid grid-cols-12 gap-4">
          {/* 3. Historical Retention Smooth Area-Line Curve */}
          <div
            className={`stats-panel-enter col-span-12 lg:col-span-6 ${cardBase}`}
            style={enterDelay(2)}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsRetentionCurveTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsRetentionCurveTitle')}
                  body={t('statsRetentionCurveSub')}
                />
              </div>
              <span className="px-2.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11.5px] font-semibold tabular-nums shrink-0">
                {t('retentionRate')} {latestRetention}
              </span>
            </div>

            {showSkeleton ? (
              <div className="h-[140px] rounded-xl animate-skeleton-shimmer opacity-45" />
            ) : !hasRetentionData ? (
              <div className="h-[140px] flex items-center justify-center text-[12px] text-[var(--text-muted)]">
                --
              </div>
            ) : (
              <div
                dir="ltr"
                className="h-[140px] relative"
                onMouseLeave={() => {
                  setHoveredRetentionIdx(null);
                  setRetentionAnchorEl(null);
                }}
              >
                {/* Y-axis faint horizontal gridlines */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-[14px] bottom-[10px] flex flex-col justify-between"
                >
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05] relative">
                    <span className="absolute start-0 -top-3 text-[9.5px] tabular-nums text-[var(--text-muted)]">
                      100%
                    </span>
                  </div>
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05] relative">
                    <span className="absolute start-0 -top-3 text-[9.5px] tabular-nums text-[var(--text-muted)]">
                      {retentionBaseline}%
                    </span>
                  </div>
                </div>

                {/* 90% Target Retention Dashed Reference Line */}
                {target90YPct !== null && (
                  <div
                    aria-hidden="true"
                    style={{ top: `${target90YPct}%` }}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--status-success)]/45"
                  >
                    <span className="absolute end-0 -top-3.5 text-[9.5px] font-medium tabular-nums text-[var(--status-success-text)]">
                      90%
                    </span>
                  </div>
                )}

                {/* Active vertical hairline guide */}
                {hoveredRetentionIdx !== null && plottedPoints[hoveredRetentionIdx] && (
                  <div
                    aria-hidden="true"
                    style={{ left: `${plottedPoints[hoveredRetentionIdx].xPct}%` }}
                    className="pointer-events-none absolute top-[10px] bottom-[8px] w-px bg-[var(--brand)]/30"
                  />
                )}

                {/* Smooth monotone cubic spline SVG */}
                <svg
                  viewBox={`0 0 ${RETENTION_SVG_W} ${RETENTION_SVG_H}`}
                  preserveAspectRatio="none"
                  className="w-full h-full overflow-visible pointer-events-none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id={retentionGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={brandHex} stopOpacity="0.22" />
                      <stop offset="100%" stopColor={brandHex} stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {splineSegments.map((seg, i) => (
                    <g key={i}>
                      <path d={seg.areaPath} fill={`url(#${retentionGradId})`} />
                      <path
                        d={seg.linePath}
                        fill="none"
                        stroke={brandHex}
                        strokeWidth="2.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ))}
                </svg>

                <ChartTooltipPortal
                  open={Boolean(hoveredRetentionPt && retentionAnchorEl)}
                  anchorEl={retentionAnchorEl}
                  repositionKey={hoveredRetentionIdx}
                  onClose={() => {
                    setHoveredRetentionIdx(null);
                    setRetentionAnchorEl(null);
                  }}
                  content={
                    hoveredRetentionPt && hoveredRetentionIdx !== null ? (
                      <ChartTooltipContent
                        eyebrow={formatRetentionPeriod(hoveredRetentionIdx, retentionCurve.length)}
                      >
                        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tabular-nums whitespace-nowrap">
                          <span className="text-[var(--brand-text)]">
                            {hoveredRetentionPt.reviews.toLocaleString()} {t('cardsUnit')}
                          </span>
                          <span aria-hidden="true" className="text-[var(--text-muted)]">
                            ·
                          </span>
                          <span className="text-[var(--status-success-text)]">
                            {hoveredRetentionPt.reviews > 0
                              ? `${Number(hoveredRetentionPt.retentionRate).toFixed(1)}%`
                              : '--'}
                          </span>
                        </div>
                      </ChartTooltipContent>
                    ) : null
                  }
                />

                {/* Interactive hit-zone columns + undistorted circular data dots */}
                {plottedPoints.map((pt) => {
                  const isLatest = pt.idx === plottedPoints.length - 1;
                  const isHovered = hoveredRetentionIdx === pt.idx;
                  const hasReviews = pt.reviews > 0;
                  return (
                    <button
                      key={pt.period}
                      type="button"
                      aria-label={`${formatRetentionPeriod(pt.idx, plottedPoints.length)}: ${
                        hasReviews ? `${Number(pt.retentionRate).toFixed(1)}%` : '--'
                      } (${pt.reviews})`}
                      style={{
                        left: `${pt.xPct}%`,
                        top: `${pt.yPct}%`,
                      }}
                      onMouseEnter={(e) => {
                        setHoveredRetentionIdx(pt.idx);
                        setRetentionAnchorEl(e.currentTarget);
                      }}
                      onFocus={(e) => {
                        setHoveredRetentionIdx(pt.idx);
                        setRetentionAnchorEl(e.currentTarget);
                      }}
                      onBlur={() => {
                        setHoveredRetentionIdx(null);
                        setRetentionAnchorEl(null);
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-0"
                    >
                      {hasReviews ? (
                        <span
                          style={{
                            backgroundColor:
                              isHovered || isLatest ? brandHex : 'var(--bg-card)',
                            borderColor: brandHex,
                          }}
                          className={`rounded-full border-2 transition-transform duration-150 ${
                            isHovered
                              ? 'w-3 h-3 scale-110 ring-4 ring-[var(--brand)]/20'
                              : isLatest
                              ? 'w-2.5 h-2.5'
                              : 'w-2 h-2'
                          }`}
                        />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--border-subtle)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div
              dir="ltr"
              className="pt-2 px-1 flex items-center justify-between text-[10.5px] tabular-nums text-[var(--text-muted)] border-t border-[var(--border-subtle)]/75 mt-2"
            >
              <span>{t('statsWeeksAgo', { n: 11 })}</span>
              <span>{t('statsWeeksAgo', { n: 8 })}</span>
              <span>{t('statsWeeksAgo', { n: 6 })}</span>
              <span>{t('statsWeeksAgo', { n: 3 })}</span>
              <span className="font-semibold text-[var(--brand-text)]">
                {t('statsThisWeekLabel')}
              </span>
            </div>
          </div>

          {/* 4. 24-Hour Study Time Distribution */}
          <div
            className={`stats-panel-enter col-span-12 lg:col-span-6 ${cardBase}`}
            style={enterDelay(3)}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsHourlyTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsHourlyTitle')}
                  body={peakHourSummary}
                />
              </div>

              {peakHourTop ? (
                <Tooltip
                  variant="compact"
                  side="bottom"
                  align="end"
                  offset={6}
                  className="w-max tabular-nums"
                  content={peakHourSummary}
                >
                  <span
                    tabIndex={0}
                    className="px-2.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] text-[11.5px] font-semibold tabular-nums shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-2"
                  >
                    {peakHourTop.hour} · {peakHourTop.accuracy}%
                  </span>
                </Tooltip>
              ) : (
                <span className="text-[11.5px] text-[var(--text-muted)] tabular-nums">--</span>
              )}
            </div>

            {showSkeleton ? (
              <div className="h-[140px] flex items-end gap-1 px-1">
                {[12, 8, 10, 14, 18, 25, 38, 46, 30, 52, 65, 84, 78, 45, 22, 14].map(
                  (h, i) => (
                    <div
                      key={i}
                      style={{ height: `${h}%` }}
                      className="flex-1 rounded-t-sm animate-skeleton-shimmer opacity-50"
                    />
                  ),
                )}
              </div>
            ) : (
              <div
                dir="ltr"
                className="h-[140px] flex items-end gap-1 px-1 relative"
                onMouseLeave={() => {
                  setHoveredHourlyIdx(null);
                  setHourlyAnchorEl(null);
                }}
              >
                {/* Subtle horizontal gridlines matching Card 1 */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 inset-y-0 flex flex-col justify-between"
                >
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div className="border-t border-black/[0.04] dark:border-white/[0.05]" />
                  <div />
                </div>

                <ChartTooltipPortal
                  open={Boolean(hoveredHourlyItem && hourlyAnchorEl)}
                  anchorEl={hourlyAnchorEl}
                  repositionKey={hoveredHourlyIdx}
                  onClose={() => {
                    setHoveredHourlyIdx(null);
                    setHourlyAnchorEl(null);
                  }}
                  content={
                    hoveredHourlyItem ? (
                      <ChartTooltipContent eyebrow={normalizeHourLabel(hoveredHourlyItem.hour)}>
                        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold tabular-nums whitespace-nowrap">
                          <span className="text-[var(--brand-text)]">
                            {hoveredHourlyItem.count.toLocaleString()} {t('cardsUnit')}
                          </span>
                          <span aria-hidden="true" className="text-[var(--text-muted)]">
                            ·
                          </span>
                          <span className="text-[var(--status-success-text)]">
                            {hoveredHourlyItem.accuracy}%
                          </span>
                        </div>
                      </ChartTooltipContent>
                    ) : null
                  }
                />

                {hourlyDistribution.map((item, idx) => {
                  const hPct =
                    item.count > 0
                      ? Math.max(6, Math.round((item.count / maxHourly) * 100))
                      : 0;
                  const isPeak = item.count > 0 && item.count >= maxHourly * 0.65;
                  const isHovered = hoveredHourlyIdx === idx;
                  return (
                    <div
                      key={item.hour}
                      tabIndex={0}
                      role="img"
                      aria-label={`${normalizeHourLabel(item.hour)}: ${item.count} (${item.accuracy}%)`}
                      onMouseEnter={(e) => {
                        setHoveredHourlyIdx(idx);
                        setHourlyAnchorEl(e.currentTarget);
                      }}
                      onFocus={(e) => {
                        setHoveredHourlyIdx(idx);
                        setHourlyAnchorEl(e.currentTarget);
                      }}
                      onBlur={() => {
                        setHoveredHourlyIdx(null);
                        setHourlyAnchorEl(null);
                      }}
                      className="relative z-10 flex-1 min-w-0 h-full flex flex-col items-center justify-end group cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--brand)] focus-visible:outline-offset-1 rounded-sm"
                    >
                      {item.count > 0 ? (
                        <div
                          style={{
                            height: `${hPct}%`,
                            backgroundColor:
                              isPeak || isHovered ? brandHex : accentScale.brandMutedBar,
                          }}
                          className={`w-full max-w-[12px] rounded-t-[4px] transition-[height,background-color,opacity,transform,filter] duration-200 ${
                            isHovered
                              ? 'scale-x-110 ring-2 ring-[var(--brand)]/60 brightness-105'
                              : 'group-hover:brightness-105'
                          }`}
                        />
                      ) : (
                        <div className="w-full max-w-[8px] h-[2px] rounded-full bg-[var(--dashboard-track)] opacity-60" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div
              dir="ltr"
              className="pt-2 px-1 flex items-center justify-between text-[10.5px] tabular-nums text-[var(--text-muted)] border-t border-[var(--border-subtle)]/75 mt-2"
            >
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

        {/* Row 3: Anki official "Answer Buttons" + "True Retention" metrics */}
        <section className="grid grid-cols-12 gap-4">
          {/* 5. Answer Buttons — reveals card-quality and scheduling problems */}
          <div
            className={`stats-panel-enter col-span-12 lg:col-span-6 ${cardBase}`}
            style={enterDelay(4)}
          >
            <div className="flex items-center justify-between gap-2 mb-5">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsAnswerButtonsTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsAnswerButtonsTitle')}
                  body={t('statsAnswerButtonsSub', {
                    total: answerButtons.total.toLocaleString(),
                  })}
                />
              </div>
              <span className="shrink-0 px-2.5 py-0.5 rounded-md bg-[var(--status-danger-soft)] text-[var(--status-danger-text)] text-[11.5px] font-semibold tabular-nums">
                {t('rateAgain')} {againPct}%
              </span>
            </div>

            {showSkeleton ? (
              <div className="space-y-3 my-auto">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-5 rounded animate-skeleton-shimmer opacity-55" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {buttonRows.map((row) => {
                  const rawShare =
                    answerButtons.total > 0 ? (row.value / answerTotal) * 100 : 0;
                  const pct = Math.round(rawShare);
                  return (
                    <div key={row.key} className="flex items-center gap-3 text-[12px]">
                      <span className="w-[46px] sm:w-[54px] shrink-0 text-[var(--text-secondary)] truncate">
                        {row.label}
                      </span>
                      <div
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${row.label}: ${row.value.toLocaleString()} (${pct}%)`}
                        className="flex-1 h-2 rounded-full bg-[var(--dashboard-track)] overflow-hidden"
                      >
                        {row.value > 0 && (
                          <div
                            style={{
                              width: `${rawShare}%`,
                              backgroundColor: row.color,
                            }}
                            className="h-full min-w-[4px] rounded-full transition-[width] duration-300"
                          />
                        )}
                      </div>
                      <span className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="min-w-[46px] text-end font-semibold text-[var(--text-primary)]">
                          {row.value.toLocaleString()}
                        </span>
                        <span className="w-[34px] text-end text-[11px] text-[var(--text-secondary)]">
                          {pct}%
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 pt-3.5 grid grid-cols-2 gap-4 text-[11.5px] border-t border-[var(--border-subtle)]/75">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-secondary)] truncate">
                  {stripParenthetical(t('statsYoungPassRateLabel'))}
                </span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatRateFixed(answerButtons.young.rate, answerButtons.young.total)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--text-secondary)] truncate">
                  {stripParenthetical(t('statsMaturePassRateLabel'))}
                </span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatRateFixed(answerButtons.mature.rate, answerButtons.mature.total)}
                </span>
              </div>
            </div>
          </div>

          {/* 6. True Retention — Anki's official FSRS calibration metric */}
          <div
            className={`stats-panel-enter col-span-12 lg:col-span-6 ${cardBase}`}
            style={enterDelay(5)}
          >
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-[14.5px] font-semibold tracking-tight text-[var(--text-primary)]">
                  {t('statsTrueRetentionTitle')}
                </h2>
                <CardInfoHint
                  heading={t('statsTrueRetentionTitle')}
                  body={t('statsTrueRetentionSub')}
                />
              </div>
            </div>

            {showSkeleton ? (
              <div className="grid grid-cols-2 gap-3 my-auto">
                <div className="h-[88px] rounded-xl animate-skeleton-shimmer opacity-55" />
                <div className="h-[88px] rounded-xl animate-skeleton-shimmer opacity-55" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    {
                      key: 'last30d',
                      title: t('statsLast30dLabel'),
                      data: trueRetention.last30d,
                    },
                    {
                      key: 'allTime',
                      title: t('statsAllTimeLabel'),
                      data: trueRetention.allTime,
                    },
                  ].map((block) => (
                    <div
                      key={block.key}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/55 px-4 py-3"
                    >
                      <div className="text-[11px] font-medium text-[var(--text-secondary)]">
                        {block.title}
                      </div>
                      <div className="text-[26px] leading-tight font-bold tracking-tight tabular-nums text-[var(--brand-text)] mt-0.5">
                        {formatRateFixed(block.data.overall.rate, block.data.overall.total)}
                      </div>
                      <div className="text-[11px] tabular-nums text-[var(--text-muted)] mt-0.5">
                        {block.data.overall.pass.toLocaleString()} /{' '}
                        {block.data.overall.total.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Accessible 3-column mini comparison table (zero hardcoded English) */}
                <div className="pt-3 border-t border-[var(--border-subtle)]/75">
                  <table className="w-full text-[11.5px] tabular-nums border-collapse">
                    <thead>
                      <tr className="text-[10.5px] font-medium text-[var(--text-muted)]">
                        <td className="pb-1.5" />
                        <th scope="col" className="text-end font-medium pb-1.5 w-[76px]">
                          {t('statsLast30dLabel')}
                        </th>
                        <th scope="col" className="text-end font-medium pb-1.5 w-[76px]">
                          {t('statsAllTimeLabel')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th
                          scope="row"
                          className="text-start font-normal text-[var(--text-secondary)] py-1"
                        >
                          {youngShortLabel}
                        </th>
                        <td className="text-end font-semibold text-[var(--text-primary)] py-1">
                          {formatRateFixed(
                            trueRetention.last30d.young.rate,
                            trueRetention.last30d.young.total,
                          )}
                        </td>
                        <td className="text-end font-semibold text-[var(--text-primary)] py-1">
                          {formatRateFixed(
                            trueRetention.allTime.young.rate,
                            trueRetention.allTime.young.total,
                          )}
                        </td>
                      </tr>
                      <tr>
                        <th
                          scope="row"
                          className="text-start font-normal text-[var(--text-secondary)] py-1"
                        >
                          {matureShortLabel}
                        </th>
                        <td className="text-end font-semibold text-[var(--text-primary)] py-1">
                          {formatRateFixed(
                            trueRetention.last30d.mature.rate,
                            trueRetention.last30d.mature.total,
                          )}
                        </td>
                        <td className="text-end font-semibold text-[var(--text-primary)] py-1">
                          {formatRateFixed(
                            trueRetention.allTime.mature.rate,
                            trueRetention.allTime.mature.total,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
