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
 *   5. Reviewer ergonomics (`ReviewerView.tsx`): fixed `w-[560px] h-[58px]` bar, `w-[560px]` unflipped button, `w-[170px]` Again + `w-[374px]` Good asymmetric binary buttons
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

const initPy = fs.readFileSync(path.resolve(ADDON_ROOT, '__init__.py'), 'utf-8');
const storeSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/stores/useAppStore.ts'),
  'utf-8'
);
const reviewerSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/reviewer/ReviewerView.tsx'),
  'utf-8'
);
const librarySrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/search/LibraryView.tsx'),
  'utf-8'
);
const cmdKSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/search/CommandPaletteModal.tsx'),
  'utf-8'
);
const dashboardSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/dashboard/DashboardView.tsx'),
  'utf-8'
);
const syncPillSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/dashboard/SyncStatusPill.tsx'),
  'utf-8'
);
const sidebarSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/layout/Sidebar.tsx'),
  'utf-8'
);
const settingsSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/settings/SettingsModal.tsx'),
  'utf-8'
);
const translationsSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/i18n/translations.ts'),
  'utf-8'
);
const editorSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/CardEditorModal.tsx'),
  'utf-8'
);
const appSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/App.tsx'),
  'utf-8'
);

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

// Item #5 & #6: Reviewer 560px ergonomic alignment & Light/Dark dual-mode adaptation
assert(
  reviewerSrc.includes('w-[560px] h-[58px]') &&
    reviewerSrc.includes('w-[170px] h-[58px]') &&
    reviewerSrc.includes('w-[374px] h-[58px]') &&
    reviewerSrc.includes("theme === 'dark' || theme === 'oled'"),
  'Items #5 & #6: ReviewerView must align bottom buttons to 560px (170px Again + 374px Good) and adapt to Light/Dark themes'
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
const vacationSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/VacationModal.tsx'),
  'utf-8'
);
const icuSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/IcuRescueModal.tsx'),
  'utf-8'
);
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
const deckSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/deck_service.py'), 'utf-8');
const statsViewSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/stats/StatsView.tsx'),
  'utf-8'
);
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
const vacationServiceSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/vacation_service.py'), 'utf-8');
const reviewSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/review_service.py'), 'utf-8');
const searchSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/search_service.py'), 'utf-8');
const editSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/edit_service.py'), 'utf-8');
const pycmdSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'frontend/src/bridge/pycmd.ts'), 'utf-8');
const buildSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'scripts/build_ankiaddon.py'), 'utf-8');
const icuSrc2 = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/vacation/IcuRescueModal.tsx'),
  'utf-8'
);
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
const safetyHarnessSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/safety_harness.py'), 'utf-8');
const safetyTestSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/test_card_safety.py'), 'utf-8');
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
const round3Src = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/test_card_safety_round3.py'), 'utf-8');
assert(
  round3Src.includes('signal.SIGKILL') &&
    round3Src.includes('PRAGMA integrity_check') &&
    round3Src.includes('injected mid-batch I/O failure') &&
    round3Src.includes('HAS_HYPOTHESIS') &&
    round3Src.includes('line_coverage_gate') &&
    storeSrc.includes('safetyWarning') &&
    pycmdSrc.includes('SafetyWarning'),
  'Item #19: Fault injection, SIGKILL crash consistency, coverage gate and UI recovery notice must stay in the suite'
);

// Item #20: Deck Options (FSRS Presets), 7-Color Flags, and Custom Study / Mistake Drills
const decksViewSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/decks/DecksView.tsx'),
  'utf-8'
);
const customStudyModalSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/study/CustomStudyModal.tsx'),
  'utf-8'
);
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
const ioModalSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/ImageOcclusionEditorModal.tsx'),
  'utf-8'
);
const mathRendererSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mathRenderer.ts'),
  'utf-8'
);
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
const mediaUrlSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mediaUrl.ts'),
  'utf-8'
);
const wysiwygSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/quick-add/TowerWysiwygEditor.tsx'),
  'utf-8'
);
const deckSvcSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'bridge/deck_service.py'),
  'utf-8'
);
const editSvcSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'bridge/edit_service.py'),
  'utf-8'
);
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
const syncStateIconSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/common/SyncStateIcon.tsx'),
  'utf-8'
);
assert(
  syncStateIconSrc.includes("'snapshot'") &&
    syncStateIconSrc.includes("'unsynced'") &&
    syncPillSrc.includes('<SyncStateIcon') &&
    !syncPillSrc.includes('shadow-[0_0_6px_rgba(47,148,97,0.4)]') &&
    syncPillSrc.includes('<time') &&
    syncPillSrc.includes("e.key === 'Escape'") &&
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
const item28HostSrc = fs.readFileSync(path.resolve(ADDON_ROOT, '__init__.py'), 'utf-8');
const item28RouterSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'bridge/router.py'), 'utf-8');
const item28AppSrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'frontend/src/App.tsx'), 'utf-8');
const item28StoreSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/stores/useAppStore.ts'),
  'utf-8'
);
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
    syncPillSrc.includes('此时间代表上次同步云端时间。如有新的修改，请点击按钮完成同步。') &&
    syncPillSrc.includes('motion-safe:transition-[transform,rotate,color]') &&
    !syncPillSrc.includes("t('syncStatusProtected')") &&
    !syncPillSrc.includes("t('syncNowAction')"),
  'Item #28: Sync completion lifecycle must coordinate anki:sync-finished, handle NO_CHANGES via last_sync_checked_map + sessionVerifiedSyncTs, and preserve syncJustFinished across silent refreshes'
);

