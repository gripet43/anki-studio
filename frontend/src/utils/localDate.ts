/** 本地时区的日期键（YYYY-MM-DD），用于「今天不再显示」这类按天判断。 */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface DayBoundaryLike {
  available?: boolean;
  logicalDate?: string;
}

/** 获取当前有效的学习日键：优先使用 Anki 调度器逻辑日（遵循过零时间偏好），兜底本地日历。 */
export function getEffectiveDayKey(
  dayBoundary?: DayBoundaryLike | null,
  fallbackDate: Date = new Date()
): string {
  const logical = dayBoundary?.available ? String(dayBoundary.logicalDate || '').trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(logical)) {
    return logical;
  }
  return localDateKey(fallbackDate);
}
