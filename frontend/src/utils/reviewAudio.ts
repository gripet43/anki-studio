export interface ReviewAudioCardLike {
  audioFiles?: string[];
  frontAudioFiles?: string[];
  backAudioFiles?: string[];
  sandboxQuestionAudioFiles?: string[];
  sandboxAnswerAudioFiles?: string[];
}

export interface AutoPlayAudioPrefs {
  autoPlayFrontAudio: boolean;
  autoPlayBackAudio: boolean;
}

/**
 * Deduplicates and trims a list of audio filenames while preserving order.
 */
export function normalizeAudioList(files?: string[] | null): string[] {
  const out: string[] = [];
  if (!Array.isArray(files)) return out;
  for (const item of files) {
    const clean = typeof item === 'string' ? item.trim() : '';
    if (clean && !out.includes(clean)) {
      out.push(clean);
    }
  }
  return out;
}

/**
 * Normalizes a single filename or filename array passed to `playAudio()`.
 */
export function resolveAudioFilesToPlay(target?: string | string[] | null): string[] {
  if (Array.isArray(target)) {
    return normalizeAudioList(target);
  }
  if (typeof target === 'string') {
    const clean = target.trim();
    return clean ? [clean] : [];
  }
  return [];
}

/**
 * Resolves which audio files (if any) should auto-play when showing the question front
 * or flipping to reveal the answer back under the user's audio auto-play preferences.
 *
 * Rules:
 * - Question front (`side === 'front'`): plays `frontAudioFiles` only when
 *   `autoPlayFrontAudio` is enabled (never leaks back-only audio).
 * - Answer back (`side === 'back'`): when `autoPlayBackAudio` is enabled, plays
 *   `backAudioFiles`; if the back has no independent audio, falls back to replaying
 *   `frontAudioFiles`.
 */
export function resolveAutoPlayAudioFiles(
  card: ReviewAudioCardLike | null | undefined,
  side: 'front' | 'back',
  prefs: AutoPlayAudioPrefs
): string[] {
  if (!card) return [];

  const hasExplicitSideSplit =
    card.frontAudioFiles !== undefined || card.backAudioFiles !== undefined;

  if (hasExplicitSideSplit) {
    const front = normalizeAudioList(card.frontAudioFiles);
    const back = normalizeAudioList(card.backAudioFiles);
    if (side === 'front') {
      return prefs.autoPlayFrontAudio ? front : [];
    }
    if (!prefs.autoPlayBackAudio) return [];
    return back.length > 0 ? back : front;
  }

  const legacy = normalizeAudioList(card.audioFiles);
  if (side === 'front') {
    return prefs.autoPlayFrontAudio ? legacy : [];
  }
  return prefs.autoPlayBackAudio ? legacy : [];
}

/**
 * Resolves which audio files should play when the user manually triggers Read Aloud (`R`
 * or the top-bar speaker button) for the currently visible side of a card.
 */
export function resolveManualPlayAudioFiles(
  card: ReviewAudioCardLike | null | undefined,
  isCardFlipped: boolean
): string[] {
  if (!card) return [];

  const hasExplicitSideSplit =
    card.frontAudioFiles !== undefined || card.backAudioFiles !== undefined;

  if (!hasExplicitSideSplit) {
    return normalizeAudioList(card.audioFiles);
  }

  const front = normalizeAudioList(card.frontAudioFiles);
  if (!isCardFlipped) {
    return front;
  }

  const back = normalizeAudioList(card.backAudioFiles);
  if (back.length > 0) return back;
  if (front.length > 0) return front;
  return normalizeAudioList(card.audioFiles);
}

/**
 * Resolves the clickable audio chip list shown on the currently visible card side.
 */
export function resolveVisibleAudioFiles(
  card: ReviewAudioCardLike | null | undefined,
  isCardFlipped: boolean
): string[] {
  if (!card) return [];
  const hasExplicitSideSplit =
    card.frontAudioFiles !== undefined || card.backAudioFiles !== undefined;
  if (!isCardFlipped && hasExplicitSideSplit) {
    return normalizeAudioList(card.frontAudioFiles);
  }
  return normalizeAudioList(card.audioFiles);
}

/**
 * Maps Anki's `[anki:play:q:N]` / `[anki:play:a:N]` sandbox click message to the matching
 * audio filename, falling back cleanly when native AV tag lists are absent.
 */
export function getSandboxPlayAudioFile(
  card: ReviewAudioCardLike | null | undefined,
  side: string,
  index: number
): string | undefined {
  if (!card) return undefined;
  const idx = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  const normalizedSide = String(side || '').toLowerCase() === 'q' ? 'q' : 'a';

  const sandboxQ = normalizeAudioList(card.sandboxQuestionAudioFiles);
  const sandboxA = normalizeAudioList(card.sandboxAnswerAudioFiles);
  const front = normalizeAudioList(card.frontAudioFiles);
  const back = normalizeAudioList(card.backAudioFiles);
  const all = normalizeAudioList(card.audioFiles);

  if (normalizedSide === 'q') {
    return sandboxQ[idx] ?? front[idx] ?? all[idx] ?? front[0] ?? all[0];
  }
  return sandboxA[idx] ?? back[idx] ?? all[idx] ?? back[0] ?? front[0] ?? all[0];
}