// Item #29: Library Card UI Optimization (subgrid, container queries, multi-block clamp separation, footer & accessibility fixes)
const item29MathRendererSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/utils/mathRenderer.ts'),
  'utf-8'
);
const item29IndexCssSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/index.css'),
  'utf-8'
);
assert(
  item29MathRendererSrc.includes('export function formatCardPreviewHtml') &&
    item29IndexCssSrc.includes('.library-card-grid') &&
    item29IndexCssSrc.includes('container: library-card-band / inline-size') &&
    item29IndexCssSrc.includes('@supports (grid-template-rows: subgrid)') &&
    item29IndexCssSrc.includes('.library-card-snippet-body') &&
    item29IndexCssSrc.includes('text-wrap: balance') &&
    item29IndexCssSrc.includes('@container library-card-band (max-width: 222px)') &&
    item29IndexCssSrc.includes('@container library-card-band (max-width: 185px)') &&
    librarySrc.includes('formatCardPreviewHtml') &&
    librarySrc.includes('library-card-grid') &&
    librarySrc.includes('library-card-snippet-body') &&
    librarySrc.includes('library-card-footer-meta') &&
    librarySrc.includes('aria-pressed={isSelected}') &&
    librarySrc.includes('table-fixed') &&
    librarySrc.includes('library-table-preview') &&
    !librarySrc.includes('p-2.5 rounded-xl text-[12px] leading-relaxed line-clamp-2'),
  'Item #29: LibraryView cards must use subgrid alignment, container queries, decoupled multi-block snippet clamping, non-overlapping footer, and accessible targets'
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
const designSystemSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/components/design-system/DesignSystemView.tsx'),
  'utf-8'
);
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
      fs.readFileSync(file, 'utf-8'),
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
const viSrc = fs.readFileSync(path.join(LOCALE_DIR, 'vi.ts'), 'utf-8');
const viCjkLines = viSrc.split('\n').filter((l) => /[\u4e00-\u9fff]/.test(l));
assert(
  viCjkLines.length === 0,
  `Item #33: 越南语字典残留中文字符 → ${viCjkLines.slice(0, 3).join(' | ')}`
);

// Item #34: Windows 验版报告 8 项修复守卫
const smokePySrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/scenarios/smoke.py'), 'utf-8');
const runPySrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/scenarios/run.py'), 'utf-8');
const pathsPySrc = fs.readFileSync(path.resolve(ADDON_ROOT, 'tests/scenarios/paths.py'), 'utf-8');
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

const jsBundle = fs.readFileSync(WEB_JS, 'utf-8');
const cssBundle = fs.readFileSync(WEB_CSS, 'utf-8');
assert(
  jsBundle.length > 100000 &&
    cssBundle.length > 10000 &&
    cssBundle.includes('library-card-snippet-body') &&
    cssBundle.includes('library-card-footer-meta') &&
    fs.existsSync(ANKIADDON_FILE),
  'Compiled production bundle and anki_modern_os.ankiaddon must exist with Library card CSS rules'
);

// Item #35: 动效体系整体补齐门禁 —— 校验构建产物 CSS 包含全部核心动效类、令牌与无障碍降级，且源码中任意 animate-* 类均在产物 CSS 中真实存在
const frontendPkgSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/package.json'),
  'utf-8'
);
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
  const content = fs.readFileSync(file, 'utf-8');
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
    cssBundle.includes(`.${cls}`),
    `Item #35: TSX references class "${cls}" but ".${cls}" is missing from compiled web/assets/index.css`
  );
}

// Item #36: Dashboard visual hierarchy — semantic surfaces, content-aware grids, and reduced visual noise
const dashboardCssSrc = fs.readFileSync(
  path.resolve(ADDON_ROOT, 'frontend/src/index.css'),
  'utf-8'
);
assert(
  dashboardSrc.includes('dashboard-shell') &&
    dashboardSrc.includes('dashboard-header') &&
    dashboardSrc.includes('dashboard-surface') &&
    dashboardSrc.includes('dashboard-hero') &&
    dashboardSrc.includes('dashboard-stat-pill') &&
    dashboardSrc.includes('dashboard-deck-grid') &&
    dashboardSrc.includes('dashboard-heatmap-viewport') &&
    dashboardSrc.includes('dashboard-tooltip') &&
    dashboardCssSrc.includes('--dashboard-shadow-card') &&
    dashboardCssSrc.includes('.dashboard-surface') &&
    dashboardCssSrc.includes('.dashboard-deck-grid') &&
    dashboardCssSrc.includes('.dashboard-heatmap-viewport') &&
    cssBundle.includes('dashboard-surface') &&
    cssBundle.includes('dashboard-deck-grid') &&
    cssBundle.includes('dashboard-heatmap-viewport') &&
    syncPillSrc.includes('dashboard-tooltip'),
  'Item #36: Dashboard must use semantic surface tokens, content-aware deck/heatmap layout, and shared tooltip styling'
);

console.log('[Part 1 Guardrails + 9 UX Enhancements Audit Suite] ALL CHECKS PASSED!');
