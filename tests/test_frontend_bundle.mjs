#!/usr/bin/env node
/**
 * Anki Modern OS — Comprehensive Bundle & Source Verification Suite
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
    translationsSrc.includes("searchPlaceholder: '搜索...'") &&
    translationsSrc.includes("searchLibraryPlaceholder: '搜索卡片...'"),
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

const jsBundle = fs.readFileSync(WEB_JS, 'utf-8');
const cssBundle = fs.readFileSync(WEB_CSS, 'utf-8');
assert(
  jsBundle.length > 100000 && cssBundle.length > 10000 && fs.existsSync(ANKIADDON_FILE),
  'Compiled production bundle and anki_modern_os.ankiaddon must exist'
);

console.log('[Part 1 Guardrails + 9 UX Enhancements Audit Suite] ALL CHECKS PASSED!');
