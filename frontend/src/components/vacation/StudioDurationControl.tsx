import React, { useId } from 'react';

export const CheckGlyph: React.FC = () => (
  <svg
    className="w-3.5 h-3.5 shrink-0"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export interface StudioDurationControlProps {
  heading: string;
  badgeText: string;
  presetLegend: string;
  presets: number[];
  presetsGridClassName?: string;
  min: number;
  max: number;
  value: number;
  daysUnit: string;
  singleDayUnit?: string;
  onChange: (nextDays: number) => void;
}

/**
 * 统一的「预设快捷选项 + 精致连续滑轨」天数选择卡片组件，
 * 在「休假模式」与「进度减负」弹窗间共享完全一致的交互与视觉规范。
 */
export const StudioDurationControl: React.FC<StudioDurationControlProps> = ({
  heading,
  badgeText,
  presetLegend,
  presets,
  presetsGridClassName = 'grid grid-cols-2 sm:grid-cols-4 gap-2',
  min,
  max,
  value,
  daysUnit,
  singleDayUnit,
  onChange,
}) => {
  const sliderId = useId();
  const clamped = Math.min(max, Math.max(min, value));
  const midpoint = Math.round((min + max) / 2);
  const formatDayCount = (count: number) =>
    `${count} ${count === 1 && singleDayUnit ? singleDayUnit : daysUnit}`;

  return (
    <div className="p-4 vacation-section-card flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={sliderId} className="text-[12.5px] font-semibold cursor-pointer">
          {heading}
        </label>
        <span className="text-[11px] tabular-nums px-2.5 py-0.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand-text)] font-semibold">
          {badgeText}
        </span>
      </div>

      {/* Preset Quick Chips */}
      <fieldset className="vacation-duration-fieldset">
        <legend className="sr-only">{presetLegend}</legend>
        <div className={presetsGridClassName}>
          {presets.map((d) => {
            const active = clamped === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(d)}
                className="vacation-preset-btn"
              >
                {active && <CheckGlyph />}
                <span>{formatDayCount(d)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Studio Range Slider with Aligned Scale Markers */}
      <div className="studio-slider-group">
        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={1}
          value={clamped}
          aria-valuetext={formatDayCount(clamped)}
          onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
          style={
            {
              '--attr-min': String(min),
              '--attr-max': String(max),
              '--control-value': String(clamped),
            } as React.CSSProperties
          }
          className="studio-range-slider"
        />
        <div className="studio-slider-scale" aria-hidden="true">
          <span className="studio-slider-tick">{formatDayCount(min)}</span>
          <span className="studio-slider-tick">{formatDayCount(midpoint)}</span>
          <span className="studio-slider-tick">{formatDayCount(max)}</span>
        </div>
      </div>
    </div>
  );
};
