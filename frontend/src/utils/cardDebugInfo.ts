import {
  callAnki,
  CardDebugAnomaly,
  CardDebugInfoResponse,
  EnvInfo,
  isAnkiNativeEnv,
  ReviewCardItem,
  ReviewContentScale,
  ReviewStageWidth,
} from '../bridge/pycmd';
import { copyTextToClipboard } from './clipboard';

const VALID_CLOZE_GLOBAL_RE = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;
const CLOZE_START_CANDIDATE_RE = /\{\{[\s\u200b\u200c\u200d\ufeff\u2060\u00ad]*c\d*/gi;
const DATA_URI_BASE64_RE = /data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=]{256,})/g;

const INVISIBLE_CHAR_LABELS: Record<string, string> = {
  '\u200b': 'U+200B ZERO WIDTH SPACE',
  '\u200c': 'U+200C ZERO WIDTH NON-JOINER',
  '\u200d': 'U+200D ZERO WIDTH JOINER',
  '\ufeff': 'U+FEFF ZERO WIDTH NO-BREAK SPACE',
  '\u2060': 'U+2060 WORD JOINER',
  '\u00ad': 'U+00AD SOFT HYPHEN',
  '\u180e': 'U+180E MONGOLIAN VOWEL SEPARATOR',
};

export interface InvisibleCharHit {
  field: string;
  index: number;
  codepoint: string;
  context: string;
}

export interface ClientFieldScanResult {
  anomalies: CardDebugAnomaly[];
  validClozeFields: string[];
  brokenClozeCandidates: Array<{ field: string; index: number; snippet: string }>;
  htmlInsideClozeFields: string[];
  invisibleChars: InvisibleCharHit[];
}

export interface CardDebugClientState {
  sourceView: 'reviewer' | 'card-editor';
  envInfo: EnvInfo;
  theme: string;
  accentColor: string;
  resolvedLang: string;
  sandboxNoteTypeIds: string[];
  autoPlayFrontAudio?: boolean;
  autoPlayBackAudio?: boolean;
  reviewStageWidth?: ReviewStageWidth;
  reviewContentScale?: ReviewContentScale;
  isPreviewSession?: boolean;
  isCardFlipped?: boolean;
  isSandboxCard?: boolean;
  editorMode?: 'edit' | 'preview';
  selectedPreset?: string;
}

export interface CardDebugCardSnapshot {
  id?: string;
  noteId?: string;
  deckId?: string;
  deckName?: string;
  fullDeckName?: string;
  notetypeId?: string;
  noteTypeName?: string;
  isCloze?: boolean;
  needsSandbox?: boolean;
  replaceFrontOnFlip?: boolean;
  cardType?: string;
  reps?: number;
  lapses?: number;
  intervalDays?: number;
  stability?: number;
  difficulty?: number;
  flags?: number;
  suspended?: boolean;
  buried?: boolean;
  tags?: string[];
  audioFiles?: string[];
  frontAudioFiles?: string[];
  backAudioFiles?: string[];
  front?: string;
  frontHtml?: string;
  frontAnswerHtml?: string;
  backHtml?: string;
  sandboxFrontHtml?: string;
  sandboxBackHtml?: string;
  sandboxCss?: string;
  fields?: Record<string, string>;
  fieldOrder?: string[];
  previewFrontHtml?: string;
  previewBackHtml?: string;
}

export interface BuildCardDebugReportInput {
  client: CardDebugClientState;
  card: CardDebugCardSnapshot;
  backend?: CardDebugInfoResponse | null;
  copiedAt?: string;
}

/**
 * Replaces multi-kilobyte base64 data URIs and overlong blobs so the pasted
 * diagnostic payload stays fast and compact in chat apps (WeChat/QQ/GitHub)
 * while keeping all HTML tags and collection.media filenames intact.
 */
