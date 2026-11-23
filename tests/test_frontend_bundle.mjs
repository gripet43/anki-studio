#!/usr/bin/env node
/**
 * Anki Studio — Comprehensive Bundle & Source Verification Suite
 * Verifies:
 * - Part 1 Guardrails (`__init__.py`):
 *   1. No `HasBottomBar` access; safe `getattr(mw, "bottomWeb", None)`
 *   2. `page.open_links_externally = False`
 *   3. `AnkiWebView(parent=target_parent)` mounted on `mw.centralWidget()`
 * - Part 2 (9 UX & Feature Enhancements):
 *   1. Dashboard sync button: `lastSyncedTimestamp`, `formatRelativeSyncLabel`, `formatAbsoluteSyncTooltip`, rotating `⟳`, `· 立即同步`
 *   2. Dashboard header: redundant bell icon button removed
 *   3. Dashboard floating tooltips: `hoveredHeatmapCell` (date + weekday + count + accuracy) & `hoveredRhythmIdx` (count + minutes)
 *   4. Cmd+K Search (`CommandPaletteModal.tsx`): `col-span-5` left list, `col-span-7` right preview, click-to-select (no `onMouseEnter` index switch), and one-click copy (`handleCopyText`)
 *   5. Reviewer ergonomics (`ReviewerView.tsx`): single-row `reviewer-dock-grid` (`h-[48px]` / `32.5rem` center bar, `.reviewer-cta-binary-again` + `.reviewer-cta-binary-good` asymmetric binary buttons)
 *   6. Dual-Mode (Light / Dark / OLED) support in `ReviewerView.tsx` and all views
 *   7. `DesignSystemView` removed from main `Sidebar.tsx` nav, gated behind `debugModeUnlocked` (triple-click version badge or `Ctrl+Shift+D`)
 *   8. Custom `TagSelectDropdown` (`tagDropdownOpen`, `tagSearchInput`, `tagCountsMap`) in `LibraryView.tsx`
 *   9. Unified `SettingsModal.tsx` + 3-Layer Native Return Safety Net (`top_toolbar_did_init_links`, `anki-modern-os-return-btn`)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADDON_ROOT = path.resolve(__dirname, '..');
const WEB_JS = path.resolve(ADDON_ROOT, 'web/assets/index.js');
const WEB_CSS = path.resolve(ADDON_ROOT, 'web/assets/index.css');
const ANKIADDON_FILE = path.resolve(ADDON_ROOT, 'anki_modern_os.ankiaddon');

/**
 * 按 LF 读取文本文件。
 *
 * Windows 版 Git 默认 `core.autocrlf=true`，会把工作区换行转成 CRLF；而本套断言
 * 大量依赖 '\n' 做字典边界与按行解析 —— 行尾一旦多出 '\r'，`parseFlatDict()`
 * 的正则 `(.*)$` 就匹配不上，字典解析出 0 条，Item #33 直接红（2026-11-13
 * Windows 验版实测）。这里统一归一化，让校验结果与平台、与 Git 行尾配置无关。
 */
function readText(file) {
  return fs.readFileSync(file, 'utf-8').replace(/\r\n?/g, '\n');
}

const initPy = readText(path.resolve(ADDON_ROOT, '__init__.py'));
const storeSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/stores/useAppStore.ts'));
const reviewerSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/reviewer/ReviewerView.tsx'));
const librarySrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/search/LibraryView.tsx'));
const cmdKSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/search/CommandPaletteModal.tsx'));
const dashboardSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/dashboard/DashboardView.tsx'));
const syncPillSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/dashboard/SyncStatusPill.tsx'));
const sidebarSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/layout/Sidebar.tsx'));
const settingsSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/settings/SettingsModal.tsx'));
const translationsSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/i18n/translations.ts'));
const editorSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/CardEditorModal.tsx'));
const appSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/App.tsx'));

function assert(condition, msg) {
  if (!condition) {
    throw new Error(`[AUDIT CHECK FAILED] ${msg}`);
  }
}

// Part 1 Guardrails in __init__.py
assert(
  !initPy.includes('mw.HasBottomBar') &&
    initPy.includes('getattr(mw, "bottomWeb", None)') &&
    initPy.includes('page.open_links_externally = False') &&
    initPy.includes('mw.centralWidget()'),
  'Part 1 Guardrails: __init__.py must safely access bottomWeb, set open_links_externally = False, and mount onto mw.centralWidget()'
);

// Item #1 & #2: Dashboard sync status upgrade + bell button removed
assert(
  dashboardSrc.includes('SyncStatusPill') &&
    syncPillSrc.includes('lastSyncedTimestamp') &&
    syncPillSrc.includes('handleTriggerSync') &&
    !dashboardSrc.includes('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9'),
  'Items #1 & #2: DashboardView must mount SyncStatusPill with relative/absolute sync time, rotating icon, and remove the bell icon button'
);

// Item #3: Floating Tooltips on Heatmap & Weekly Rhythm
assert(
  dashboardSrc.includes('hoveredHeatmapCell') &&
    dashboardSrc.includes('formatFullDateWithWeekday') &&
    dashboardSrc.includes('hoveredRhythmIdx'),
  'Item #3: DashboardView must render instant floating tooltips for Heatmap cells and Weekly Rhythm bars'
);

// Item #4: Cmd+K 5:7 split ratio, no onMouseEnter preview jump, and one-click copy
assert(
  cmdKSrc.includes('col-span-5') &&
    cmdKSrc.includes('col-span-7') &&
    !cmdKSrc.includes('onMouseEnter={() => setAppState({ cmdKSelectedIndex') &&
    cmdKSrc.includes('handleCopyText'),
  'Item #4: CommandPaletteModal must use 5:7 split ratio, click-to-select (no hover jump), and one-click copy'
);

// Item #5 & #6: Reviewer single-row 3-column dock (`48px` tall, `32.5rem` shell) & Light/Dark/System adaptation
assert(
  reviewerSrc.includes('reviewer-dock-grid') &&
    reviewerSrc.includes('reviewer-cta-shell w-full h-[48px]') &&
    reviewerSrc.includes('reviewer-cta-binary-again h-[48px]') &&
    reviewerSrc.includes('reviewer-cta-binary-good h-[48px]') &&
    !reviewerSrc.includes('reviewer-meta-btn') &&
    reviewerSrc.includes('resolveThemeMode') &&
    reviewerSrc.includes("resolvedTheme === 'dark'"),
  'Items #5 & #6: ReviewerView must use single-row reviewer-dock-grid (48px CTA height, asymmetric binary buttons, no duplicate reviewer-meta-btn) and adapt to Light/Dark themes'
);

// Guardrail: Binary mode "Good / 记得" rating button must keep fixed semantic success color
// (`--status-success`), never `--brand-*`, otherwise Rose/Amber themes make Good look like Again.
const binaryGoodBlockMatch = reviewerSrc.match(
  /reviewer-cta-binary-good[\s\S]{0,650}?rateGood/
);
assert(
  binaryGoodBlockMatch &&
    binaryGoodBlockMatch[0].includes('bg-[var(--status-success-soft)]') &&
    binaryGoodBlockMatch[0].includes('text-[var(--status-success)]') &&
    !binaryGoodBlockMatch[0].includes('var(--brand'),
  'Binary Good rating button must use fixed semantic --status-success tokens instead of theme --brand-*'
);

// Item #7: Design System removed from normal Sidebar, gated behind debugModeUnlocked
assert(
  sidebarSrc.includes('handleVersionBadgeClick') &&
    sidebarSrc.includes('debugModeUnlocked') &&
    appSrc.includes("e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd'"),
  'Item #7: DesignSystemView must be hidden from normal nav and unlocked via triple-click version badge or Ctrl+Shift+D'
);

// Item #8: Custom TagSelectDropdown in LibraryView
assert(
  librarySrc.includes('tagDropdownOpen') &&
    librarySrc.includes('tagSearchInput') &&
    librarySrc.includes('tagCountsMap'),
  'Item #8: LibraryView must use custom TagSelectDropdown with search filter and card counts'
);

// Item #9: Unified SettingsModal + 3-Layer Native Return Safety Net
assert(
  settingsSrc.includes('SettingsModal') &&
    settingsSrc.includes('shortcuts') &&
    settingsSrc.includes('showShortcutHints') &&
    initPy.includes('top_toolbar_did_init_links') &&
    (initPy.includes('anki-studio-return-btn') || initPy.includes('anki-modern-os-return-btn')),
  'Item #9: SettingsModal with dedicated shortcuts tab and native top toolbar return button injection must be present'
);

// Item #10: Keyboard shortcut badges configurable & placeholders streamlined
assert(
  storeSrc.includes('showShortcutHints') &&
    (translationsSrc.includes("searchPlaceholder: '搜索...'") ||
      translationsSrc.includes('searchPlaceholder: "搜索..."')) &&
    (translationsSrc.includes("searchLibraryPlaceholder: '搜索卡片...'") ||
      translationsSrc.includes('searchLibraryPlaceholder: "搜索卡片..."')),
  'Item #10: Keyboard shortcut hints must be configurable and search placeholders concise'
);

// Item #11: Clean UI refinements (Sidebar OS badge removed, Cmd+K empty initial state, explicit Card Edit save, Hero CTA redesigned)
assert(
  !sidebarSrc.includes('{envInfo.platformBadge}') &&
    cmdKSrc.includes('Search Cards & Decks') &&
    cmdKSrc.includes('!hasQuery') &&
    reviewerSrc.includes('hasDraftChanges') &&
    !reviewerSrc.includes('onBlur={() => commitInlineChanges()}') &&
    dashboardSrc.includes('startTodayStudy'),
  'Item #11: Clean UI refinements verified (Sidebar badge removed, Cmd+K empty state, explicit edit save, hero CTA centered)'
);

// Item #12: Unified Modern CardEditorModal (Notion-grade formatting toolbar, multi-line auto-expand, live WYSIWYG preview, Anki Cloze auto-increment)
assert(
  editorSrc.includes('applyFormatting') &&
    editorSrc.includes('cloze') &&
    editorSrc.includes('renderMathAndRichHtml') &&
    storeSrc.includes('saveCardEdits') &&
    storeSrc.includes('openCardEditor'),
  'Item #12: Unified CardEditorModal must support rich formatting, cloze auto-increment, and store actions'
);

// Item #13: Redesigned Vacation Mode & Backlog Relief (3-tier hierarchy, semantic <details>/<summary>, inline confirmation, zero blocking window.confirm)
const vacationSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/VacationModal.tsx'));
const icuSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/IcuRescueModal.tsx'));
assert(
  vacationSrc.includes('<details') &&
    vacationSrc.includes('confirmAction') &&
    !vacationSrc.includes('window.confirm') &&
    icuSrc.includes('<details') &&
    (icuSrc.includes('confirmUndo') || icuSrc.includes('confirmUndoId')) &&
    !icuSrc.includes('window.confirm') &&
    dashboardSrc.includes('享受你的假期 ^_^') &&
    dashboardSrc.includes('vacationTimelineInfo'),
  'Item #13: VacationModal, IcuRescueModal, and DashboardView must support active vacation Hero state, "享受你的假期 ^_^" prompt, <details>/<summary>, and non-blocking inline confirmation'
);

// Item #15: Parity with Anki's official statistics (Answer Buttons, True Retention, Daily Load)
const deckSrc = readText(path.resolve(ADDON_ROOT, 'bridge/deck_service.py'));
const statsViewSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/stats/StatsView.tsx'));
assert(
  deckSrc.includes('answerButtons') &&
    deckSrc.includes('trueRetention') &&
    deckSrc.includes('dailyLoad') &&
    (deckSrc.includes('ROW_NUMBER() OVER') || deckSrc.includes('first_daily')) &&
    statsViewSrc.includes('Answer Buttons') &&
    statsViewSrc.includes('True Retention') &&
    statsViewSrc.includes('dailyLoad'),
  'Item #15: Bridge and StatsView must expose Anki official Answer Buttons, True Retention and Daily Load metrics'
);

// Item #16: Full-audit guardrails — read paths stay read-only, failures are honest
const vacationServiceSrc = readText(path.resolve(ADDON_ROOT, 'bridge/vacation_service.py'));
const reviewSrc = readText(path.resolve(ADDON_ROOT, 'bridge/review_service.py'));
const searchSrc = readText(path.resolve(ADDON_ROOT, 'bridge/search_service.py'));
const editSrc = readText(path.resolve(ADDON_ROOT, 'bridge/edit_service.py'));
const pycmdSrc = readText(path.resolve(ADDON_ROOT, 'frontend/src/bridge/pycmd.ts'));
const buildSrc = readText(path.resolve(ADDON_ROOT, 'scripts/build_ankiaddon.py'));
const icuSrc2 = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/IcuRescueModal.tsx'));
assert(
  !vacationServiceSrc.includes('self._write_config({"last_rescue_receipt": receipt})') &&
    vacationServiceSrc.includes('is:due is:review') &&
    vacationServiceSrc.includes('__anki_studio_unknown_deck__') &&
    !vacationServiceSrc.includes('set_due_date(cids, "0!")') &&
    reviewSrc.includes('"answered": False') &&
    !searchSrc.includes('cids = list(col.find_cards(""))') &&
    searchSrc.includes('Unknown actionType') &&
    !editSrc.includes('return {"saved": True, "savedAt"') &&
    storeSrc.includes('dashValid') &&
    !pycmdSrc.includes('resolve({} as T)') &&
    pycmdSrc.includes('timed out after') &&
    buildSrc.includes('PRIVATE_CONFIG_KEYS') &&
    buildSrc.includes('rel.parts') &&
    initPy.includes('gui_hooks.sync_will_start.append') &&
    !icuSrc2.includes('100%'),
  'Item #16: Full-audit fixes must not regress (no fabricated receipts, no fake successes, sanitized package, honest UI)'
);

