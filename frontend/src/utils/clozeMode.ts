// ============================================================================
// Cloze Grouping Mode Helpers (Combined 1-card vs Split N-cards)
// ============================================================================

export type ClozeGroupingMode = 'combined' | 'split';

const CLOZE_OPEN_TAG_RE = /\{\{c(\d+)::/g;

/** Collect sorted distinct positive cloze ordinals (`c1`, `c2`, ...) across field strings. */
export function getDistinctClozeOrdinals(fields: Iterable<string>): number[] {
  const ords = new Set<number>();
  for (const field of fields) {
    if (!field) continue;
    CLOZE_OPEN_TAG_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CLOZE_OPEN_TAG_RE.exec(field)) !== null) {
      const ord = parseInt(m[1], 10);
      if (Number.isFinite(ord) && ord >= 1) {
        ords.add(ord);
      }
    }
  }
  return Array.from(ords).sort((a, b) => a - b);
}

/** Count total cloze deletion spans (`{{cN::...}}`) across field strings. */
export function countTotalClozeSpans(fields: Iterable<string>): number {
  let count = 0;
  for (const field of fields) {
    if (!field) continue;
    CLOZE_OPEN_TAG_RE.lastIndex = 0;
    while (CLOZE_OPEN_TAG_RE.exec(field) !== null) {
      count += 1;
    }
  }
  return count;
}

/**
 * Derive current cloze grouping mode from field contents.
 * When 2+ distinct cloze ordinals exist (`c1` & `c2`), Anki generates separate cards -> `'split'`.
 * Otherwise (0 or 1 distinct ordinal, e.g. all `c1`), all clozes share a single card -> `'combined'`.
 */
export function getClozeGroupingMode(fields: Iterable<string>): ClozeGroupingMode {
  return getDistinctClozeOrdinals(fields).length > 1 ? 'split' : 'combined';
}

/**
 * Rewrite all `{{cN::` ordinals across a map of fields into either:
 * - `'combined'`: every cloze becomes `{{c1::` (single card, revealed together)
 * - `'split'`: clozes are sequentially numbered `c1`, `c2`, ..., `cK` in `orderedKeys` order
 */
export function rewriteClozeModeInFieldMap<T extends Record<string, string>>(
  fieldMap: T,
  targetMode: ClozeGroupingMode,
  orderedKeys?: readonly string[],
): T {
  const keys = orderedKeys
    ? [
        ...orderedKeys.filter((k) => k in fieldMap),
        ...Object.keys(fieldMap).filter((k) => !orderedKeys.includes(k)),
      ]
    : Object.keys(fieldMap);

  const next = { ...fieldMap } as Record<string, string>;
  let seq = 1;

  for (const key of keys) {
    const val = next[key];
    if (!val) continue;
    CLOZE_OPEN_TAG_RE.lastIndex = 0;
    next[key] = val.replace(CLOZE_OPEN_TAG_RE, () => {
      const assigned = targetMode === 'combined' ? 1 : seq++;
      return `{{c${assigned}::`;
    });
  }

  return next as T;
}