export function sanitizeDebugString(raw: unknown, maxLen = 16000): string {
  if (raw === null || raw === undefined) return '';
  const text = String(raw).replace(
    DATA_URI_BASE64_RE,
    (_m, mime: string, b64: string) =>
      `data:${mime};base64,<truncated ${b64.length} chars>`
  );
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}... [truncated, total ${text.length} chars]`;
}

function sanitizeRecordStrings(
  obj: Record<string, string> | undefined,
  maxLen = 16000
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj) return out;
  for (const [k, v] of Object.entries(obj)) {
    out[k] = sanitizeDebugString(v, maxLen);
  }
  return out;
}

/**
 * Pure client-side anomaly scan over raw field strings and optional template/model metadata.
 */
export function scanFieldAnomalies(
  fields: Record<string, string> | undefined,
  options?: { modelType?: number | null; qfmt?: string; isClozeCardFlag?: boolean }
): ClientFieldScanResult {
  const invisibleChars: InvisibleCharHit[] = [];
  const validClozeFields: string[] = [];
  const brokenClozeCandidates: Array<{ field: string; index: number; snippet: string }> = [];
  const htmlInsideClozeFields: string[] = [];

  for (const [fieldName, rawVal] of Object.entries(fields || {})) {
    const text = String(rawVal || '');
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const code = ch.charCodeAt(0);
      const known = INVISIBLE_CHAR_LABELS[ch];
      const isBidi = code >= 0x200e && code <= 0x200f;
      const isBidiEmbed = code >= 0x202a && code <= 0x202e;
      if (known || isBidi || isBidiEmbed) {
        invisibleChars.push({
          field: fieldName,
          index: i,
          codepoint: known || `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
          context: text.slice(Math.max(0, i - 12), i + 13),
        });
      }
    }

    const matchedSpans: Array<[number, number]> = [];
    VALID_CLOZE_GLOBAL_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = VALID_CLOZE_GLOBAL_RE.exec(text)) !== null) {
      if (!validClozeFields.includes(fieldName)) validClozeFields.push(fieldName);
      if ((m[2] || '').includes('<') || (m[3] || '').includes('<')) {
        if (!htmlInsideClozeFields.includes(fieldName)) htmlInsideClozeFields.push(fieldName);
      }
      matchedSpans.push([m.index, m.index + m[0].length]);
    }

    CLOZE_START_CANDIDATE_RE.lastIndex = 0;
    let c: RegExpExecArray | null;
    while ((c = CLOZE_START_CANDIDATE_RE.exec(text)) !== null) {
      const pos = c.index;
      const insideValid = matchedSpans.some(([s, e]) => pos >= s && pos < e);
      if (!insideValid) {
        brokenClozeCandidates.push({
          field: fieldName,
          index: pos,
          snippet: text.slice(Math.max(0, pos - 8), pos + 32),
        });
      }
    }
  }

  const anomalies: CardDebugAnomaly[] = [];
  const modelType = options?.modelType;
  const hasValidCloze = validClozeFields.length > 0;

  if (hasValidCloze && modelType !== undefined && modelType !== null && modelType !== 1) {
    anomalies.push({
      code: 'CLOZE_SYNTAX_IN_STANDARD_MODEL',
      message: `Field(s) [${validClozeFields.join(', ')}] contain {{cN::...}} syntax, but noteType model.type=${modelType} (expected 1 for Cloze).`,
    });
  } else if (hasValidCloze && options?.isClozeCardFlag === false) {
    anomalies.push({
      code: 'CLOZE_SYNTAX_WITH_IS_CLOZE_FALSE',
      message: `Field(s) [${validClozeFields.join(', ')}] contain {{cN::...}} syntax, while card.isCloze is false.`,
    });
  }

  if (modelType === 1 && options?.qfmt && !options.qfmt.toLowerCase().includes('{{cloze:')) {
    anomalies.push({
      code: 'CLOZE_MODEL_MISSING_CLOZE_FILTER_IN_QFMT',
      message: 'Note type has model.type=1, but front template qfmt lacks {{cloze:...}}.',
    });
  }

  if (brokenClozeCandidates.length > 0) {
    const affected = Array.from(new Set(brokenClozeCandidates.map((x) => x.field))).join(', ');
    anomalies.push({
      code: 'BROKEN_CLOZE_SYNTAX',
      message: `Found ${brokenClozeCandidates.length} unclosed or malformed cloze opener(s) in [${affected}].`,
    });
  }

  if (invisibleChars.length > 0) {
    const affected = Array.from(new Set(invisibleChars.map((x) => x.field))).join(', ');
    anomalies.push({
      code: 'INVISIBLE_CHARS_DETECTED',
      message: `Detected ${invisibleChars.length} zero-width/invisible character(s) in [${affected}].`,
    });
  }

  return {
    anomalies,
    validClozeFields,
    brokenClozeCandidates,
    htmlInsideClozeFields,
    invisibleChars,
  };
}