// Item #17: Card-safety harness must remain wired into the test suite
const safetyHarnessSrc = readText(path.resolve(ADDON_ROOT, 'tests/safety_harness.py'));
const safetyTestSrc = readText(path.resolve(ADDON_ROOT, 'tests/test_card_safety.py'));
assert(
  safetyHarnessSrc.includes(':memory:') &&
    safetyHarnessSrc.includes('CARD_BUSINESS_COLUMNS') &&
    safetyHarnessSrc.includes('def compare(') &&
    safetyTestSrc.includes('test_03_vacation_round_trip_is_zero_diff') &&
    safetyTestSrc.includes('test_04_rescue_undo_round_trip_is_zero_diff') &&
    safetyTestSrc.includes('test_08_pending_ticket_is_reconciled_after_a_crash') &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'bridge/safety.py')),
  'Item #17: Card-safety harness, zero-diff baselines, crash reconciliation and the safety shell must stay in the suite'
);

// Item #18: Destructive operations must go through the safety shell
assert(
  vacationServiceSrc.includes('scheduleSnapshot') &&
    vacationServiceSrc.includes('begin_ticket(') &&
    vacationServiceSrc.includes('begin_undo_group(') &&
    vacationServiceSrc.includes('verify_restoration(') &&
    !vacationServiceSrc.includes('set_due_date(list(cids), "0!")'),
  'Item #18: Bulk reschedule must capture a per-card snapshot, open a ticket, merge native undo and verify restoration'
);

// Item #19: Round-3 industrial verification and the recovery notice must stay wired
const round3Src = readText(path.resolve(ADDON_ROOT, 'tests/test_card_safety_round3.py'));
assert(
  // 崩溃恢复用例必须还在：检查 _hard_kill_self（POSIX 走 SIGKILL、Windows 走
  // os._exit），不再钉死 signal.SIGKILL —— 那个常量在 Windows 上不存在。
  round3Src.includes('_hard_kill_self') &&
    round3Src.includes('PRAGMA integrity_check') &&
    round3Src.includes('injected mid-batch I/O failure') &&
    round3Src.includes('HAS_HYPOTHESIS') &&
    round3Src.includes('line_coverage_gate') &&
    storeSrc.includes('safetyWarning') &&
    pycmdSrc.includes('SafetyWarning'),
  'Item #19: Fault injection, SIGKILL crash consistency, coverage gate and UI recovery notice must stay in the suite'
);

// Item #20: Deck Options (FSRS Presets), 7-Color Flags, and Custom Study / Mistake Drills
const decksViewSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/decks/DecksView.tsx'));
const customStudyModalSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/study/CustomStudyModal.tsx'));
assert(
  deckSrc.includes('get_deck_options') &&
    deckSrc.includes('save_deck_options') &&
    decksViewSrc.includes('saveDeckOptions') &&
    decksViewSrc.includes('desiredRetention') &&
    editSrc.includes('set_card_flag') &&
    searchSrc.includes('setFlag') &&
    reviewerSrc.includes('ANKI_FLAG_PALETTE') &&
    reviewerSrc.includes('setCurrentReviewCardFlag') &&
    librarySrc.includes('flagDropdownOpen') &&
    reviewSrc.includes('start_custom_study') &&
    customStudyModalSrc.includes('startCustomStudySession') &&
    appSrc.includes('CustomStudyModal'),
  'Item #20: Deck Options, 7-Color Flags, and Custom Study / Mistake Drills must be wired across backend and frontend'
);

// Item #21: Image Occlusion Studio & Import/Export + System Maintenance Tools
const ioModalSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx'));
const mathRendererSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mathRenderer.ts'));
assert(
  ioModalSrc.includes('buildImageOcclusionHtml') &&
    ioModalSrc.includes('parseExistingImageOcclusion') &&
    ioModalSrc.includes('anki-io-wrap') &&
    editorSrc.includes('ImageOcclusionEditorModal') &&
    reviewSrc.includes('anki-io-rect-resolved') &&
    mathRendererSrc.includes('anki-io-rect-resolved') &&
    deckSrc.includes('trigger_native_import') &&
    deckSrc.includes('trigger_native_export') &&
    deckSrc.includes('run_maintenance_action') &&
    settingsSrc.includes('triggerNativeImport') &&
    settingsSrc.includes('runMaintenanceAction'),
  'Item #21: Image Occlusion Studio and Import/Export + System Maintenance Tools must be wired across backend and frontend'
);

// Item #22: Card Creation Power Suite (Note Types, Duplicate Warning), Library Multi-Sort & Find/Replace, and Reviewer Type-in-the-Answer
assert(
  editSrc.includes('get_note_types') &&
    editSrc.includes('check_duplicate_note') &&
    editSrc.includes('createReverseCard') &&
    editorSrc.includes('localDuplicateInfo') &&
    editorSrc.includes('continuousCardCreation') &&
    editorSrc.includes('continuousCardCreationHint') &&
    !editorSrc.includes('pinnedFront') &&
    !editorSrc.includes('pinnedBack') &&
    !editorSrc.includes('pinnedTags') &&
    !editorSrc.includes('continuousAddedCount') &&
    !editorSrc.includes('保存并继续 +1') &&
    searchSrc.includes('findReplace') &&
    searchSrc.includes('removeTag') &&
    librarySrc.includes('sortDropdownOpen') &&
    librarySrc.includes('handleConfirmBatchFindReplace') &&
    librarySrc.includes('handleConfirmBatchRemoveTag') &&
    // 默写自检模式已下线：反向断言守住，避免后续被误加回来
    !reviewerSrc.includes('typeAnswerEnabled') &&
    !reviewerSrc.includes('typeAnswerDiff') &&
    reviewerSrc.includes('recallPrompt'),
  'Item #22: Card Creation Power Suite and Library Multi-Sort & Find/Replace must be wired across backend and frontend; the reviewer type-in self-check must stay removed'
);

// Item #23: Prevent accidental modal dismissal when clicking the dimmed backdrop outside any dialog
function hasOverlayBackdropClick(src) {
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (
      !lines[i].includes('fixed inset-0') ||
      !(lines[i].includes('z-50') || lines[i].includes('z-[60]'))
    ) {
      continue;
    }
    let start = i;
    while (start > 0 && !lines[start].trimStart().startsWith('<div')) {
      start--;
    }
    let end = i;
    while (end < lines.length) {
      const trimmed = lines[end].trimEnd();
      if (trimmed.endsWith('>') && !trimmed.endsWith('=>')) {
        break;
      }
      end++;
    }
    const openTag = lines.slice(start, end + 1).join('\n');
    if (openTag.includes('onClick=')) {
      return true;
    }
  }
  return false;
}

const backdropGuardedModals = [
  ['CommandPaletteModal.tsx', cmdKSrc],
  ['SettingsModal.tsx', settingsSrc],
  ['CustomStudyModal.tsx', customStudyModalSrc],
  ['DecksView.tsx', decksViewSrc],
  ['CardEditorModal.tsx', editorSrc],
  ['ImageOcclusionEditorModal.tsx', ioModalSrc],
  ['VacationModal.tsx', vacationSrc],
  ['IcuRescueModal.tsx', icuSrc],
];
for (const [name, src] of backdropGuardedModals) {
  assert(
    !hasOverlayBackdropClick(src),
    `Item #23: ${name} must not close when clicking its dimmed gray backdrop overlay`
  );
}
assert(
  cmdKSrc.includes('onClick={() => setAppState({ cmdKOpen: false })}') &&
    (cmdKSrc.includes("aria-label={isZh ? '关闭' : 'Close'}") ||
      cmdKSrc.includes("aria-label={t('close')}")),
  'Item #23: CommandPaletteModal must expose a dedicated top-right close button distinct from clearing the search query'
);

// Item #24: LibraryView collectionTotal, cross-faceted dropdown counts, and deduplicated header subtitle
assert(
  searchSrc.includes('collectionTotal') &&
    searchSrc.includes('_compute_facet_counts') &&
    storeSrc.includes('libraryFacetCounts') &&
    storeSrc.includes('collectionTotal') &&
    librarySrc.includes('libraryFacetCounts') &&
    librarySrc.includes('hasNarrowingFilter') &&
    !translationsSrc.includes('当前匹配 {matched} 张'),
  'Item #24: LibraryView must use true collectionTotal and cross-faceted backend counts without duplicated header matched-count text'
);

// Item #25: Resolve relative collection.media <img> filenames inside CardEditorModal, TowerWysiwygEditor & ImageOcclusionEditorModal
const mediaUrlSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mediaUrl.ts'));
const wysiwygSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/TowerWysiwygEditor.tsx'));
const deckSvcSrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/deck_service.py'));
const editSvcSrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/edit_service.py'));
assert(
  deckSvcSrc.includes('"mediaBaseUrl"') &&
    editSvcSrc.includes('normalize_media_html_for_storage') &&
    mediaUrlSrc.includes('resolveMediaInHtml') &&
    mediaUrlSrc.includes('extractMediaBaseUrlFromHtml') &&
    editorSrc.includes('resolveMediaInHtml') &&
    editorSrc.includes('mediaBaseUrl={effectiveMediaBaseUrl}') &&
    wysiwygSrc.includes('resolveMediaInHtml') &&
    ioModalSrc.includes('resolveMediaSrcValue'),
  'Item #25: Card editors must resolve relative collection.media images via mediaBaseUrl and normalize file:// URIs on save'
);

// Item #26: Opening Backlog Relief from Sidebar/Home must always default to the Rescue Plan tab ("减负方案"), not History
assert(
  sidebarSrc.includes("openIcuModal('rescue')") &&
    !sidebarSrc.includes("openIcuModal('history'") &&
    icuSrc.includes("store.icuModalTab === 'history' ? 'history' : 'rescue'") &&
    !icuSrc.includes('totalDue === 0 && rescueHistory.length > 0'),
  'Item #26: Backlog Relief entry must default to rescue plan tab rather than history tab'
);

// Item #27: Sync Status Pill & Settings Sync Card must follow Scheme B (no permanent glowing green dot; factual snapshot time; Intl.RelativeTimeFormat + WCAG 1.4.13 Escape dismiss)
const syncStateIconSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/SyncStateIcon.tsx'));
const hoverCardSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/HoverCard.tsx'));
assert(
  syncStateIconSrc.includes("'snapshot'") &&
    syncStateIconSrc.includes("'unsynced'") &&
    syncPillSrc.includes('<SyncStateIcon') &&
    !syncPillSrc.includes('shadow-[0_0_6px_rgba(47,148,97,0.4)]') &&
    syncPillSrc.includes('<time') &&
    (syncPillSrc.includes("e.key === 'Escape'") ||
      (syncPillSrc.includes('<HoverCard') && hoverCardSrc.includes("event.key === 'Escape'"))) &&
    settingsSrc.includes('<SyncStateIcon') &&
    !settingsSrc.includes('w-2.5 h-2.5 rounded-full bg-[var(--status-success)]') &&
    !settingsSrc.includes('实时同步') &&
    translationsSrc.includes('Intl.RelativeTimeFormat') &&
    (translationsSrc.includes("synced: '上次同步'") ||
      translationsSrc.includes('synced: "上次同步"')) &&
    (translationsSrc.includes("syncStatusProtected: '历史快照'") ||
      translationsSrc.includes('syncStatusProtected: "历史快照"')),
  'Item #27: Sync status pill and settings card must render neutral snapshot indicators, semantic <time>, Intl.RelativeTimeFormat, and Escape-dismissible hovercard'
);

// Item #28: Immediate Sync completion lifecycle must preserve verified timestamps even when Anki NO_CHANGES leaves col.ls unchanged
const item28HostSrc = readText(path.resolve(ADDON_ROOT, '__init__.py'));
const item28RouterSrc = readText(path.resolve(ADDON_ROOT, 'bridge/router.py'));
const item28AppSrc = readText(path.resolve(ADDON_ROOT, 'frontend/src/App.tsx'));
const item28StoreSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/stores/useAppStore.ts'));
assert(
  item28HostSrc.includes('handle_sync_error') &&
    item28HostSrc.includes('last_sync_checked_map') &&
    deckSvcSrc.includes('last_sync_checked_map') &&
    item28RouterSrc.includes('requiresLogin') &&
    item28RouterSrc.includes('asyncPending') &&
    item28AppSrc.includes("detail?.source === 'sync'") &&
    item28AppSrc.includes('handleNativeSyncFinished') &&
    item28StoreSrc.includes('sessionVerifiedSyncTs') &&
    item28StoreSrc.includes('pendingSyncFinishResolver') &&
    item28StoreSrc.includes('silent ? state.syncJustFinished : false') &&
    syncPillSrc.includes('Math.max(nowTick, lastSyncedTimestamp || 0)') &&
    syncPillSrc.includes('detailedTimeStr') &&
    !syncPillSrc.includes('syncSnapshotFootnote') &&
    syncPillSrc.includes('motion-safe:transition-[transform,rotate,color]') &&
    !syncPillSrc.includes("t('syncStatusProtected')") &&
    !syncPillSrc.includes("t('syncNowAction')"),
  'Item #28: Sync completion lifecycle must coordinate anki:sync-finished, handle NO_CHANGES via last_sync_checked_map + sessionVerifiedSyncTs, and preserve syncJustFinished across silent refreshes'
);