function buildCardDebugReportWithAnomalies(input: BuildCardDebugReportInput): {
  report: string;
  anomalies: CardDebugAnomaly[];
} {
  const { client, card, backend } = input;
  const copiedAt = input.copiedAt || new Date().toISOString();
  const ntId = card.notetypeId || backend?.noteTypeInfo?.id || '';
  const compatEnabledForNoteType = Boolean(
    ntId && client.sandboxNoteTypeIds.includes(String(ntId))
  );

  const mergedFields =
    backend?.noteInfo?.rawFields && Object.keys(backend.noteInfo.rawFields).length > 0
      ? backend.noteInfo.rawFields
      : card.fields || {};

  const clientScan = scanFieldAnomalies(mergedFields, {
    modelType: backend?.noteTypeInfo?.modelType ?? null,
    qfmt: backend?.noteTypeInfo?.activeTemplate?.qfmt,
    isClozeCardFlag: card.isCloze,
  });

  // Merge backend and client anomaly records without duplicate codes.
  const seenCodes = new Set<string>();
  const anomalies: CardDebugAnomaly[] = [];
  for (const item of [
    ...(backend?.clozeAndCharDiagnostics?.anomalies || []),
    ...clientScan.anomalies,
  ]) {
    const dedupKey = `${item.code}:${item.message}`;
    if (!seenCodes.has(dedupKey)) {
      seenCodes.add(dedupKey);
      anomalies.push(item);
    }
  }

  const renderMode =
    client.sourceView === 'reviewer'
      ? client.isSandboxCard
        ? 'sandbox-iframe'
        : 'native-dom'
      : `editor-${client.editorMode || 'edit'}`;

  const structuredPayload = {
    meta: {
      reportSchema: 'anki-studio-card-debug/v1',
      copiedAt,
      sourceView: client.sourceView,
    },
    environment: {
      studioVersion: client.envInfo?.studioVersion || 'unknown',
      ankiVersion: client.envInfo?.ankiVersion || 'unknown',
      platform: client.envInfo?.platform || 'unknown',
      osName: client.envInfo?.osName || 'unknown',
      theme: client.theme,
      accentColor: client.accentColor,
      language: client.resolvedLang,
      reviewStageWidth: client.reviewStageWidth ?? 'auto',
      reviewContentScale: client.reviewContentScale ?? 100,
      autoPlayFrontAudio: Boolean(client.autoPlayFrontAudio),
      autoPlayBackAudio: client.autoPlayBackAudio ?? true,
      isPreviewSession: Boolean(client.isPreviewSession),
      isCardFlipped: Boolean(client.isCardFlipped),
      isSandboxCard: Boolean(client.isSandboxCard),
      compatEnabledForNoteType,
      sandboxNoteTypeIds: client.sandboxNoteTypeIds,
      renderMode,
      selectedPreset: client.selectedPreset,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      viewport:
        typeof window !== 'undefined'
          ? {
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio || 1,
            }
          : null,
    },
    cardFrontend: {
      id: card.id || '',
      noteId: card.noteId || '',
      deckId: card.deckId || '',
      deckName: card.deckName || '',
      fullDeckName: card.fullDeckName || '',
      notetypeId: ntId,
      noteTypeName: card.noteTypeName || backend?.noteTypeInfo?.name || '',
      isCloze: Boolean(card.isCloze),
      needsSandbox: Boolean(card.needsSandbox),
      replaceFrontOnFlip: card.replaceFrontOnFlip,
      cardType: card.cardType,
      reps: card.reps,
      lapses: card.lapses,
      intervalDays: card.intervalDays,
      stability: card.stability,
      difficulty: card.difficulty,
      flags: card.flags,
      suspended: card.suspended,
      buried: card.buried,
      tags: card.tags || [],
      audioFiles: card.audioFiles || [],
      frontAudioFiles: card.frontAudioFiles || [],
      backAudioFiles: card.backAudioFiles || [],
      fieldOrder: card.fieldOrder || Object.keys(card.fields || {}),
      fields: sanitizeRecordStrings(card.fields),
      front: sanitizeDebugString(card.front),
      frontHtml: sanitizeDebugString(card.frontHtml),
      frontAnswerHtml: sanitizeDebugString(card.frontAnswerHtml),
      backHtml: sanitizeDebugString(card.backHtml),
      sandboxFrontHtml: sanitizeDebugString(card.sandboxFrontHtml),
      sandboxBackHtml: sanitizeDebugString(card.sandboxBackHtml),
      sandboxCss: sanitizeDebugString(card.sandboxCss, 12000),
      previewFrontHtml: card.previewFrontHtml
        ? sanitizeDebugString(card.previewFrontHtml)
        : undefined,
      previewBackHtml: card.previewBackHtml
        ? sanitizeDebugString(card.previewBackHtml)
        : undefined,
    },
    backendForensics: backend
      ? {
          ...backend,
          noteInfo: backend.noteInfo
            ? {
                ...backend.noteInfo,
                rawFields: sanitizeRecordStrings(backend.noteInfo.rawFields),
              }
            : undefined,
          noteTypeInfo: backend.noteTypeInfo
            ? {
                ...backend.noteTypeInfo,
                css: sanitizeDebugString(backend.noteTypeInfo.css, 12000),
              }
            : undefined,
          nativeRender: backend.nativeRender
            ? {
                ...backend.nativeRender,
                questionHtml: sanitizeDebugString(backend.nativeRender.questionHtml),
                answerHtml: sanitizeDebugString(backend.nativeRender.answerHtml),
              }
            : undefined,
        }
      : { available: false, reason: 'not_queried_or_browser_preview' },
    diagnostics: {
      anomalies,
      clientScan,
    },
  };

  const modelTypeStr =
    backend?.noteTypeInfo?.modelTypeLabel ??
    (card.isCloze ? 'isCloze=true' : 'isCloze=false');
  const tmplOrd = backend?.noteTypeInfo?.activeOrd;
  const tmplName = backend?.noteTypeInfo?.activeTemplate?.name || '-';

  const summaryLines = [
    '=== Anki Studio Card Debug Info ===',
    '[Summary]',
    `- Studio: v${client.envInfo?.studioVersion || '?'} | Anki: ${client.envInfo?.ankiVersion || '?'} | OS: ${client.envInfo?.osName || client.envInfo?.platform || '?'}`,
    `- SourceView: ${client.sourceView} | RenderMode: ${renderMode} | Theme: ${client.theme} | Lang: ${client.resolvedLang}`,
    `- Display: width=${client.reviewStageWidth ?? 'auto'} | scale=${client.reviewContentScale ?? 100}% | flipped=${Boolean(client.isCardFlipped)}`,
    `- Card: id=${card.id || '(draft)'} | noteId=${card.noteId || '(draft)'} | deck=${card.fullDeckName || card.deckName || '-'}`,
    `- NoteType: ${card.noteTypeName || backend?.noteTypeInfo?.name || '-'} (id=${ntId || '-'}, ${modelTypeStr}, ord=${tmplOrd ?? '-'}, tmpl=${tmplName})`,
    `- Flags: serialized.isCloze=${Boolean(card.isCloze)} | needsSandbox=${Boolean(card.needsSandbox)} | userCompatEnabled=${compatEnabledForNoteType}`,
    '',
    '[Anomaly Checks]',
    ...(anomalies.length > 0
      ? anomalies.map((a) => `- [${a.code}] ${a.message}`)
      : ['- None detected']),
    '',
    '[Raw Debug JSON]',
    '```json',
    JSON.stringify(structuredPayload, null, 2),
    '```',
  ];

  return { report: summaryLines.join('\n'), anomalies };
}