// Item #29: Library Card UI Optimization (subgrid, container queries, multi-block clamp separation, footer & accessibility fixes)
const item29MathRendererSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mathRenderer.ts'));
const item29IndexCssSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/index.css'));
assert(
  item29MathRendererSrc.includes('export function formatCardPreviewHtml') &&
    item29IndexCssSrc.includes('.library-card-flip-inner') &&
    item29IndexCssSrc.includes('.library-card-face') &&
    item29IndexCssSrc.includes('@keyframes library-card-sheen') &&
    item29IndexCssSrc.includes('transition-delay: 220ms') &&
    item29IndexCssSrc.includes('.library-card-answer') &&
    item29IndexCssSrc.includes('.library-card-edit-btn') &&
    librarySrc.includes('formatCardPreviewHtml') &&
    librarySrc.includes('library-card-flip-inner') &&
    librarySrc.includes('library-card-face-front') &&
    librarySrc.includes('library-card-face-back') &&
    librarySrc.includes('library-card-tags') &&
    librarySrc.includes('library-card-edit-btn') &&
    librarySrc.includes('aria-pressed={isSelected}') &&
    librarySrc.includes('table-fixed') &&
    librarySrc.includes('library-table-preview') &&
    !librarySrc.includes('p-2.5 rounded-xl text-[12px] leading-relaxed line-clamp-2'),
  'Item #29: LibraryView cards must keep flip faces, delayed hover animation + sheen, front/back content separation, and accessible targets'
);

// Item #32: DOM 事件 target 防御 — .closest() 只允许出现在 domTarget helper 中
const domTargetSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/domTarget.ts'));
const windowDragSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/windowDrag.ts'));
assert(
  domTargetSrc.includes("typeof (target as Element).closest !== 'function'") &&
    domTargetSrc.includes('isContentEditable') &&
    !reviewerSrc.includes('.closest(') &&
    !windowDragSrc.includes('.closest('),
  'Item #32: event.target must go through domTarget helpers; no direct .closest() calls outside the defensive helper'
);

// Item #30: Hook 顺序守卫 —— 任何顶层提前 return 之后都不允许再出现 Hook 调用
const reviewerHookNames = ['useState(', 'useEffect(', 'useMemo(', 'useRef(', 'useCallback('];
const reviewerLastHookIdx = Math.max(
  ...reviewerHookNames.map((name) => reviewerSrc.lastIndexOf(name))
);
const reviewerSessionEarlyReturnIdx = reviewerSrc.lastIndexOf(
  'if (isSessionComplete || !currentCard) {'
);
assert(
  reviewerSessionEarlyReturnIdx > reviewerLastHookIdx,
  'Item #30: ReviewerView 的会话完成态提前 return 必须位于所有 Hook 之后，否则 React 抛 #310'
);

// Item #31: 16-Language i18n System aligned with official Anki desktop languages
const designSystemSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/design-system/DesignSystemView.tsx'));
assert(
  deckSrc.includes('SUPPORTED_LANG_CODES') &&
    deckSrc.includes('normalize_language_code') &&
    translationsSrc.includes('SUPPORTED_LANGUAGES') &&
    translationsSrc.includes("'zh-TW'") &&
    translationsSrc.includes("'pt-BR'") &&
    translationsSrc.includes('export function isRtlLanguage') &&
    !translationsSrc.includes('...EN_DICT') &&
    !translationsSrc.includes('...ZH_CN_DICT') &&
    appSrc.includes('isRtlLanguage') &&
    appSrc.includes("rootEl.dir = isRtl ? 'rtl' : 'ltr'") &&
    appSrc.includes("dir={isRtl ? 'rtl' : 'ltr'}") &&
    item29IndexCssSrc.includes('[dir="rtl"]') &&
    settingsSrc.includes('SUPPORTED_LANGUAGES') &&
    settingsSrc.includes('tiledLanguageOptions') &&
    !/<select\b/.test(settingsSrc.replace(/\/\/.*$/gm, '')) &&
    designSystemSrc.includes('SUPPORTED_LANGUAGES') &&
    designSystemSrc.includes('...SUPPORTED_LANGUAGES.map') &&
    !/<select\b/.test(designSystemSrc.replace(/\/\/.*$/gm, '')) &&
    !reviewerSrc.includes('isZh') &&
    !librarySrc.includes('isZh') &&
    !dashboardSrc.includes('isZh') &&
    !settingsSrc.includes('isZh') &&
    !decksViewSrc.includes('isZh') &&
    !statsViewSrc.includes('isZh') &&
    !editorSrc.includes('isZh') &&
    !cmdKSrc.includes('isZh') &&
    !vacationSrc.includes('isZh') &&
    !icuSrc.includes('isZh') &&
    !customStudyModalSrc.includes('isZh') &&
    !sidebarSrc.includes('isZh') &&
    !syncPillSrc.includes('isZh') &&
    !storeSrc.includes('isZh'),
  'Item #31: 16-language i18n system must have 100% own key coverage (no ...EN_DICT fallback), zero isZh inline ternaries across all components, Arabic RTL dir="rtl", and flat tiled language selector without <select>'
);

// Item #32: 快捷搜索「清空」后焦点必须回到输入框
assert(
  cmdKSrc.includes('const searchInputRef = useRef<HTMLInputElement>(null)') &&
    /ref=\{searchInputRef\}/.test(cmdKSrc) &&
    /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/.test(cmdKSrc) &&
    cmdKSrc.includes('searchInputRef.current?.focus()'),
  'Item #32: CommandPaletteModal 的清空按钮必须在 mousedown 阻止焦点转移，并在 click 后把焦点交还搜索输入框'
);

// Item #33: 16 语言字典完整性与占位符守卫
const LOCALE_DIR = path.resolve(ADDON_ROOT, 'frontend/src/i18n/locales');
const EXPECTED_LOCALES = [
  'ar', 'de', 'es', 'fr', 'it', 'ja', 'ko',
  'nl', 'pl', 'pt-BR', 'ru', 'tr', 'vi', 'zh-TW',
];