/**
 * Formats a full developer-ready diagnostic bundle for copying into bug reports.
 */
export function buildCardDebugReport(input: BuildCardDebugReportInput): string {
  return buildCardDebugReportWithAnomalies(input).report;
}

export function cardDebugSnapshotFromReviewCard(card: ReviewCardItem): CardDebugCardSnapshot {
  return {
    id: card.id,
    noteId: card.noteId,
    deckId: card.deckId,
    deckName: card.deckName,
    fullDeckName: card.fullDeckName,
    notetypeId: card.notetypeId,
    noteTypeName: card.noteTypeName,
    isCloze: card.isCloze,
    needsSandbox: card.needsSandbox,
    replaceFrontOnFlip: card.replaceFrontOnFlip,
    cardType: card.cardType,
    reps: card.reps,
    lapses: card.lapses,
    intervalDays: card.intervalDays,
    stability: card.stability,
    difficulty: card.difficulty,
    flags: card.flags,
    suspended: card.suspended,
    buried: card.buried,
    tags: card.tags,
    audioFiles: card.audioFiles,
    frontAudioFiles: card.frontAudioFiles,
    backAudioFiles: card.backAudioFiles,
    front: card.front,
    frontHtml: card.frontHtml,
    frontAnswerHtml: card.frontAnswerHtml,
    backHtml: card.backHtml,
    sandboxFrontHtml: card.sandboxFrontHtml,
    sandboxBackHtml: card.sandboxBackHtml,
    sandboxCss: card.sandboxCss,
    fields: card.fields,
    fieldOrder: card.fieldOrder,
  };
}

/**
 * Fetches backend forensics when available, builds the full debug bundle, and
 * copies it to the clipboard without stripping HTML tags.
 */
export async function collectAndCopyCardDebugInfo(params: {
  client: CardDebugClientState;
  card: CardDebugCardSnapshot;
}): Promise<{ copied: boolean; report: string; anomalies: CardDebugAnomaly[] }> {
  let backend: CardDebugInfoResponse | null = null;
  const cardId = params.card.id ? String(params.card.id).trim() : '';

  if (isAnkiNativeEnv() && cardId && /^\d+$/.test(cardId)) {
    try {
      backend = await callAnki<CardDebugInfoResponse>('get_card_debug_info', { cardId });
    } catch {
      backend = null;
    }
  }

  const { report, anomalies } = buildCardDebugReportWithAnomalies({
    client: params.client,
    card: params.card,
    backend,
  });
  const copied = await copyTextToClipboard(report, { stripHtml: false });

  return { copied, report, anomalies };
}