function parseFlatDict(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  if (start < 0) return null;
  const rest = src.slice(start + startMarker.length);
  const end = rest.indexOf(endMarker);
  const body = end < 0 ? rest : rest.slice(0, end);
  const map = new Map();
  for (const line of body.split('\n')) {
    const m = /^ {2}([A-Za-z0-9_]+):\s*(['"])(.*)\2,?$/.exec(line);
    if (m) map.set(m[1], m[3]);
  }
  return map;
}

const zhDict = parseFlatDict(translationsSrc, 'const ZH_CN_DICT = {', '\n} as const;');
const enDict = parseFlatDict(translationsSrc, 'const EN_DICT: TranslationTable = {', '\n};');
assert(
  zhDict && zhDict.size > 500,
  `Item #33: 解析 ZH_CN 基准字典失败（解析到 ${zhDict ? zhDict.size : 0} 条）`
);

const placeholdersOf = (text) => (text.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort().join(',');
const dictProblems = [];

function compareDict(label, dict) {
  if (!dict) {
    dictProblems.push(`${label}: 解析失败`);
    return;
  }
  const zhKeys = [...zhDict.keys()];
  const lost = zhKeys.filter((k) => !dict.has(k));
  const extra = [...dict.keys()].filter((k) => !zhDict.has(k));
  if (lost.length) dictProblems.push(`${label} 缺 ${lost.length} 键（如 ${lost.slice(0, 3).join(', ')}）`);
  if (extra.length) dictProblems.push(`${label} 多 ${extra.length} 键（如 ${extra.slice(0, 3).join(', ')}）`);
  for (const k of zhKeys) {
    const a = placeholdersOf(zhDict.get(k));
    const b = placeholdersOf(dict.get(k) || '');
    if (a !== b) dictProblems.push(`${label}.${k} 占位符不一致：[${a}] vs [${b}]`);
  }
}

compareDict('EN', enDict);
for (const lang of EXPECTED_LOCALES) {
  const file = path.join(LOCALE_DIR, `${lang}.ts`);
  if (!fs.existsSync(file)) {
    dictProblems.push(`${lang}.ts 不存在`);
    continue;
  }
  compareDict(
    lang,
    parseFlatDict(
      readText(file),
      'export const dict: TranslationTable = {',
      '\n};'
    )
  );
}
assert(
  dictProblems.length === 0,
  `Item #33: 语言字典不一致（首包常驻 + 懒加载 14 种）→\n  ${dictProblems.slice(0, 8).join('\n  ')}`
);

// 越南语是拉丁字母语言，混进汉字说明翻译时保留了中文词，界面会直接露馅
const viSrc = readText(path.join(LOCALE_DIR, 'vi.ts'));
const viCjkLines = viSrc.split('\n').filter((l) => /[\u4e00-\u9fff]/.test(l));
assert(
  viCjkLines.length === 0,
  `Item #33: 越南语字典残留中文字符 → ${viCjkLines.slice(0, 3).join(' | ')}`
);

// Item #34: Windows 验版报告 8 项修复守卫
const smokePySrc = readText(path.resolve(ADDON_ROOT, 'tests/scenarios/smoke.py'));
const runPySrc = readText(path.resolve(ADDON_ROOT, 'tests/scenarios/run.py'));
const pathsPySrc = readText(path.resolve(ADDON_ROOT, 'tests/scenarios/paths.py'));
assert(
  runPySrc.includes("'_global'") &&
    runPySrc.includes('"firstRun": False') &&
    runPySrc.includes('dirs_exist_ok=True') &&
    pathsPySrc.includes('configure_utf8_stdio') &&
    smokePySrc.includes('self.col.db.scalar(sql)') &&
    smokePySrc.includes('self.col.db.all(sql)') &&
    initPy.includes('MODERN_DEFAULT_WIDTH') &&
    initPy.includes('ApplicationShortcut') &&
    initPy.includes('anki:open-settings') &&
    appSrc.includes('anki:open-settings') &&
    appSrc.includes("e.key.toLowerCase() === 'p'") &&
    dashboardSrc.includes('col-span-12 xl:col-span-7') &&
    dashboardSrc.includes('col-span-12 xl:col-span-5') &&
    dashboardSrc.includes('flex-col lg:flex-row') &&
    vacationServiceSrc.includes('not hasattr(col, "_backend")'),
  'Item #34: Windows QA fixes (prefs21.db _global row, smoke.py col.db lock reuse, window sizing, ApplicationShortcut, Ctrl+P settings, responsive hero/analytics, and deprecated API guards) must remain in place'
);

function listZipEntries(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const minOffset = Math.max(0, buf.length - 65557);
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= minOffset; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  assert(eocdOffset >= 0, `Invalid .ankiaddon zip archive (missing EOCD): ${zipPath}`);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = cdOffset;
  for (let idx = 0; idx < totalEntries; idx += 1) {
    assert(
      cursor + 46 <= buf.length && buf.readUInt32LE(cursor) === 0x02014b50,
      `Corrupt central directory entry #${idx} in ${zipPath}`
    );
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    entries.push(name);
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const jsBundle = readText(WEB_JS);
const cssBundle = readText(WEB_CSS);
assert(
  jsBundle.length > 100000 &&
    cssBundle.length > 10000 &&
    cssBundle.includes('library-card-snippet-body') &&
    cssBundle.includes('library-card-footer-meta') &&
    cssBundle.includes('.reviewer-dock-grid') &&
    cssBundle.includes('.reviewer-cta-binary-good') &&
    cssBundle.includes('.reviewer-side-rail') &&
    cssBundle.includes('.reviewer-side-stage') &&
    reviewerSrc.includes('reviewer-side-rail') &&
    reviewerSrc.includes('reviewer-side-stage') &&
    reviewerSrc.includes('reviewDockPosition') &&
    fs.existsSync(ANKIADDON_FILE),
  'Compiled production bundle and anki_modern_os.ankiaddon must exist with Library card, Reviewer dock, and Side Rail CSS/TSX rules'
);

const addonZipEntries = listZipEntries(ANKIADDON_FILE);
assert(
  addonZipEntries.length >= 20 &&
    addonZipEntries.includes('__init__.py') &&
    addonZipEntries.includes('manifest.json') &&
    addonZipEntries.includes('config.json') &&
    addonZipEntries.includes('web/index.html') &&
    !addonZipEntries.some((entry) => /^(tests|frontend|scripts|node_modules)\/|^(meta\.json|\.git)/.test(entry)),
  `anki_modern_os.ankiaddon must contain valid runtime whitelist and web/index.html (got ${addonZipEntries.length} entries)`
);

// Item #35: 动效体系整体补齐门禁 —— 校验构建产物 CSS 包含全部核心动效类、令牌与无障碍降级，且源码中任意 animate-* 类均在产物 CSS 中真实存在
const frontendPkgSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/package.json'));
assert(
  !frontendPkgSrc.includes('framer-motion'),
  'Item #35: frontend/package.json must not include unused framer-motion dependency'
);

const requiredCssTokensAndRules = [
  '.animate-in',
  '.fade-in',
  '.slide-in-from-top-4',
  '.delay-stagger-1',
  '.animate-sync-border-flash',
  '@keyframes ui-fade-in',
  '--dur-fast',
  'prefers-reduced-motion',
];
for (const token of requiredCssTokensAndRules) {
  assert(
    cssBundle.includes(token),
    `Item #35: Compiled web/assets/index.css is missing required motion rule/token: ${token}`
  );
}

function collectTsxFiles(dirPath, acc = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(full, acc);
    } else if (entry.isFile() && full.endsWith('.tsx')) {
      acc.push(full);
    }
  }
  return acc;
}

const tsxFiles = collectTsxFiles(path.resolve(ADDON_ROOT, 'frontend/src'));
const usedAnimateClasses = new Set();
for (const file of tsxFiles) {
  const content = readText(file);
  const matches = content.match(/\banimate-[a-zA-Z0-9_-]+/g) || [];
  for (const cls of matches) {
    usedAnimateClasses.add(cls);
  }
}
assert(
  usedAnimateClasses.size > 0,
  'Item #35: Expected to discover animate-* classes across frontend/src/**/*.tsx'
);
for (const cls of usedAnimateClasses) {
  assert(
    cssBundle.includes(`.${cls}`) || cssBundle.includes(`.motion-safe\\:${cls}`),
    `Item #35: TSX references class "${cls}" but ".${cls}" (or ".motion-safe:${cls}") is missing from compiled web/assets/index.css`
  );
}

// Guardrail: DashboardView must keep overflow-y-auto on the full-width outer scroll container,
// never on the max-w-[1440px] centered `.dashboard-shell`, otherwise fullscreen monitors show a floating mid-screen scrollbar.
assert(
  !/className="[^"]*\bdashboard-shell\b[^"]*\boverflow-y-auto\b/.test(dashboardSrc) &&
    !/className="[^"]*\boverflow-y-auto\b[^"]*\bdashboard-shell\b/.test(dashboardSrc),
  'DashboardView must not combine .dashboard-shell (max-width: 1440px) with overflow-y-auto on the same element'
);

// Item #36: Dashboard visual hierarchy — semantic surfaces, content-aware grids, and reduced visual noise
const dashboardCssSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/index.css'));
assert(
  dashboardSrc.includes('dashboard-shell') &&
    dashboardSrc.includes('dashboard-header') &&
    dashboardSrc.includes('dashboard-surface') &&
    dashboardSrc.includes('dashboard-hero') &&
    dashboardSrc.includes('dashboard-stat-pill') &&
    dashboardSrc.includes('dashboard-deck-grid') &&
    dashboardSrc.includes('dashboard-heatmap-viewport') &&
    (dashboardSrc.includes('ChartTooltipPortal') || dashboardSrc.includes('<Tooltip')) &&
    dashboardSrc.includes('<HoverCard') &&
    dashboardSrc.includes("'--deck-brand-soft'") &&
    dashboardSrc.includes("'--deck-brand-text'") &&
    dashboardCssSrc.includes('--dashboard-shadow-card') &&
    dashboardCssSrc.includes('--tooltip-bg') &&
    dashboardCssSrc.includes('.dashboard-tooltip') &&
    dashboardCssSrc.includes('.dashboard-surface') &&
    dashboardCssSrc.includes('.dashboard-deck-grid') &&
    dashboardCssSrc.includes('.dashboard-heatmap-viewport') &&
    dashboardCssSrc.includes('background-color: var(--deck-brand-soft)') &&
    statsViewSrc.includes('hoveredForecastIdx') &&
    statsViewSrc.includes('hoveredMaturitySeg') &&
    statsViewSrc.includes('hoveredRetentionIdx') &&
    statsViewSrc.includes('hoveredHourlyIdx') &&
    (statsViewSrc.includes('ChartTooltipPortal') || statsViewSrc.includes('<Tooltip')) &&
    wysiwygSrc.includes('STUDY_EMOJIS') &&
    wysiwygSrc.includes('savedRangeRef') &&
    wysiwygSrc.includes("toggleDropdown('emoji')") &&
    !wysiwygSrc.includes('overflow-x-auto') &&
    customStudyModalSrc.includes('role="radiogroup"') &&
    customStudyModalSrc.includes('<details') &&
    customStudyModalSrc.includes("e.key === 'Escape'") &&
    cssBundle.includes('dashboard-surface') &&
    cssBundle.includes('dashboard-deck-grid') &&
    cssBundle.includes('dashboard-heatmap-viewport') &&
    cssBundle.includes('dashboard-tooltip') &&
    cssBundle.includes('--tooltip-bg') &&
    syncPillSrc.includes('<HoverCard'),
  'Item #36: Dashboard must use semantic surface tokens, Level-2 tonal deck study button, unified Tooltip/HoverCard primitives, unclipped WYSIWYG emoji picker, and 3-tier CustomStudyModal hierarchy'
);

// Item #37: 卡片库排序层级 + 同步云图标 + 顶栏角标移除 + 编辑器 Esc 作用域 + 火焰暖光晕
const syncIconSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/SyncStateIcon.tsx'));
const flameSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/dashboard/StreakFlameBackdrop.tsx'));

// 排序是「交叉维度」：必须在筛选胶囊组之外、靠右、且自身不是描边胶囊。
const sortBlockStart = librarySrc.indexOf('ref={sortDropdownRef}');
assert(sortBlockStart > 0, 'Item #37: LibraryView 里找不到 sortDropdownRef 排序控件');
const sortBlockEnd = librarySrc.indexOf('{sortDropdownOpen &&', sortBlockStart);
assert(sortBlockEnd > sortBlockStart, 'Item #37: 排序控件结构变了，找不到下拉面板起点');
const sortButtonSrc = librarySrc.slice(sortBlockStart, sortBlockEnd);
assert(
  librarySrc.includes('ms-auto') &&
    sortButtonSrc.includes('aria-haspopup="menu"') &&
    !sortButtonSrc.includes('rounded-full'),
  'Item #37: 排序控件必须靠右（ms-auto）、带 aria-haspopup，且不能再用筛选胶囊的 rounded-full 形态'
);
assert(
  librarySrc.includes('absolute end-0 top-10 z-40 w-[230px]'),
  'Item #37: 排序下拉必须锚定 end-0，否则贴右后会被视口右侧裁掉'
);

// 同步状态里的绿点已换成云朵图标，颜色走主题色而不是写死的状态绿。
assert(
  syncPillSrc.includes('SyncStateIcon') &&
    syncPillSrc.includes('size="sm"') &&
    !syncPillSrc.includes('bg-[#22C55E]'),
  'Item #37: SyncStatusPill 必须用 SyncStateIcon 云朵，且不得回退到 bg-[#22C55E] 绿点'
);
assert(
  syncIconSrc.includes('text-[var(--brand-text)]'),
  'Item #37: SyncStateIcon 的云端快照图标必须用主题色 --brand-text'
);

// 顶栏搜索框不再挂 ⌘K / Ctrl K 角标。
assert(
  !dashboardSrc.includes('⌘K') && !dashboardSrc.includes('<kbd'),
  'Item #37: DashboardView 不应再渲染快捷键角标（⌘K / <kbd>）'
);

// 富文本编辑器的 Esc 必须在捕获阶段消费，否则会连带关掉整个制卡弹窗。
assert(
  wysiwygSrc.includes("addEventListener('keydown', handleKeyDownEscape, true)") &&
    wysiwygSrc.includes('anyDropdownOpenRef'),
  'Item #37: TowerWysiwygEditor 的 Esc 必须在捕获阶段拦截，且仅在有浮层打开时生效'
);

// 连胜火焰的双层火苗 + 径向暖光晕是用户明确认可的版本，守死不让它再被删。
assert(
  flameSrc.includes('glowGradId') && flameSrc.includes('<ellipse'),
  'Item #37: StreakFlameBackdrop 必须保留径向暖光晕（<ellipse> + glowGradId）'
);
const heroRuleStart = dashboardCssSrc.indexOf('.dashboard-hero {');
assert(heroRuleStart > 0, 'Item #37: index.css 里找不到 .dashboard-hero 规则');
const heroRule = dashboardCssSrc.slice(heroRuleStart, dashboardCssSrc.indexOf('}', heroRuleStart));
assert(
  heroRule.includes('radial-gradient'),
  'Item #37: .dashboard-hero 底色必须是与火焰配套的橙色 radial-gradient，不要退回斜向品牌色淡染'
);

// Item #38: 新建/编辑卡片单按钮循环预览、图片遮挡工具栏整合与富文本编辑器深度修复（CardEditorModal.tsx + TowerWysiwygEditor.tsx + mathRenderer.ts）
assert(
  editorSrc.includes("const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit')") &&
    editorSrc.includes('previewFlipped') &&
    editorSrc.includes('clozeOrdinals') &&
    editorSrc.includes('previewReverseDir') &&
    editorSrc.includes('ui-answer-reveal') &&
    editorSrc.includes('ui-divider-reveal') &&
    // 2026-11-13 产品改为「遮挡卡只显示、不创建不编辑」：工具栏入口仍存在，
    // 但由策略常量控制是否挂载，不再无条件 setIoEditorOpen(true)。
    editorSrc.includes('onOpenImageOcclusion={') &&
    editorSrc.includes('IMAGE_OCCLUSION_AUTHORING_ENABLED') &&
    !editorSrc.includes('onOpenImageOcclusion={() => setIoEditorOpen(true)}') &&
    !editorSrc.includes('role="tablist"') &&
    !editorSrc.includes('⌘P') &&
    mathRendererSrc.includes('activeClozeOrd?: number') &&
    wysiwygSrc.includes('isComposingRef') &&
    wysiwygSrc.includes('exitInlinePill') &&
    wysiwygSrc.includes('syncInlinePillsInPlace') &&
    wysiwygSrc.includes('onOpenImageOcclusion') &&
    wysiwygSrc.includes("t('editorHelpTitle')") &&
    wysiwygSrc.includes("document.queryCommandState('bold')") &&
    !wysiwygSrc.includes("findClosestElement(anchor, 'b, strong', editorRef.current)) ||") &&
    !wysiwygSrc.includes("const selectedText = range.toString().trim() || '...';") &&
    dashboardCssSrc.includes('.anki-cloze-body[data-empty="true"]::after'),
  'Item #38: CardEditorModal 与 TowerWysiwygEditor 必须支持顶栏单按钮循环切换编辑/查看、移除左下角查看按钮、遮挡入口受策略常量控制、加粗/斜体即时状态翻转与多语言帮助说明'
);

// Item #39: 牌组卡配色必须由主题色派生（utils/deckPalette.ts）。
// 历史上这里按列表位置轮流派发 indigo/blue/emerald/amber/rose/purple 六个色系，
// 与用户选的主题色完全无关 —— 选「经典蓝」，第二张牌组仍是青的、第三张仍是绿的。
const deckPalettePath = path.resolve(ADDON_ROOT, 'frontend/src/utils/deckPalette.ts');
assert(fs.existsSync(deckPalettePath), 'Item #39: 找不到 frontend/src/utils/deckPalette.ts');
const deckPaletteSrc = readText(deckPalettePath);

assert(
  dashboardSrc.includes('buildDeckScales') && !dashboardSrc.includes('deckAccentToTheme'),
  'Item #39: 首页牌组配色必须走 buildDeckScales(主题色阶)，不得再用 deckAccentToTheme 这类写死的 accent→色系映射'
);
assert(
  /const deckScales = useMemo\(\(\) => buildDeckScales\(accentScale\)/.test(dashboardSrc),
  'Item #39: deckScales 必须按 accentScale 记忆化，否则切换主题色时牌组颜色不会重算'
);
assert(
  !/#[0-9a-fA-F]{3,6}\b/.test(deckPaletteSrc),
  'Item #39: deckPalette 里不得出现写死的十六进制颜色，配色必须全部来自传入的主题色阶'
);

// 色相偏移量级是实测定下来的：经典蓝 h≈212°，+20° 已经发紫、−20° 已经发青，
// 一旦超过 15° 就会退回「彩色牌组」，等于把这个 bug 换个写法又装回去。
const deckHueOffsets = [...deckPaletteSrc.matchAll(/hue:\s*(-?\d+(?:\.\d+)?)/g)].map((m) =>
  Math.abs(Number(m[1]))
);
assert(
  deckHueOffsets.length >= 4,
  'Item #39: deckPalette 的色相偏移表被改坏了（解析不到 4 个以上 hue 值）'
);
assert(
  Math.max(...deckHueOffsets) <= 15,
  `Item #39: 牌组色相偏移最大 ${Math.max(...deckHueOffsets)}°，超过 15° 就跑出主题色家族了`
);

// ── Item #40：文案里的快捷键必须随平台走，不得写死 `Cmd` ──────────────
// 背景：r4 的 Windows 验版把 A8（快捷键与界面提示一致）判为失败，唯一原因是
// `editorFrontPlaceholder` 里写死了 `Cmd+Shift+C`，Windows 上照样显示 Cmd。
// 修掉当前这一条不够——下一位助手随手新加一条带快捷键的文案就会复发。
// 所以这里不看具体某个键，而是扫全部语言包：**任何一条文案值只要出现 `Cmd`
// 却不同时出现 `Ctrl`（即没有把两个平台并列写出来），就判失败**。
const i18nDir = path.resolve(ADDON_ROOT, 'frontend/src/i18n');
const i18nFiles = [
  path.join(i18nDir, 'translations.ts'),
  ...fs
    .readdirSync(path.join(i18nDir, 'locales'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => path.join(i18nDir, 'locales', f)),
];

const hardcodedCmdSites = [];
for (const file of i18nFiles) {
  readText(file)
    .split('\n')
    .forEach((line, idx) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)"/);
      if (!m) return;
      const [, key, value] = m;
      if (/\bCmd\b/.test(value) && !/\bCtrl\b/.test(value)) {
        hardcodedCmdSites.push(`${path.basename(file)}:${idx + 1} (${key})`);
      }
    });
}
assert(
  hardcodedCmdSites.length === 0,
  `Item #40: 以下文案写死了 Cmd，Windows/Linux 上会显示按不出来的快捷键，` +
    `请改成 {shortcut} 并由 formatShortcut() 注入（或像 ioEmptyCanvasSub 那样把 Ctrl 一并写出）：\n  ` +
    hardcodedCmdSites.join('\n  ')
);

// 两条已参数化的键：每个含该键的语言包都必须真的带上 {shortcut}。
const SHORTCUT_PARAM_KEYS = ['editorFrontPlaceholder', 'ioEmptyCanvasTitle'];
const unparameterized = [];
for (const file of i18nFiles) {
  const src = readText(file);
  for (const key of SHORTCUT_PARAM_KEYS) {
    const m = src.match(new RegExp(`^\\s*${key}:\\s*"([^"]*)"`, 'm'));
    if (!m) continue; // 该语言包未覆盖此键，由 TranslationTable 类型在编译期兜底
    if (!m[1].includes('{shortcut}')) unparameterized.push(`${path.basename(file)} (${key})`);
  }
}
assert(
  unparameterized.length === 0,
  `Item #40: 以下语言包的文案缺少 {shortcut} 占位符，快捷键会退化成写死文本：\n  ` +
    unparameterized.join('\n  ')
);

// 复用文件开头已读取的 translationsSrc（同一个文件），不重复声明。
assert(
  translationsSrc.includes('${k}') && translationsSrc.includes('String(v)'),
  'Item #40: translate() 的 {占位符} 插值实现被移除了，传入 params 也不会生效'
);

// 光有占位符不够，调用点必须真的把参数传进去，否则界面上会直接显示 `{shortcut}`。
const cardEditorSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/CardEditorModal.tsx'));
const ioEditorSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx'));

const frontPlaceholderCalls = (
  cardEditorSrc.match(/t\('editorFrontPlaceholder',\s*\{\s*shortcut:/g) || []
).length;
assert(
  !cardEditorSrc.includes("t('editorFrontPlaceholder')"),
  'Item #40: CardEditorModal 里仍有不带 shortcut 参数的 editorFrontPlaceholder 调用（会直接显示 {shortcut}）'
);
assert(
  frontPlaceholderCalls === 2,
  `Item #40: CardEditorModal 应有 2 处带 shortcut 参数的 editorFrontPlaceholder 调用（输入框 placeholder + 预览空态），实际 ${frontPlaceholderCalls} 处`
);
assert(
  /const clozeShortcutStr = formatShortcut\('Cmd\+Shift\+C',\s*envInfo\.platform\)/.test(cardEditorSrc),
  'Item #40: clozeShortcutStr 必须由 formatShortcut(..., envInfo.platform) 生成，不能写死 Cmd+Shift+C'
);
assert(
  /t\('ioEmptyCanvasTitle',\s*\{\s*shortcut:/.test(ioEditorSrc),
  'Item #40: 图片遮挡空画布的 ioEmptyCanvasTitle 未传入 shortcut 参数'
);
assert(
  /const pasteShortcutStr = formatShortcut\('Cmd\+V',\s*envInfo\.platform\)/.test(ioEditorSrc),
  'Item #40: pasteShortcutStr 必须由 formatShortcut(..., envInfo.platform) 生成'
);

// Item #41: 8 大热门第三方 APKG 卡包在学习、搜索与编辑模式下的兼容性守卫
const mediaUtilsPySrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/media_utils.py'));
assert(
  mediaUtilsPySrc.includes('def strip_front_side_from_answer') &&
    mediaUtilsPySrc.includes('def convert_furigana_to_ruby') &&
    mediaUtilsPySrc.includes('def _apply_jlpt_script_transforms') &&
    mediaUtilsPySrc.includes('MDX_INDEX_MARKER_RE') &&
    mediaUtilsPySrc.includes('CSS_HARSH_CARD_BG_RE') &&
    reviewSrc.includes('convert_furigana_to_ruby') &&
    searchSrc.includes('convert_furigana_to_ruby') &&
    mathRendererSrc.includes('FURIGANA_BRACKET_RE') &&
    mathRendererSrc.includes('MDX_INDEX_MARKER_RE') &&
    cardEditorSrc.includes('pickEditorFrontAndBackKeys') &&
    cardEditorSrc.includes('METADATA_SKIP_FIELDS') &&
    cardEditorSrc.includes('READING_SKIP_FIELDS') &&
    dashboardCssSrc.includes('.anki-native-card table') &&
    dashboardCssSrc.includes('ruby rt'),
  'Item #41: 8 大第三方 APKG 卡包兼容规则（FrontSide 去重、日语振假名转 ruby、JLPT 脚本标签还原、MDX 标记清洗、表格自适应与编辑器字段智能匹配）必须完整保留'
);

// Item #42: 复习器 `<style>` 块防 `<br/>` 破坏守卫 + Track B 原生沙盒模式（SandboxCardFrame + mediasrv HTTP）
const sandboxFrameSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/reviewer/SandboxCardFrame.tsx'));
const sandboxCodeNoComments = sandboxFrameSrc.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
assert(
  mathRendererSrc.includes('preservedStyleBlocks') &&
    mathRendererSrc.includes("!html.includes('anki-native-card')") &&
    mediaUtilsPySrc.includes('def get_media_http_base_url') &&
    mediaUtilsPySrc.includes('def render_sandbox_card_sides') &&
    sandboxCodeNoComments.includes('sandbox="allow-scripts"') &&
    !sandboxCodeNoComments.includes('allow-same-origin') &&
    sandboxCodeNoComments.includes('anki-sandbox-pycmd') &&
    sandboxCodeNoComments.includes('renderLatexInSandboxHtml') &&
    editorSrc.includes('const nativeFrontHtml = renderMathAndRichHtml(') &&
    reviewerSrc.includes('SandboxCardFrame') &&
    (reviewerSrc.includes('toggleCompatMode') || reviewerSrc.includes('toggleNoteTypeSandbox')),
  'Item #42: mathRenderer.ts 必须保护 <style> 块不被注入 <br/>，且 Track B SandboxCardFrame 必须使用 sandbox="allow-scripts"（严禁 allow-same-origin）与本地 HTTP 媒体服务'
);

// Item #43: 学习统计页必须复用卡片库的错峰入场动效（同一套 keyframes / 曲线 / 降级规则）
// 先把 CSS 压成单行，避免正则被缩进量、空行与新格式牵着走；
// 断言必须把「选择器」和「动画声明」绑在一起 —— 只查选择器的话，
// 下面 prefers-reduced-motion 里那对同样的选择器会让检查假绿。
const cssCompact = dashboardCssSrc.replace(/\s+/g, ' ');
const statsPanelCount = (statsViewSrc.match(/stats-panel-enter/g) || []).length;
assert(
  librarySrc.includes('library-card-enter') &&
    librarySrc.includes('animationDelay') &&
    statsPanelCount >= 6 &&
    statsViewSrc.includes('enterDelay(') &&
    statsViewSrc.includes('const ENTER_STAGGER_MS = 28') &&
    cssCompact.includes('@keyframes ui-stagger-enter') &&
    cssCompact.includes(
      '.library-card-enter, .stats-panel-enter { animation: ui-stagger-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }'
    ) &&
    cssCompact.includes(
      '@media (prefers-reduced-motion: reduce) { .library-card-enter, .stats-panel-enter { animation: none; }'
    ),
  'Item #43: 学习统计页 6 个面板必须复用卡片库的错峰入场动效（同一套 ui-stagger-enter 关键帧、同一条缓动曲线、同样在 prefers-reduced-motion 下关闭）'
);

// Item #44: 遮挡卡的预览必须读 ioPayload.previewHtml，而不是只读 front/back。
// 用户往输入框里一个字都没写时，图片与遮罩全在 ioPayload 上；只读 front/back
// 会让「预览」变成一块白板（2026-11-13 实拍报障）。
assert(
  cardEditorSrc.includes("const ioPreviewHtml = ioPayload ? ioPayload.previewHtml : ''") &&
    cardEditorSrc.includes('ioPreviewHtml || (isReverseSecondCard ? back : front)') &&
    cardEditorSrc.includes("!front.includes('anki-io-wrap') && !ioPayload") &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'tests/frontend/specs/occlusionPreview.spec.ts')),
  'Item #44: 图片遮挡卡的预览必须把 ioPayload.previewHtml 当作正面内容源（否则整块预览空白），并由 occlusionPreview.spec.ts 守住遮罩渲染'
);

// Item #45: 图片遮挡「只显示、不创建不编辑」的产品边界。
// 关键点不是把按钮藏起来，而是：① 判别要走结构化信号（不能误锁普通卡）；
// ② 只读卡默认落在预览态、没有保存按钮、Esc 不切进不存在的编辑页；
// ③ handleSubmit 有兜底 return，任何漏掉的入口都写不回去；
// ④ 16 语言提示文案齐全（Item #33 会逐字典校验键与占位符）。
const policySrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/imageOcclusionPolicy.ts'));
assert(
  policySrc.includes('IMAGE_OCCLUSION_AUTHORING_ENABLED = false') &&
    policySrc.includes('export function isImageOcclusionNote') &&
    policySrc.includes('image-occlusion:') &&
    policySrc.includes('anki-io-wrap') &&
    editorSrc.includes('isImageOcclusionNote(editingCardData)') &&
    editorSrc.includes("setEditorMode(readOnlyImageOcclusion ? 'preview' : 'edit')") &&
    editorSrc.includes('!readOnlyImageOcclusion && (') &&
    editorSrc.includes('if (readOnlyImageOcclusion || isIoModelSelected || !canSubmit || submitting) return;') &&
    editorSrc.includes("t('ioEditUnsupportedTitle')") &&
    editorSrc.includes("t('ioEditUnsupportedSub')") &&
    editorSrc.includes('if (readOnlyImageOcclusion) handleAttemptClose();') &&
    translationsSrc.includes('ioEditUnsupportedTitle:') &&
    translationsSrc.includes('ioEditUnsupportedSub:') &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'tests/frontend/specs/imageOcclusionPolicy.spec.ts')),
  'Item #45: 图片遮挡必须只读（新建/编辑入口全关、结构化判别、默认预览态、无保存按钮、提交兜底、16 语言提示）'
);

// Item #46: 卡型下拉不能把「Image Occlusion」漏出来，形成绕过只读策略的侧门。
// 2026-11-13 用户截图实测：关掉遮挡编辑器后，get_note_types 仍把原生的
// Image Occlusion 卡型（5 字段）带进「选择卡型」列表，选中它照样能建 IO 笔记。
// 只过滤后端返回值还不够，提交侧还要有字段级兜底，防止残留选中项。
const legacyClozeDescs = [
  '支持多处挖空与图片遮挡',
  'or draw Image Occlusion masks',
  'ou oclusão de imagem',
  'oder Bildabdeckung nutzen',
  'ou occlusion d\'image',
  'или маски на картинке',
  '画像マスクを作成します',
];
const allDictText = [
  translationsSrc,
  ...EXPECTED_LOCALES.map((lang) =>
    readText(path.join(LOCALE_DIR, `${lang}.ts`))
  ),
].join('\n');
assert(
  policySrc.includes('export function isImageOcclusionNoteType') &&
    policySrc.includes('export function isImageOcclusionNoteFields') &&
    editorSrc.includes('isImageOcclusionNoteType(m.name, m.fields)') &&
    editorSrc.includes('const isIoModelSelected =') &&
    editorSrc.includes('!isIoModelSelected &&') &&
    editorSrc.includes('|| isIoModelSelected ||') &&
    legacyClozeDescs.every((phrase) => !allDictText.includes(phrase)) &&
    translationsSrc.includes('notePresetClozeDesc: "使用 {{c1::挖空词}} 将关键概念隐去，支持多处挖空"'),
  'Item #46: 新建卡片的「选择卡型」下拉必须过滤 Image Occlusion 卡型（名字 + 字段双判），提交侧要有兜底，且 16 语言 Cloze 描述不得再承诺图片遮挡'
);

// Item #47: 「复制卡片调试信息」功能守卫（隐藏在省略号详情抽屉内，不占用主界面顶栏）
// 确保 Python 端提供 get_card_debug_info 底层透视、剪贴板工具不剥离调试荷载里的 HTML 标签，
// 且 CopyDebugInfoButton 仅挂载于复习页「•••」Inspector 抽屉内部，不默认暴露在复习顶栏或编辑器主栏。
const clipboardSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/clipboard.ts'));
const debugUtilSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/cardDebugInfo.ts'));
const debugBtnSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/CopyDebugInfoButton.tsx'));
const routerPySrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/router.py'));
const inspectorMarkerIdx = reviewerSrc.indexOf('{inspectorPresence.mounted && (');
const debugBtnMountIdx = reviewerSrc.indexOf('<CopyDebugInfoButton');
assert(
  routerPySrc.includes('def action_get_card_debug_info') &&
    reviewSrc.includes('def get_card_debug_info') &&
    clipboardSrc.includes('stripHtml') &&
    debugUtilSrc.includes('stripHtml: false') &&
    debugUtilSrc.includes('buildCardDebugReport') &&
    debugUtilSrc.includes('scanFieldAnomalies') &&
    debugBtnSrc.includes('CopyDebugInfoButton') &&
    inspectorMarkerIdx > 0 &&
    debugBtnMountIdx > inspectorMarkerIdx &&
    !editorSrc.includes('<CopyDebugInfoButton') &&
    translationsSrc.includes('copyDebugInfoBtn:') &&
    translationsSrc.includes('debugInfoCopiedToast:'),
  'Item #47: 必须具备后端 get_card_debug_info 透视、无剥离 HTML 剪贴板复制、且 CopyDebugInfoButton 仅收敛在复习页「•••」详情抽屉内（不得默认挂在主界面顶栏或编辑器主栏）'
);

// Item #48: Cloze 同卡合并默认模式 + 分步切换 + 卡片库按笔记自动聚合 + 学习步长角标
const clozeCssSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/index.css'));
const clozeModeSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/clozeMode.ts'));
const searchPySrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/search_service.py'));
const editPySrc = readText(
  path.resolve(ADDON_ROOT, 'bridge/edit_service.py'));
assert(
  clozeCssSrc.includes('.tower-cloze-hide-prefix .anki-cloze-prefix') &&
    clozeModeSrc.includes('export function rewriteClozeModeInFieldMap') &&
    wysiwygSrc.includes("clozeMode = 'combined'") &&
    wysiwygSrc.includes('tower-cloze-hide-prefix') &&
    editorSrc.includes('clozeModeCombinedOption') &&
    editorSrc.includes('clozeModeSplitOption') &&
    librarySrc.includes('subCardsCountBadge') &&
    librarySrc.includes('applyToNote: false') &&
    cmdKSrc.includes('siblingCount') &&
    reviewerSrc.includes('clozeStepBadge') &&
    searchPySrc.includes('_group_cids_by_note') &&
    searchPySrc.includes('_expand_note_card_ids') &&
    editPySrc.includes('_prune_orphan_cloze_cards'),
  'Item #48: 必须具备 Cloze 默认合并考/前缀隐藏/切换分步考、后端孤卡清理、按笔记聚合卡库、子卡单卡暂停，以及复习分步角标'
);

// Item #49: 统一悬浮提示与信息浮卡规范（Tooltip & HoverCard Standard）
// 1) index.css、编译产物 web/assets/index.css 与 themeTokens.ts 暴露统一浮层 tokens、高对比状态文本与减动画/高对比规则；
// 2) Tooltip / ChartTooltipPortal / HoverCard / useFloatingPosition 保持 Portal 定位、SSR 守卫、键盘模态、快捷键格式化、RTL 与 getClosestFromTarget 护栏；
// 3) 全量 TSX 组件禁用原生 HTML `title=`（仅 <iframe> 无障碍容器标题例外），DesignSystemView 展示统一 Tooltip & HoverCard。
const floatingHookSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/hooks/useFloatingPosition.ts'));
const tooltipSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/Tooltip.tsx'));
const themeTokensSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/themeTokens.ts'));

function findRawJsxTitleLines(src) {
  const masked = src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(?<![:/])\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
  const rawTitleRe = /(?<![A-Za-z0-9_.$:])title\s*=\s*(?:["'`]|\{)/g;
  const varDeclLineRe = /\b(?:const|let|var|type|interface)\s+$/;
  const lines = [];
  let match;
  while ((match = rawTitleRe.exec(masked)) !== null) {
    const lineStart = masked.lastIndexOf('\n', match.index - 1) + 1;
    if (varDeclLineRe.test(masked.slice(lineStart, match.index))) {
      continue;
    }
    let braceDepth = 0;
    let quote = null;
    let tagName = null;
    const floor = Math.max(0, match.index - 4000);
    for (let pos = match.index - 1; pos >= floor; pos -= 1) {
      const ch = masked[pos];
      if (quote !== null) {
        if (ch === quote && (pos === 0 || masked[pos - 1] !== '\\')) {
          quote = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch;
        continue;
      }
      if (ch === '}') {
        braceDepth += 1;
      } else if (ch === '{') {
        if (braceDepth === 0) break;
        braceDepth -= 1;
      } else if (braceDepth === 0) {
        if (ch === '>' || ch === ';') break;
        if (ch === '<') {
          const m = /^([A-Za-z][A-Za-z0-9_.-]*)\b/.exec(masked.slice(pos + 1));
          if (m && pos + 1 + m[1].length < match.index && /\s/.test(masked[pos + 1 + m[1].length])) {
            tagName = m[1];
          }
          break;
        }
      }
    }
    if (tagName && tagName !== 'iframe') {
      lines.push(masked.slice(0, match.index).split('\n').length);
    }
  }
  return lines;
}

const rawTitleOffenders = [];
for (const file of tsxFiles) {
  const badLines = findRawJsxTitleLines(readText(file));
  if (badLines.length > 0) {
    rawTitleOffenders.push(`${path.relative(ADDON_ROOT, file)}:${badLines.join(',')}`);
  }
}

const requiredTooltipCssTokens = [
  '--tooltip-bg',
  '--tooltip-border',
  '--tooltip-shadow',
  '--tooltip-kbd-bg',
  '--status-warning-text',
  '--z-tooltip',
  '.ui-tooltip',
  '.ui-hovercard',
  '.ui-tooltip-kbd',
  '.dashboard-tooltip',
];
for (const token of requiredTooltipCssTokens) {
  assert(
    dashboardCssSrc.includes(token),
    `Item #49: frontend/src/index.css is missing unified tooltip token/class: ${token}`
  );
  assert(
    cssBundle.includes(token.replace(/^\./, '')),
    `Item #49: Compiled web/assets/index.css is missing unified tooltip token/class: ${token} (run \`cd frontend && npm run build\`)`
  );
}

assert(
  themeTokensSrc.includes('export function getStatusTextTokens') &&
    themeTokensSrc.includes('export interface StatusTextTokens') &&
    floatingHookSrc.includes('export function useFloatingPosition') &&
    floatingHookSrc.includes('export function renderAnchoredTrigger') &&
    floatingHookSrc.includes('export function isElementFocusVisible') &&
    floatingHookSrc.includes("'aria-describedby'") &&
    floatingHookSrc.includes("dir === 'rtl'") &&
    floatingHookSrc.includes("typeof document === 'undefined'") &&
    !floatingHookSrc.includes('.closest(') &&
    tooltipSrc.includes('export function Tooltip') &&
    tooltipSrc.includes('export function ChartTooltipPortal') &&
    tooltipSrc.includes('export function ChartTooltipContent') &&
    tooltipSrc.includes('createPortal') &&
    tooltipSrc.includes('document.body') &&
    tooltipSrc.includes('formatShortcut') &&
    tooltipSrc.includes('showShortcutHints') &&
    tooltipSrc.includes('ui-tooltip-kbd') &&
    tooltipSrc.includes('ariaDescribedBy:') &&
    tooltipSrc.includes("role={isDuplicateAriaLabel ? undefined : 'tooltip'}") &&
    tooltipSrc.includes('onlyWhenTruncated') &&
    tooltipSrc.includes("typeof document !== 'undefined'") &&
    hoverCardSrc.includes('export function HoverCard') &&
    hoverCardSrc.includes('createPortal') &&
    hoverCardSrc.includes('document.body') &&
    hoverCardSrc.includes('getClosestFromTarget') &&
    hoverCardSrc.includes("event.key === 'Escape'") &&
    hoverCardSrc.includes('aria-expanded') &&
    hoverCardSrc.includes("typeof document !== 'undefined'") &&
    designSystemSrc.includes('<Tooltip') &&
    designSystemSrc.includes('<HoverCard') &&
    rawTitleOffenders.length === 0,
  `Item #49: 统一 Tooltip/HoverCard 规范校验失败（请确保完成全量迁移并重新执行 npm run build）：${
    rawTitleOffenders.length > 0 ? `残留原生 title=: ${rawTitleOffenders.join('; ')}` : 'DesignSystemView 或浮层原语契约缺失'
  }`
);

const profileConfigPy = readText(path.resolve(ADDON_ROOT, 'bridge/profile_config.py'));
assert(
  initPy.includes('read_profile_scoped_config') &&
    initPy.includes('write_profile_scoped_config') &&
    initPy.includes('"anki:profile-changed"') &&
    profileConfigPy.includes('PROFILE_STATES_KEY') &&
    profileConfigPy.includes('"vacation_state"') &&
    storeSrc.includes('profileGeneration') &&
    storeSrc.includes('async handleProfileChanged()') &&
    appSrc.includes("'anki:profile-changed'") &&
    jsBundle.includes('anki:profile-changed'),
  'Item #50: Multi-profile config isolation & WebView profile-switch state reset contract failed (rebuild frontend with `cd frontend && npm run build`)'
);

assert(
  !settingsSrc.includes('officialBrandBadge') &&
    settingsSrc.includes('w-full min-w-0 overflow-hidden') &&
    !designSystemSrc.includes('officialBrandBadge') &&
    designSystemSrc.includes('w-full min-w-0 overflow-hidden'),
  'Item #51: Accent picker cells must omit the Recommended/officialBrandBadge tag and keep bounded cell width with overflow-hidden'
);

assert(
  storeSrc.includes('EMPTY_CMDK_STATE') &&
    storeSrc.includes('cancelPendingCmdKSearch') &&
    storeSrc.includes('cmdKRequestSeq') &&
    cmdKSrc.includes('lastOpenSnapshotRef') &&
    cmdKSrc.includes('searchInputRef.current?.focus()'),
  'Item #52: Closing or reopening Cmd+K global search must reset query/results cleanly, cancel stale in-flight requests, and restore input focus'
);

assert(
  dashboardCssSrc.includes('.anki-native-card :where(*, *::before, *::after)') &&
    dashboardCssSrc.includes('border-style: none') &&
    dashboardCssSrc.includes('img:not([width])') &&
    dashboardCssSrc.includes('.anki-native-card table:not([width]):not([style*="width"])') &&
    dashboardCssSrc.includes('.library-card-answer:has(img, .anki-io-wrap, table)') &&
    dashboardCssSrc.includes('.library-card-answer table') &&
    reviewerSrc.includes('[&_img:not([width])]:w-auto') &&
    mathRendererSrc.includes('export function hasSubstantiveMediaPreview') &&
    librarySrc.includes('hasSubstantiveMediaPreview') &&
    jsBundle.includes('[&_img:not([width])]:w-auto') &&
    cssBundle.includes('.anki-native-card :where') &&
    cssBundle.includes('img:not([width])') &&
    cssBundle.includes('table:not([width])') &&
    cssBundle.includes('.library-card-answer:has(img'),
  'Item #53: Third-party card templates with attribute-sized icons (width/height), partial borders, full-width tables, and flipped Library card-back overflow clipping must hold cleanly (rebuild with `cd frontend && npm run build`)'
);

const suiteTsSrc = readText(path.resolve(ADDON_ROOT, 'tests/frontend/suite.ts'));
assert(
  dashboardSrc.includes('export function computeHeroProgressRing') &&
    dashboardSrc.includes('animatedProgressPct') &&
    dashboardSrc.includes('progressPct') &&
    /aria-valuemax=\{[\s\S]*?:\s*100\s*\}/.test(dashboardSrc) &&
    suiteTsSrc.includes("import './specs/dashboardRing.spec'") &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'tests/frontend/specs/dashboardRing.spec.ts')),
  'Item #54a: Dashboard hero progress ring must display rounded percentage with 0-100 progressbar ARIA and unit spec coverage'
);

assert(
  storeSrc.includes("export const DEFAULT_LIBRARY_SORT: LibrarySortOption = 'newest'") &&
    storeSrc.includes('librarySortBy: DEFAULT_LIBRARY_SORT') &&
    searchSrc.includes('str(data.get("sortBy") or "newest")') &&
    librarySrc.includes('librarySortBy !== DEFAULT_LIBRARY_SORT') &&
    librarySrc.includes('resetLibraryFilters') &&
    suiteTsSrc.includes("import './specs/libraryDefaultSort.spec'") &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'tests/frontend/specs/libraryDefaultSort.spec.ts')),
  'Item #54b: Library default sort order must default to newest across store, backend, Reset Filters, and unit spec coverage'
);

assert(
  wysiwygSrc.includes("t('editorToolClearFormat')") &&
    wysiwygSrc.includes('export function stripFormattingFromHtml') &&
    wysiwygSrc.includes('const clearFormatting = () =>') &&
    translationsSrc.includes('editorToolClearFormat:') &&
    jsBundle.includes('Clear Formatting') &&
    suiteTsSrc.includes("import './specs/editorClearFormat.spec'") &&
    fs.existsSync(path.resolve(ADDON_ROOT, 'tests/frontend/specs/editorClearFormat.spec.ts')),
  'Item #54c: TowerWysiwygEditor must expose Clear Formatting with i18n parity, built bundle artifact, and unit spec coverage (rebuild with `cd frontend && npm run build`)'
);

// Item #55: 本地个人头像自定义与多档案隔离、安全存储及构建闭环守卫
const avatarImagePath = path.resolve(ADDON_ROOT, 'frontend/src/utils/avatarImage.ts');
const userAvatarPath = path.resolve(ADDON_ROOT, 'frontend/src/components/common/UserAvatar.tsx');
const avatarSpecPath = path.resolve(ADDON_ROOT, 'tests/frontend/specs/avatarProfile.spec.ts');
assert(
  fs.existsSync(avatarImagePath) &&
    fs.existsSync(userAvatarPath) &&
    fs.existsSync(avatarSpecPath),
  'Item #55: Missing avatarImage.ts, UserAvatar.tsx, or tests/frontend/specs/avatarProfile.spec.ts'
);
const avatarImageSrc = readText(avatarImagePath);
const userAvatarSrc = readText(userAvatarPath);

assert(
  profileConfigPy.includes('"custom_avatar"') &&
    profileConfigPy.includes('PROFILE_SCOPED_KEYS') &&
    profileConfigPy.includes('AVATAR_PRESET_IDS') &&
    profileConfigPy.includes('parse_and_validate_avatar_data_url') &&
    profileConfigPy.includes('prepare_custom_avatar_storage') &&
    profileConfigPy.includes('resolve_custom_avatar') &&
    profileConfigPy.includes('resolve_safe_avatar_path') &&
    buildSrc.includes('"custom_avatar"') &&
    buildSrc.includes('"user_files"') &&
    routerPySrc.includes('def action_pick_avatar_image') &&
    routerPySrc.includes('"customAvatar": self._resolve_custom_avatar(') &&
    deckSrc.includes('resolve_custom_avatar') &&
    pycmdSrc.includes('export const AVATAR_PRESET_IDS') &&
    pycmdSrc.includes('customAvatar?: CustomAvatarConfig') &&
    pycmdSrc.includes('NO_TIMEOUT_ACTIONS') &&
    pycmdSrc.includes("'pick_avatar_image'") &&
    avatarImageSrc.includes('export function isSafeAvatarDataUrl') &&
    avatarImageSrc.includes('export function normalizeCustomAvatarConfig') &&
    avatarImageSrc.includes('export async function cropImageToSquareAvatarDataUrl') &&
    avatarImageSrc.includes('export function computeSquareCoverCropRect') &&
    avatarImageSrc.includes('export function computeInteractiveAvatarCropRect') &&
    avatarImageSrc.includes('export function rotateAvatarCropTransform') &&
    avatarImageSrc.includes('image/svg+xml') &&
    userAvatarSrc.includes('export const UserAvatar') &&
    userAvatarSrc.includes('AVATAR_PRESET_IDS') &&
    userAvatarSrc.includes('data-avatar-kind') &&
    userAvatarSrc.includes('data-avatar-preset') &&
    userAvatarSrc.includes('setImgFailed(true)') &&
    storeSrc.includes('customAvatar: DEFAULT_CUSTOM_AVATAR') &&
    storeSrc.includes('cropImageToSquareAvatarDataUrl') &&
    storeSrc.includes("callAnki<PickAvatarImageResult>('pick_avatar_image'") &&
    storeSrc.includes('normalizeCustomAvatarConfig') &&
    sidebarSrc.includes('<UserAvatar') &&
    sidebarSrc.includes('avatar={customAvatar}') &&
    settingsSrc.includes('<UserAvatar') &&
    settingsSrc.includes('AVATAR_PRESET_IDS') &&
    settingsSrc.includes("t('avatarSectionLabel')") &&
    settingsSrc.includes("t('avatarPresetAria'") &&
    designSystemSrc.includes('<UserAvatar') &&
    designSystemSrc.includes('AVATAR_PRESET_IDS') &&
    designSystemSrc.includes("t('avatarSectionLabel')") &&
    translationsSrc.includes('avatarSectionLabel:') &&
    translationsSrc.includes('avatarPresetAria:') &&
    suiteTsSrc.includes("import './specs/avatarProfile.spec'") &&
    jsBundle.includes('pick_avatar_image') &&
    jsBundle.includes('customAvatar') &&
    jsBundle.includes('avatarSectionLabel') &&
    jsBundle.includes('avatarPresetAria') &&
    jsBundle.includes('data-avatar-kind') &&
    jsBundle.includes('data-avatar-preset') &&
    cssBundle.includes('object-cover') &&
    cssBundle.includes('w-14') &&
    cssBundle.includes('h-14') &&
    cssBundle.includes('ring-offset-1'),
  'Item #55: Local profile avatar isolation, sanitization, safe crop/render, i18n keys, unit spec wiring, and built web/ bundle artifact must remain intact (rebuild with `cd frontend && npm run build`)'
);

// Item #56: 首页标题栏 Alpha 蒙版水彩位图水印与 1x/2x AVIF/WebP 构建产物守卫
const GREETING_THEMES = ['emerald', 'teal', 'amber', 'rose', 'violet', 'cyan', 'slate'];
const greetingAssetSrcDir = path.resolve(ADDON_ROOT, 'frontend/src/assets/illustrations/greeting');
const webAssetsDir = path.resolve(ADDON_ROOT, 'web/assets');
for (const theme of GREETING_THEMES) {
  for (const density of ['1x', '2x']) {
    for (const ext of ['avif', 'webp']) {
      const file = `greeting-${theme}-${density}.${ext}`;
      assert(
        fs.existsSync(path.join(greetingAssetSrcDir, file)),
        `Item #56: Missing source greeting watermark asset: ${file}`
      );
      assert(
        fs.existsSync(path.join(webAssetsDir, file)),
        `Item #56: Missing built web/assets greeting watermark asset: ${file} (run \`cd frontend && npm run build\`)`
      );
    }
  }
  assert(
    cssBundle.includes(`data-accent=${theme}`) || cssBundle.includes(`data-accent="${theme}"`),
    `Item #56: Compiled web/assets/index.css is missing greeting watermark rule for accent "${theme}"`
  );
}
assert(
  cssBundle.includes('.greeting-watermark-stage') &&
    cssBundle.includes('.greeting-watermark-glyph') &&
    cssBundle.includes('opacity:.44') &&
    cssBundle.includes('opacity:.52') &&
    cssBundle.includes('forced-colors:active') &&
    !cssBundle.includes('__VITE_ASSET__') &&
    !cssBundle.includes('./assets/illustrations/greeting/'),
  'Item #56: Compiled web/assets/index.css must include greeting watermark mask rules, 0.44/0.52 opacities, forced-colors rule, and clean resolved URLs'
);

// Item #57: 设置「显示插画」开关与前后端偏好持久化、全插画门控联查守卫
assert(
  routerPySrc.includes('"showIllustrations"') &&
    routerPySrc.includes('"show_illustrations"') &&
    deckSrc.includes('"showIllustrations"') &&
    pycmdSrc.includes('showIllustrations?: boolean') &&
    storeSrc.includes('showIllustrations: true') &&
    settingsSrc.includes("t('settingsShowIllustrationsLabel')") &&
    settingsSrc.includes('anki-switch-sm') &&
    translationsSrc.includes('settingsShowIllustrationsLabel: "显示插画"') &&
    jsBundle.includes('showIllustrations') &&
    jsBundle.includes('settingsShowIllustrationsLabel') &&
    (cssBundle.includes('.anki-switch-sm[data-switch-fallback=true]') ||
      cssBundle.includes('.anki-switch-sm[data-switch-fallback="true"]')),
  'Item #57: Show Illustrations toggle switch must wire through backend prefs, store, SettingsModal, i18n, and built web/ bundle (rebuild with `cd frontend && npm run build`)'
);

// Item #58: 复习模式显式撤销按钮与重置进度收敛进「···」抽屉 2×3 网格并与统一撤销栈联动守卫
const undoBtnIdx = reviewerSrc.indexOf("aria-label={t('undoBtnShort')}");
assert(
  reviewerSrc.includes('const canUndo = undoStack.length > 0') &&
    undoBtnIdx > inspectorMarkerIdx &&
    reviewerSrc.includes('onClick={() => {') &&
    reviewerSrc.includes('appActions.undoLastReview()') &&
    reviewerSrc.includes('appActions.forgetCurrentReviewCard()') &&
    routerPySrc.includes('def action_forget_cards') &&
    editPySrc.includes('schedule_cards_as_new') &&
    storeSrc.includes('function buildReviewUndoSnapshot(') &&
    storeSrc.includes('previousLibraryCards') &&
    jsBundle.includes('undoLastReview') &&
    jsBundle.includes('forgetCurrentReviewCard') &&
    jsBundle.includes('undoBtnShort') &&
    jsBundle.includes('forgetCardBtn'),
  'Item #58: Reviewer active Undo & Reset Card buttons must live inside ··· inspector drawer 2x3 grid and wire to unified rating/forget/suspend/bury/delete undo stack (rebuild with `cd frontend && npm run build`)'
);

// Item #59: 视图与字号弹层卡片 UI 升级（语义单选画幅、一体分段缩放条、原生/降级开关、去像素与模板副标题噪音）
const displayPopoverStart = reviewerSrc.indexOf('id={displayPopoverId}');
const displayPopoverEnd = reviewerSrc.indexOf('<progress', displayPopoverStart);
const displayPopoverSrc = reviewerSrc.slice(displayPopoverStart, displayPopoverEnd);
assert(
  displayPopoverStart > 0 &&
    displayPopoverEnd > displayPopoverStart &&
    reviewerSrc.includes('reviewer-scale-stepper') &&
    reviewerSrc.includes('reviewer-scale-segment') &&
    reviewerSrc.includes('reviewer-width-fieldset') &&
    reviewerSrc.includes('reviewer-width-card') &&
    reviewerSrc.includes('name="reviewer-stage-width"') &&
    reviewerSrc.includes('compatSwitchId') &&
    !displayPopoverSrc.includes('noteTypeName') &&
    !displayPopoverSrc.includes("meta: '580/840'") &&
    !displayPopoverSrc.includes("t('reviewImageZoomHint')") &&
    cssBundle.includes('.reviewer-scale-stepper') &&
    cssBundle.includes('.reviewer-width-card') &&
    jsBundle.includes('reviewer-stage-width') &&
    jsBundle.includes('reviewer-width-card'),
  'Item #59: Reviewer display popover must ship refined unified scale stepper, semantic width radio tiles without px noise, and single-line .anki-switch-sm compat toggle (rebuild with `cd frontend && npm run build`)'
);

// Item #60: 音频自动播放弹层以视图与字号弹层（#59）为基准统一卡片视觉语言与原生/降级开关
const audioPopoverStart = reviewerSrc.indexOf('id={audioPopoverId}');
const audioPopoverEnd = reviewerSrc.indexOf('id={flagPopoverId}', audioPopoverStart);
const audioPopoverSrc = reviewerSrc.slice(audioPopoverStart, audioPopoverEnd);
assert(
  audioPopoverStart > 0 &&
    audioPopoverEnd > audioPopoverStart &&
    audioPopoverSrc.includes('w-[300px]') &&
    audioPopoverSrc.includes('bg-[var(--bg-card)]/96') &&
    audioPopoverSrc.includes('flex flex-col gap-3') &&
    audioPopoverSrc.includes('h-9 pb-3 border-b') &&
    audioPopoverSrc.includes('autoFrontSwitchId') &&
    audioPopoverSrc.includes('autoBackSwitchId') &&
    audioPopoverSrc.includes('anki-switch anki-switch-sm') &&
    audioPopoverSrc.includes('reviewer-popover-link') &&
    !audioPopoverSrc.includes('reviewer-switch') &&
    cssBundle.includes('.reviewer-popover-link') &&
    jsBundle.includes('reviewer-popover-link'),
  'Item #60: Reviewer audio popover must match Display popover surface tokens, bordered header, .anki-switch-sm toggles, and .reviewer-popover-link footer button (rebuild with `cd frontend && npm run build`)'
);

// Item #61: 位点 C/D1/D2 单色细线淡墨 Alpha 蒙版位图插画与 1x/2x AVIF/WebP 构建产物守卫
const PLACEMENT_ASSETS = [
  { subdir: 'corner', prefix: 'corner-left' },
  { subdir: 'corner', prefix: 'corner-right' },
  { subdir: 'celebration', prefix: 'celebration' },
  { subdir: 'empty', prefix: 'empty' },
];
for (const theme of GREETING_THEMES) {
  for (const { subdir, prefix } of PLACEMENT_ASSETS) {
    const assetSrcDir = path.resolve(ADDON_ROOT, `frontend/src/assets/illustrations/${subdir}`);
    for (const density of ['1x', '2x']) {
      for (const ext of ['avif', 'webp']) {
        const file = `${prefix}-${theme}-${density}.${ext}`;
        assert(
          fs.existsSync(path.join(assetSrcDir, file)),
          `Item #61: Missing source placement asset: ${subdir}/${file}`
        );
        assert(
          fs.existsSync(path.join(webAssetsDir, file)),
          `Item #61: Missing built web/assets placement asset: ${file} (run \`cd frontend && npm run build\`)`
        );
      }
    }
  }
}
assert(
  cssBundle.includes('.reviewer-corner-glyph--left') &&
    cssBundle.includes('.reviewer-corner-glyph--right') &&
    cssBundle.includes('.celebration-illustration-stage') &&
    cssBundle.includes('.celebration-illustration-glyph') &&
    cssBundle.includes('.empty-illustration-stage') &&
    cssBundle.includes('.empty-illustration-glyph') &&
    cssBundle.includes('[dir=rtl] .reviewer-corner-glyph') &&
    cssBundle.includes('forced-colors:active') &&
    cssBundle.toLowerCase().includes('canvastext') &&
    !cssBundle.includes('__VITE_ASSET__') &&
    !cssBundle.includes('./assets/illustrations/'),
  'Item #61: Compiled web/assets/index.css must include C/D1/D2 mask rules, RTL mirroring, forced-colors handling, and clean resolved URLs'
);

// Item #62: 学习完成仪式页现代化重构（article 容器查询 + subgrid 三列指标对齐 + 等高均衡动作按钮 + 安全滚动 + 降动画）
assert(
  reviewerSrc.includes('reviewer-complete-main') &&
    reviewerSrc.includes('reviewer-complete-card') &&
    reviewerSrc.includes('reviewer-complete-stats') &&
    reviewerSrc.includes('reviewer-complete-actions') &&
    reviewerSrc.includes('reviewer-complete-btn--primary') &&
    reviewerSrc.includes('reviewer-complete-btn--secondary') &&
    dashboardCssSrc.includes('container: session-complete / inline-size') &&
    dashboardCssSrc.includes('grid-template-rows: subgrid') &&
    dashboardCssSrc.includes('align-items: safe center') &&
    dashboardCssSrc.includes('text-wrap: balance') &&
    dashboardCssSrc.includes('text-wrap: pretty') &&
    cssBundle.includes('.reviewer-complete-card') &&
    cssBundle.includes('.reviewer-complete-btn') &&
    jsBundle.includes('reviewer-complete-btn--secondary'),
  'Item #62: Reviewer session-complete screen must use semantic <article>, container queries, subgrid stats alignment, equal-height action buttons, and safe scroll centering (rebuild with `cd frontend && npm run build`)'
);

// Item #63: 休假模式与进度减负共享「预设 + Studio 滑轨」时长选择器与统一弹窗规则（消除 d 缩写与低对比度灰字）
const durationCtrlSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/StudioDurationControl.tsx'));
assert(
  vacationSrc.includes('<StudioDurationControl') &&
    icuSrc.includes('<StudioDurationControl') &&
    durationCtrlSrc.includes('vacation-duration-fieldset') &&
    durationCtrlSrc.includes('studio-range-slider') &&
    !vacationSrc.includes('{days}d') &&
    !icuSrc.includes('({days}d)') &&
    cssBundle.includes('.studio-range-slider') &&
    cssBundle.includes('.vacation-choice-card') &&
    jsBundle.includes('studio-range-slider'),
  'Item #63: VacationModal and IcuRescueModal must share StudioDurationControl presets + range slider without raw d suffixes (rebuild with `cd frontend && npm run build`)'
);

// Item #64: 休假模式与进度减负模态窗全量 /modern-web-guidance 升级（语义 tablist/tabpanel + 焦点闭环 + 非纯色勾选 + details/details-content + Studio 分层质感）
const dialogFocusSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/hooks/useDialogFocus.ts'));
assert(
  vacationSrc.includes('role="tablist"') &&
    icuSrc.includes('role="tablist"') &&
    vacationSrc.includes('useDialogFocus') &&
    icuSrc.includes('useDialogFocus') &&
    dialogFocusSrc.includes('getClosestFromTarget') &&
    icuSrc.includes('icuTabHistory') &&
    !vacationSrc.includes('#8E8E93') &&
    !icuSrc.includes('#8E8E93') &&
    cssBundle.includes('.vacation-tablist') &&
    cssBundle.includes('.vacation-safeguards-details') &&
    cssBundle.includes('::details-content') &&
    jsBundle.includes('vacation-safeguards-chevron'),
  'Item #64: VacationModal and IcuRescueModal must enforce shared Studio modal focus trap, semantic tablists, uniform AA contrast, and synchronized choice rules (rebuild with `cd frontend && npm run build`)'
);

// Item #65: 全界面交互与动效工程契约（禁 transition-all / 禁简写 allow-discrete / 无限循环需 motion-safe / 禁用 .theme-switching * 通配符）
const indexCssSrc = readText(path.resolve(ADDON_ROOT, 'frontend/src/index.css'));
for (const file of tsxFiles) {
  const rel = path.relative(ADDON_ROOT, file);
  const src = readText(file);
  assert(
    !/\btransition-all\b/.test(src),
    `Item #65: ${rel} must not use transition-all; specify explicit animated properties`
  );
  assert(
    !/active:scale-95\b/.test(src),
    `Item #65: ${rel} must use unified press scale tiers instead of active:scale-95`
  );
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    assert(
      !/(?<!motion-safe:)\banimate-(?:ping|pulse|spin)\b/.test(line),
      `Item #65: ${rel}:${i + 1} must guard infinite animation with motion-safe:animate-*`
    );
  }
}
assert(
  !/transition\s*:[^;]*\ballow-discrete\b/.test(indexCssSrc) &&
    /transition-behavior\s*:\s*allow-discrete/.test(indexCssSrc) &&
    !indexCssSrc.includes('.theme-switching *'),
  'Item #65: index.css must declare transition-behavior: allow-discrete outside transition shorthand and avoid .theme-switching * wildcard'
);
for (const requiredMotionRule of [
  '.avatar-crop-dialog',
  '.studio-details',
  '.animate-flyout-enter',
  '.reviewer-inspector',
  '.reviewer-lightbox',
  '.ui-tab-enter',
  '::view-transition-old(root)',
]) {
  assert(
    cssBundle.includes(requiredMotionRule),
    `Item #65: Compiled web/assets/index.css is missing unified motion rule: ${requiredMotionRule}`
  );
}

// Item #66: 图标系统统一门禁（严禁 Unicode/Emoji 符号假冒 UI 图标、严禁装饰性 SVG 漏标 aria-hidden）
const componentTsxFiles = collectTsxFiles(path.resolve(ADDON_ROOT, 'frontend/src/components'));
const iconsModuleSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/Icons.tsx'));
assert(
  iconsModuleSrc.includes('export const SyncArrowsIcon') &&
    iconsModuleSrc.includes('export const CloseIcon') &&
    settingsSrc.includes('<SyncArrowsIcon') &&
    !settingsSrc.includes('>⟳<'),
  'Item #66: Shared SVG Icons module must power Settings sync and common controls without Unicode glyph hacks'
);
for (const file of componentTsxFiles) {
  const rel = path.relative(ADDON_ROOT, file);
  const src = readText(file);
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('{/*')) continue;
    assert(
      !/>\s*[↻⟳↺⟲✕✖✓✔▾▴▸◂▼▲▶◀⇤⇥⇔‹›]+\s*</.test(line) &&
        !/^\s*[↻⟳↺⟲✕✖✓✔▾▴▸◂▼▲▶◀⇤⇥⇔‹›]\s*$/.test(line),
      `Item #66: ${rel}:${i + 1} must use crisp SVG icons from common/Icons.tsx instead of Unicode glyph "${trimmed}"`
    );
  }
  const svgOpenTags = src.match(/<svg\b[^>]*>/gs) || [];
  for (const tag of svgOpenTags) {
    assert(
      tag.includes('aria-hidden') ||
        tag.includes('aria-label') ||
        tag.includes('role=') ||
        tag.includes('...baseProps'),
      `Item #66: ${rel} has an <svg> missing aria-hidden="true" or accessible label: ${tag.slice(0, 100)}`
    );
  }
}

// Item #67: 统一自定义下拉选择框门禁（StudioSelect 取代原生 <select>，规避 QtWebEngine 原生 OS 弹窗割裂）
const studioSelectSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/StudioSelect.tsx'));
assert(
  studioSelectSrc.includes('role="combobox"') &&
    studioSelectSrc.includes('role="listbox"') &&
    studioSelectSrc.includes('role="option"') &&
    studioSelectSrc.includes('useFloatingPosition') &&
    studioSelectSrc.includes('getClosestFromTarget') &&
    studioSelectSrc.includes("typeof document !== 'undefined'") &&
    cssBundle.includes('.ui-select-trigger') &&
    cssBundle.includes('.ui-select-menu'),
  'Item #67: StudioSelect must expose ARIA combobox/listbox semantics, SSR guards, useFloatingPosition, and compiled CSS'
);
for (const file of componentTsxFiles) {
  const rel = path.relative(ADDON_ROOT, file);
  const src = readText(file).replace(/\/\/.*$/gm, '');
  assert(
    !/<select\b/.test(src),
    `Item #67: ${rel} must use <StudioSelect> instead of native <select> so QtWebEngine renders the branded menu`
  );
}

// Item #68: 原生 [popover] 严禁在根节点直接挂 Tailwind display 类（防覆盖 UA display:none 产生透明幽灵拦截层）
const closedPopoverCssMatch = cssBundle.match(
  /\.reviewer-popover\[popover\]:not\(:popover-open\)\{([^}]+)\}/
);
assert(
  Boolean(closedPopoverCssMatch) &&
    closedPopoverCssMatch[1].includes('display:none') &&
    closedPopoverCssMatch[1].includes('pointer-events:none'),
  'Item #68: Compiled web/assets/index.css must enforce display:none + pointer-events:none on closed .reviewer-popover[popover]'
);
for (const file of componentTsxFiles) {
  const rel = path.relative(ADDON_ROOT, file);
  const src = readText(file);
  const popoverTags = src.match(/<[a-zA-Z]+\b[^>]*\bpopover\s*=\s*["'][^"']+["'][^>]*>/gs) || [];
  for (const tag of popoverTags) {
    const classBlock = tag.match(/className\s*=\s*(?:\{[\s\S]*?\}|"[^"]*"|'[^']*')/)?.[0] || '';
    assert(
      !/(?:['"`\s])(?:flex|inline-flex|grid|inline-grid|block|inline-block)(?:['"`\s])/.test(
        classBlock
      ),
      `Item #68: ${rel} must NOT put unconditional display utilities (flex/grid/block) directly on a [popover] root — wrap children inside an inner container instead`
    );
  }
}

// Item #69: 极简禅模式（从 0 往上构建的两页空间：ZenHomeView + ZenReviewView，入口位于今日进度区原轻量复习槽位）
const zenHomeSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/zen/ZenHomeView.tsx'));
const zenReviewSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/zen/ZenReviewView.tsx'));
const zenUtilSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/zenMode.ts'));
const zenAudioSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/zenAudio.ts'));
const zenThresholdSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/zen/ZenThresholdOverlay.tsx'));
const dashZenTriggerIdx = dashboardSrc.indexOf('data-zen-trigger="dashboard"');
assert(
  dashZenTriggerIdx > 0 &&
    !dashboardSrc.includes('startLowEnergySession') &&
    appSrc.includes('ZenHomeView') &&
    appSrc.includes('ZenReviewView') &&
    appSrc.includes('ZenThresholdOverlay') &&
    appSrc.includes('isZenBlockedGlobalShortcut') &&
    reviewerSrc.includes("!e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z'") &&
    zenUtilSrc.includes('selectZenPendingDecks') &&
    zenUtilSrc.includes('resolveZenHomeState') &&
    zenUtilSrc.includes('resolveZenTimePeriod') &&
    zenAudioSrc.includes('playZenEnterBell') &&
    zenAudioSrc.includes('playZenCompleteBell') &&
    zenThresholdSrc.includes('zen-threshold-overlay') &&
    !zenHomeSrc.includes('.closest(') &&
    !zenReviewSrc.includes('.closest(') &&
    !zenHomeSrc.includes('isZh') &&
    !zenReviewSrc.includes('isZh') &&
    !zenReviewSrc.includes('predictions.') &&
    cssBundle.includes('.zen-sanctuary-bg') &&
    cssBundle.includes('.zen-enso-trigger') &&
    cssBundle.includes('.zen-review-hoverbar') &&
    cssBundle.includes('.zen-rate-btn--success') &&
    !/\.zen-(?:incense-complete-veil|sound-popover|deck-popover)\s*\{[^}]*backdrop-filter/i.test(cssBundle),
  'Item #69: Minimalist Zen Mode must expose its entry in the hero action bar (with low-energy entry hidden), include Roji threshold, Ensō ritual, SSR-safe Zen audio, isolate ZenHomeView/ZenReviewView without FSRS intervals or raw .closest(), guard Cmd+Z against Shift, avoid backdrop-filter on Zen overlays/popovers for Windows ANGLE stability, and emit compiled CSS'
);

assert(
  librarySrc.includes('libraryLoadingMore') &&
    librarySrc.includes('aria-busy={libraryLoadingMore}') &&
    librarySrc.includes('SpinnerIcon') &&
    librarySrc.includes("t('loadingMoreCards')") &&
    storeSrc.includes('libraryLoadingMore') &&
    storeSrc.includes('yieldForPaint') &&
    jsBundle.includes('loadingMoreCards'),
  'Card Library Load More button must provide immediate disabled/aria-busy/SpinnerIcon loading feedback and yield a paint frame before synchronous Qt search_cards pagination'
);

assert(
  dashboardSrc.includes('dashboard-rhythm-bar') &&
    dashboardSrc.includes('dashboard-rhythm-avg-line') &&
    dashboardSrc.includes('dashboard-chart-pill') &&
    !dashboardSrc.includes('accentScale.brandMutedBar') &&
    cssBundle.includes('--dashboard-chart-2') &&
    cssBundle.includes('--dashboard-chart-4') &&
    cssBundle.includes('.dashboard-rhythm-bar'),
  'Dashboard Weekly Rhythm chart must share the unified oklab --dashboard-chart-* ramp with the Activity Heatmap across all themes'
);

const supportUtilSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/supportPrompt.ts')
);
const supportModalSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/SupportPromptModal.tsx')
);
const settingsModalSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/settings/SettingsModal.tsx')
);
assert(
  supportUtilSrc.includes('https://ankiweb.net/shared/info/1071937836') &&
    !supportUtilSrc.includes('?cb=') &&
    !settingsModalSrc.includes('?cb=') &&
    appSrc.includes('SupportPromptModal') &&
    supportModalSrc.includes('<dialog') &&
    supportModalSrc.includes("closedby: 'closerequest'") &&
    !supportModalSrc.includes("closedby: 'any'") &&
    !supportModalSrc.includes('supportPromptLaterBtn') &&
    !supportModalSrc.includes('supportPromptStep1Login') &&
    !supportModalSrc.includes('role="dialog"') &&
    !supportModalSrc.includes('aria-modal') &&
    supportModalSrc.includes('support-dialog') &&
    supportModalSrc.includes('support-like-hero-badge') &&
    supportModalSrc.includes('support-like-hero-emoji') &&
    supportModalSrc.includes('support-heart-svg') &&
    supportModalSrc.includes('support-rate-inline-badge') &&
    supportModalSrc.includes('Rate This') &&
    !supportModalSrc.includes('support-rate-tip') &&
    !supportModalSrc.includes('support-ankiweb-guide') &&
    !reviewerSrc.includes('reviewer-support-note') &&
    !dashboardSrc.includes('data-support-prompt-test') &&
    !jsBundle.includes('data-support-prompt-test') &&
    settingsModalSrc.includes('aboutAnkiwebLikeHint') &&
    storeSrc.includes('openSupportPromptModal') &&
    indexCssSrc.includes('dialog.support-dialog:modal') &&
    indexCssSrc.includes('dialog.support-dialog::backdrop') &&
    indexCssSrc.includes('transition-behavior: allow-discrete;') &&
    cssBundle.includes('support-dialog') &&
    cssBundle.includes('support-like-hero-badge') &&
    cssBundle.includes('support-like-hero-emoji') &&
    cssBundle.includes('support-heart-svg') &&
    cssBundle.includes('support-rate-inline-badge') &&
    !cssBundle.includes('support-rate-tip') &&
    !cssBundle.includes('support-ankiweb-guide') &&
    !cssBundle.includes('.reviewer-support-note') &&
    jsBundle.includes('support-dialog') &&
    jsBundle.includes('support-like-hero-badge') &&
    jsBundle.includes('support-heart-svg') &&
    jsBundle.includes('support-rate-inline-badge') &&
    jsBundle.includes('aboutAnkiwebLikeHint'),
  'SupportPromptModal must use native <dialog closedby="closerequest"> with emoji thumbs-up hero, merged Rate This CTA button, no redundant Maybe Later or dev Dashboard test button, and clean AnkiWeb URL in both source and compiled web/'
);

const linuxSandboxFrameSrc = readText(
  path.resolve(ADDON_ROOT, 'frontend/src/components/reviewer/SandboxCardFrame.tsx')
);
assert(
  windowDragSrc.includes("platform === 'linux'") &&
    windowDragSrc.includes('if (started || released || isLinux)') &&
    cssBundle.includes('Noto Sans CJK SC') &&
    cssBundle.includes('Noto Color Emoji') &&
    linuxSandboxFrameSrc.includes('Noto Sans CJK SC'),
  'Linux compatibility guards (Wayland/X11 drag fallback skip, CJK & Color Emoji font fallbacks) must exist in source and compiled web/'
);

console.log('[Part 1 Guardrails + 9 UX Enhancements Audit Suite] ALL CHECKS PASSED!');
