// ============================================================================
// Render smoke tests (server-side, no DOM needed)
// React 19's renderToStaticMarkup lets us exercise real component code paths in
// Node without jsdom. These are the leaf, prop-driven components — the ones a
// broken refactor silently turns into blank markup.
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, equal, ok, doesNotMatch } from '../harness';
import { AnkiStudioLogo } from '../../../frontend/src/components/common/AnkiStudioLogo';
import { SyncStateIcon } from '../../../frontend/src/components/common/SyncStateIcon';
import { StreakFlameBackdrop } from '../../../frontend/src/components/dashboard/StreakFlameBackdrop';
import { SyncStatusPill } from '../../../frontend/src/components/dashboard/SyncStatusPill';
import { CardEditorModal } from '../../../frontend/src/components/quick-add/CardEditorModal';
import { DecksView } from '../../../frontend/src/components/decks/DecksView';
import { ReviewerView } from '../../../frontend/src/components/reviewer/ReviewerView';
import { SettingsModal } from '../../../frontend/src/components/settings/SettingsModal';
import { VacationModal } from '../../../frontend/src/components/vacation/VacationModal';
import { IcuRescueModal } from '../../../frontend/src/components/vacation/IcuRescueModal';
import {
  CelebrationIllustration,
  EmptyStateIllustration,
  GreetingVignette,
  ReviewerCornerDecor,
  ThemedDeckEmblem,
} from '../../../frontend/src/components/common/ThemeIllustrations';
import { ACCENT_COLOR_LIST } from '../../../frontend/src/utils/themeTokens';
import { getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';
import {
  ChartTooltipContent,
  ChartTooltipPortal,
  Tooltip,
  TOOLTIP_VARIANT_CLASSES,
} from '../../../frontend/src/components/common/Tooltip';
import {
  HoverCard,
  HOVERCARD_SIZE_CLASSES,
} from '../../../frontend/src/components/common/HoverCard';

function render(element: React.ReactElement): string {
  const html = renderToStaticMarkup(element);
  ok(html.length > 0, 'component rendered empty markup');
  doesNotMatch(html, /undefined|NaN/, 'rendered markup leaked a JS sentinel');
  return html;
}

section('render · AnkiStudioLogo');

test('default logo renders the split-prism SVG at 24px with the brand colours', () => {
  const html = render(React.createElement(AnkiStudioLogo));
  ok(html.startsWith('<svg'), `expected an <svg> root, got ${html.slice(0, 30)}`);
  ok(html.includes('width="24"') && html.includes('height="24"'), 'default size is 24px');
  ok(html.includes('viewBox="0 0 24 24"'), 'logo viewBox is part of the brand asset contract');
  ok(html.includes('aria-label="Anki Studio Logo"'), 'logo needs an accessible name');
  ok(html.includes('#A1C1E4'), 'left facet uses the soft studio blue');
  ok(html.includes('#3076C3'), 'right facet uses the primary brand blue');
  ok((html.match(/<path/g) || []).length >= 2, 'both prism facets must be present');
});

test('size and facet colours are overridable', () => {
  const html = render(
    React.createElement(AnkiStudioLogo, {
      size: 48,
      leftColor: '#111111',
      rightColor: '#222222',
      className: 'brand-mark',
    })
  );
  ok(html.includes('width="48"') && html.includes('height="48"'));
  ok(html.includes('#111111') && html.includes('#222222'));
  ok(html.includes('brand-mark'), 'custom className must be forwarded');
});

section('render · SyncStateIcon');

test('all four sync states render distinct, non-empty markup', () => {
  const states = ['syncing', 'justFinished', 'snapshot', 'unsynced'] as const;
  const markup = states.map((state) => render(React.createElement(SyncStateIcon, { state })));
  equal(new Set(markup).size, states.length, 'each sync state must be visually distinct');
});

test('syncing state spins and justFinished draws a check', () => {
  const syncing = render(React.createElement(SyncStateIcon, { state: 'syncing' }));
  ok(syncing.includes('motion-safe:animate-spin'), 'syncing indicator must animate');
  const finished = render(React.createElement(SyncStateIcon, { state: 'justFinished' }));
  ok(finished.includes('polyline'), 'finished state draws the check polyline');
  ok(finished.includes('--status-success'), 'finished state uses the success token');
});

test('unsynced and snapshot states stay shape-distinct', () => {
  const unsynced = render(React.createElement(SyncStateIcon, { state: 'unsynced' }));
  const snapshot = render(React.createElement(SyncStateIcon, { state: 'snapshot' }));
  ok(unsynced.includes('M2 2l20 20'), 'unsynced state keeps the strike-through diagonal');
  ok(snapshot.includes('M17.5 19H9'), 'snapshot state keeps the cloud path');
  ok(snapshot.includes('--brand-text'), 'snapshot state is brand-tinted');
});

test('size presets map onto the documented Tailwind classes', () => {
  equal(render(React.createElement(SyncStateIcon, { state: 'snapshot', size: 'xs' })).includes('w-3 h-3'), true);
  equal(render(React.createElement(SyncStateIcon, { state: 'snapshot', size: 'sm' })).includes('w-3.5 h-3.5'), true);
  equal(render(React.createElement(SyncStateIcon, { state: 'snapshot', size: 'lg' })).includes('w-4 h-4'), true);
});

section('render · StreakFlameBackdrop');

test('decorative flame is hidden from the accessibility tree', () => {
  const html = render(React.createElement(StreakFlameBackdrop, { isDark: false }));
  ok(html.includes('aria-hidden="true"'), 'pure decoration must not be announced by screen readers');
  ok(html.includes('viewBox="0 0 220 156"'), 'flame viewBox is part of the hero layout contract');
  ok(html.includes('<defs>') && html.includes('radialGradient'), 'flame uses gradient layers');
});

test('dark mode changes the flame atmosphere without changing its geometry', () => {
  const light = render(React.createElement(StreakFlameBackdrop, { isDark: false }));
  const dark = render(React.createElement(StreakFlameBackdrop, { isDark: true }));
  ok(light !== dark, 'isDark must actually affect the rendered output');
  ok(dark.includes('0.38') && light.includes('0.28'), 'dark mode uses stronger flame opacity');
  equal((light.match(/<path/g) || []).length, (dark.match(/<path/g) || []).length, 'geometry must be identical across themes');
});

test('repeated renders stay deterministic in shape', () => {
  const first = render(React.createElement(StreakFlameBackdrop, { isDark: true }));
  const second = render(React.createElement(StreakFlameBackdrop, { isDark: true }));
  equal(first.length, second.length, 'markup length must be stable across renders');
});

section('render · Tooltip & HoverCard (SSR)');

test('Tooltip renders intrinsic enabled trigger cleanly in SSR (closed & controlled open)', () => {
  const closedHtml = render(
    React.createElement(
      Tooltip,
      { content: 'Command Palette', shortcut: 'Cmd+K' },
      React.createElement('button', { type: 'button', 'aria-label': 'Command Palette' }, 'K'),
    ),
  );
  ok(closedHtml.startsWith('<button'), 'enabled intrinsic trigger should not be extra-wrapped');
  ok(closedHtml.includes('aria-label="Command Palette"'));

  const openSsrHtml = render(
    React.createElement(
      Tooltip,
      { content: 'Zoom In', variant: 'compact', open: true },
      React.createElement('button', { type: 'button' }, '+'),
    ),
  );
  ok(openSsrHtml.startsWith('<button') && openSsrHtml.includes('>+<' + '/button>'));
  ok(
    openSsrHtml.includes('aria-describedby='),
    'supplementary open Tooltip must bind aria-describedby on trigger',
  );
  const openDuplicateHtml = render(
    React.createElement(
      Tooltip,
      { content: 'Zoom In', variant: 'compact', open: true },
      React.createElement('button', { type: 'button', 'aria-label': 'Zoom In' }, '+'),
    ),
  );
  ok(
    !openDuplicateHtml.includes('aria-describedby='),
    'auto ariaLabelMode must suppress duplicate aria-describedby when aria-label matches plain content',
  );
  ok(
    TOOLTIP_VARIANT_CLASSES.compact.includes('max-w-[260px]') &&
      TOOLTIP_VARIANT_CLASSES.chart.includes('tabular-nums'),
    'variant class maps must expose compact and chart specs',
  );
});

test('Tooltip wraps disabled native triggers and forwards layout utility tokens', () => {
  const html = render(
    React.createElement(
      Tooltip,
      { content: 'Come back tomorrow', triggerClassName: 'shrink-0' },
      React.createElement(
        'button',
        { type: 'button', disabled: true, className: 'w-full flex-1' },
        'Study',
      ),
    ),
  );
  ok(html.startsWith('<span'), 'disabled native trigger must be wrapped so hover stays active');
  ok(html.includes('w-full') && html.includes('flex-1') && html.includes('shrink-0'));
  ok(html.includes('pointer-events:none'), 'inner disabled button must delegate pointer events');
});

test('ChartTooltipContent and ChartTooltipPortal render SSR-safe chart markup', () => {
  const contentHtml = render(
    React.createElement(ChartTooltipContent, {
      eyebrow: '2026-11-14',
      heading: 'Reviewed 42',
      rows: [
        { label: 'Good', value: '36', tone: 'success' },
        { label: 'Hard', value: '4', tone: 'warning' },
        { label: 'Again', value: '2', tone: 'danger' },
      ],
      footer: 'Retention 95%',
    }),
  );
  ok(contentHtml.includes('tabular-nums'));
  ok(contentHtml.includes('2026-11-14') && contentHtml.includes('Reviewed 42'));
  ok(contentHtml.includes('--status-success-text') && contentHtml.includes('--status-warning-text'));
  ok(contentHtml.includes('Retention 95%'));

  const portalHtml = renderToStaticMarkup(
    React.createElement(ChartTooltipPortal, {
      open: true,
      anchorEl: null,
      content: React.createElement('span', null, '42'),
    }),
  );
  equal(portalHtml, '', 'ChartTooltipPortal must safely render empty string during SSR');
});

test('HoverCard renders disclosure semantics and stays SSR-safe when open', () => {
  const html = render(
    React.createElement(
      HoverCard,
      {
        size: 'sm',
        open: true,
        content: React.createElement('div', null, 'Retention breakdown'),
      },
      React.createElement('button', { type: 'button' }, 'Info'),
    ),
  );
  ok(html.includes('<button type="button"'));
  ok(html.includes('aria-expanded="true"'), 'toggleOnClick HoverCard must expose aria-expanded');
  ok(html.includes('data-hovercard-root='), 'HoverCard must stamp outside-click root marker');
  ok(HOVERCARD_SIZE_CLASSES.sm.includes('w-[220px]') && HOVERCARD_SIZE_CLASSES.md.includes('w-[248px]'));
});

section('render · SyncStatusPill');

test('SyncStatusPill renders full English label without overflow-hidden or leading-none descender clipping', () => {
  const prevState = getAppState();
  try {
    setAppState({
      resolvedLang: 'en',
      syncing: false,
      isInitialSyncing: false,
      syncJustFinished: false,
      lastSyncedTimestamp: Date.now() - 65_000,
    });
    const html = render(React.createElement(SyncStatusPill));
    ok(!html.includes('>Last synced<'), 'Inline sync pill should omit verbose "Last synced" prefix');
    ok(html.includes('aria-label="Last synced '), 'Accessible aria-label should retain full sync context');
    ok(html.includes('1m ago') || html.includes('1'), 'Relative sync timestamp must render');
    ok(!html.includes('overflow-hidden'), 'Snapshot sync pill label must not clip descenders via overflow-hidden');
    ok(!html.includes('leading-none'), 'Sync pill label must avoid leading-none so g/y descenders stay intact');
    ok(html.includes('leading-[1.4]') && html.includes('whitespace-nowrap'));
  } finally {
    setAppState({
      resolvedLang: prevState.resolvedLang,
      syncing: prevState.syncing,
      isInitialSyncing: prevState.isInitialSyncing,
      syncJustFinished: prevState.syncJustFinished,
      lastSyncedTimestamp: prevState.lastSyncedTimestamp,
    });
  }
});

section('render · CardEditorModal');

test('open card editor modal renders ui-modal-backdrop without GPU backdrop-blur layers', () => {
  const prevState = getAppState();
  setAppState({
    quickAddOpen: true,
    editingCardData: null,
  });

  try {
    const html = render(React.createElement(CardEditorModal));
    ok(html.includes('ui-modal-backdrop'), 'expected ui-modal-backdrop overlay class');
    ok(html.includes('ui-modal-panel'), 'expected ui-modal-panel container class');
    doesNotMatch(
      html,
      /backdrop-blur/,
      'card editor modal should not mount live backdrop-blur layers over Windows QtWebEngine',
    );
  } finally {
    setAppState({
      quickAddOpen: prevState.quickAddOpen,
      editingCardData: prevState.editingCardData,
    });
  }
});

section('render · ThemeIllustrations (color-bound artworks)');

test('official default indigo renders zero decorative illustration markup', () => {
  for (const Comp of [GreetingVignette, ReviewerCornerDecor, CelebrationIllustration, EmptyStateIllustration]) {
    equal(renderToStaticMarkup(React.createElement(Comp, { accentColor: 'indigo' })), '');
  }
  equal(
    renderToStaticMarkup(React.createElement(ThemedDeckEmblem, { accentColor: 'indigo', deckAccent: 'indigo' })),
    ''
  );
});

test('all 7 themed accent colors render valid accessible masked illustrations and greeting watermarks across light and dark modes', () => {
  const nonDefault = ACCENT_COLOR_LIST.filter((a) => a.id !== 'indigo').map((a) => a.id);
  const deckSlots = ['indigo', 'blue', 'emerald', 'amber', 'rose', 'purple'] as const;
  for (const accent of nonDefault) {
    for (const isDark of [false, true]) {
      const greetingHtml = render(React.createElement(GreetingVignette, { accentColor: accent, isDark }));
      ok(
        greetingHtml.includes('greeting-watermark-stage') &&
          greetingHtml.includes('greeting-watermark-glyph') &&
          greetingHtml.includes(`data-accent="${accent}"`) &&
          greetingHtml.includes('aria-hidden="true"'),
        `${accent}: expected accessible masked greeting watermark`
      );

      const cornerHtml = render(React.createElement(ReviewerCornerDecor, { accentColor: accent, isDark }));
      ok(
        cornerHtml.includes('reviewer-corner-decor') &&
          cornerHtml.includes('reviewer-corner-glyph--left') &&
          cornerHtml.includes('reviewer-corner-glyph--right') &&
          cornerHtml.includes(`data-accent="${accent}"`) &&
          cornerHtml.includes('aria-hidden="true"') &&
          cornerHtml.includes(isDark ? 'opacity-45' : 'opacity-65') &&
          !cornerHtml.includes('<svg'),
        `${accent}/${isDark ? 'dark' : 'light'}: expected accessible masked ReviewerCornerDecor without inline SVG`
      );

      const cornerInspectorHtml = render(
        React.createElement(ReviewerCornerDecor, { accentColor: accent, isDark, inspectorOpen: true })
      );
      ok(
        cornerInspectorHtml.includes('opacity-0'),
        `${accent}: expected ReviewerCornerDecor to hide with opacity-0 when inspectorOpen=true`
      );

      const celebrationHtml = render(React.createElement(CelebrationIllustration, { accentColor: accent, isDark }));
      ok(
        celebrationHtml.includes('celebration-illustration-stage') &&
          celebrationHtml.includes('celebration-illustration-glyph') &&
          celebrationHtml.includes(`data-accent="${accent}"`) &&
          celebrationHtml.includes('aria-hidden="true"') &&
          !celebrationHtml.includes('<svg'),
        `${accent}: expected accessible masked CelebrationIllustration without inline SVG`
      );

      const emptyHtml = render(React.createElement(EmptyStateIllustration, { accentColor: accent, isDark }));
      ok(
        emptyHtml.includes('empty-illustration-stage') &&
          emptyHtml.includes('empty-illustration-glyph') &&
          emptyHtml.includes(`data-accent="${accent}"`) &&
          emptyHtml.includes('aria-hidden="true"') &&
          !emptyHtml.includes('<svg'),
        `${accent}: expected accessible masked EmptyStateIllustration without inline SVG`
      );

      for (const Comp of [GreetingVignette, ReviewerCornerDecor, CelebrationIllustration, EmptyStateIllustration]) {
        equal(
          renderToStaticMarkup(React.createElement(Comp, { accentColor: accent, isDark, enabled: false })),
          '',
          `${accent}: expected enabled=false override to suppress illustration`
        );
      }

      for (const deckAccent of deckSlots) {
        const html = render(
          React.createElement(ThemedDeckEmblem, { accentColor: accent, deckAccent, isDark })
        );
        ok(html.includes('<svg') && html.includes('aria-hidden="true"'), `${accent}/${deckAccent}: expected emblem SVG`);
      }
    }
  }
});

test('showIllustrations=false suppresses all theme illustrations and appearance tab renders Show Illustrations switch', () => {
  const prevState = getAppState();
  setAppState({
    showIllustrations: false,
    accentColor: 'rose',
    resolvedLang: 'zh-CN',
    settingsOpen: true,
    settingsInitialTab: 'appearance',
  });
  try {
    for (const Comp of [GreetingVignette, ReviewerCornerDecor, CelebrationIllustration, EmptyStateIllustration]) {
      equal(renderToStaticMarkup(React.createElement(Comp, { accentColor: 'rose' })), '');
    }
    equal(
      renderToStaticMarkup(React.createElement(ThemedDeckEmblem, { accentColor: 'rose', deckAccent: 'indigo' })),
      ''
    );

    const modalHtml = render(React.createElement(SettingsModal));
    ok(modalHtml.includes('显示插画'), 'expected Show Illustrations label in appearance tab');
    ok(
      modalHtml.includes('type="checkbox"') &&
        modalHtml.includes('switch=""') &&
        modalHtml.includes('anki-switch-sm'),
      'expected accessible switch control for 显示插画 in theme color header'
    );
    doesNotMatch(
      modalHtml,
      />橘猫伴读</,
      'theme color card header should replace atmosphere pill badge with the switch control'
    );
  } finally {
    setAppState({
      showIllustrations: prevState.showIllustrations,
      accentColor: prevState.accentColor,
      resolvedLang: prevState.resolvedLang,
      settingsOpen: prevState.settingsOpen,
      settingsInitialTab: prevState.settingsInitialTab,
    });
  }
});

section('render · SettingsModal (About tab)');

test('about tab renders only version info, creator info, and accessible anonymous feedback switch', () => {
  const prevState = getAppState();
  setAppState({
    settingsOpen: true,
    settingsInitialTab: 'about',
    resolvedLang: 'zh-CN',
    analyticsEnabled: true,
    envInfo: {
      ...prevState.envInfo,
      studioVersion: '1.6.9',
      platformBadge: 'macOS · 26.9',
    },
  });

  try {
    const html = render(React.createElement(SettingsModal));
    ok(html.includes('v1.6.9'), 'expected version badge');
    const versionMatches = html.match(/v1\.6\.9/g) || [];
    equal(versionMatches.length, 1, 'version badge should appear once without duplication');
    ok(html.includes('macOS · 26.9'), 'expected platform badge');
    ok(html.includes('FSRS Ready'), 'expected engine status');
    ok(
      html.includes('gripet') &&
        html.includes('作者') &&
        html.includes('兴趣驱动 AI 产品建筑师') &&
        html.includes('src="./creator-avatar.jpg"') &&
        html.includes('about-creator-links'),
      'expected refined creator card with name, role badge, photo avatar, and intrinsic flex link row'
    );
    ok(
      html.includes('rel="noopener noreferrer"') &&
        html.includes('github.com/gripet43/anki-studio') &&
        html.includes('https://ankiweb.net/shared/info/1071937836?cb=1794962974753'),
      'expected secure external links including AnkiWeb upvote link'
    );
    ok(
      html.includes('type="checkbox"') && html.includes('switch=""') && html.includes('aria-describedby='),
      'expected accessible native switch input linked to description'
    );
    ok(html.includes('role="list"'), 'expected Safari-safe explicit list role');
    doesNotMatch(
      html,
      /沉浸式桌面界面|设计理念：把专注还给你|已开启|匿名使用统计/,
      'about tab should omit legacy cards, duplicate version, and duplicate feedback status labels'
    );
  } finally {
    setAppState({
      settingsOpen: prevState.settingsOpen,
      settingsInitialTab: prevState.settingsInitialTab,
      resolvedLang: prevState.resolvedLang,
      analyticsEnabled: prevState.analyticsEnabled,
      envInfo: prevState.envInfo,
    });
  }
});

test('ReviewerView session-complete screen renders semantic article, subgrid stats, and unified equal-height action buttons', () => {
  const prev = getAppState();
  setAppState({
    inReviewMode: true,
    isSessionComplete: true,
    resolvedLang: 'zh-CN',
    theme: 'light',
    systemDark: false,
    accentColor: 'emerald',
    sessionStudiedCount: 12,
    sessionCorrectCount: 11,
    sessionTotalTimeMs: 150000,
    reviewScopeDeckId: '1',
    pendingDayRollover: null,
  });
  try {
    const html = renderToStaticMarkup(React.createElement(ReviewerView));
    ok(html.includes('<article class="reviewer-card-shell reviewer-complete-card'), 'expected semantic <article> card container');
    ok(html.includes('<header class="reviewer-complete-header">'), 'expected <header> region inside completion card');
    ok(html.includes('<h2 class="reviewer-complete-title">恭喜完成当前牌组复习！</h2>'), 'expected balanced heading');
    ok(html.includes('<div class="reviewer-complete-stats">'), 'expected 3-col subgrid stats container');
    ok(html.includes('reviewer-complete-stat-value--success'), 'expected single semantic success accent on accuracy only');
    ok(html.includes('<footer class="reviewer-complete-actions">'), 'expected <footer> action group');
    const btns = Array.from(html.matchAll(/class="reviewer-complete-btn reviewer-complete-btn--(primary|secondary)"/g));
    equal(btns.length, 2, 'expected both session-complete actions to share .reviewer-complete-btn sizing');
  } finally {
    setAppState({
      inReviewMode: prev.inReviewMode,
      isSessionComplete: prev.isSessionComplete,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      accentColor: prev.accentColor,
      sessionStudiedCount: prev.sessionStudiedCount,
      sessionCorrectCount: prev.sessionCorrectCount,
      sessionTotalTimeMs: prev.sessionTotalTimeMs,
      reviewScopeDeckId: prev.reviewScopeDeckId,
      pendingDayRollover: prev.pendingDayRollover,
    });
  }
});

test('DecksView create deck CTA renders single leading plus without duplicate prefix', () => {
  const prev = getAppState();
  setAppState({ resolvedLang: 'zh-CN', theme: 'light', systemDark: false });
  try {
    const zhHtml = renderToStaticMarkup(React.createElement(DecksView));
    ok(zhHtml.includes('<span>+ 新建牌组</span>'), 'expected single + prefix for newDeckBtn in zh-CN');
    doesNotMatch(zhHtml, /\+\s*\+/, 'must never render double plus prefix (+ +)');

    setAppState({ resolvedLang: 'en' });
    const enHtml = renderToStaticMarkup(React.createElement(DecksView));
    ok(enHtml.includes('<span>+ New Deck</span>'), 'expected single + prefix for newDeckBtn in en');
    doesNotMatch(enHtml, /\+\s*\+/, 'must never render double plus prefix (+ +)');
  } finally {
    setAppState({
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
    });
  }
});

section('render · SettingsModal comprehensive audit refactor');

test('SettingsModal enforces ARIA tablist semantics, de-noised tabs, schematics, separated keycaps, and safe native action', () => {
  const prev = getAppState();
  try {
    // 1. Appearance tab + shell
    setAppState({
      settingsOpen: true,
      settingsInitialTab: 'appearance',
      resolvedLang: 'zh-CN',
      theme: 'light',
      systemDark: false,
      customNickname: '张耀',
      dashboard: { ...prev.dashboard, userName: '张耀' },
      reviewContentScale: 110,
      reviewStageWidth: 'wide',
    });
    const appHtml = render(React.createElement(SettingsModal));
    ok(appHtml.includes('role="tablist"'), 'expected vertical tablist semantics');
    ok(appHtml.includes('aria-orientation="vertical"'), 'expected vertical tablist orientation');
    ok(appHtml.includes('role="tab"'), 'expected role="tab" on sidebar buttons');
    ok(appHtml.includes('role="tabpanel"'), 'expected role="tabpanel" on content pane');
    ok(appHtml.includes('overscroll-contain'), 'expected scroll containment on tabpanel');
    ok(appHtml.includes('<details class="group">'), 'expected collapsible <details> disclosure for language selector');
    ok(appHtml.includes('settings-text-input'), 'expected crisp accessible .settings-text-input field');
    ok(appHtml.includes('aria-label="清空"'), 'expected 1-click clear button when nickname is populated');
    ok(
      appHtml.indexOf('aria-label="上传图片"') < appHtml.indexOf('aria-label="默认首字母"'),
      'upload action should sit in the header row rather than wrapping below presets'
    );
    doesNotMatch(appHtml, /当前生效名称：张耀/, 'duplicate active-name helper should hide when input already shows it');
    doesNotMatch(appHtml, /明亮柔和纸感/, 'appearance theme cards must omit marketing prose');
    doesNotMatch(appHtml, /所有偏好自动持久化至本地插件配置/, 'appearance tab must omit top essay subtitle');
    doesNotMatch(appHtml, /\btitle="/, 'SettingsModal must never emit raw HTML title= attributes');

    // 2. Answer tab
    setAppState({ settingsInitialTab: 'answer' });
    const ansHtml = render(React.createElement(SettingsModal));
    ok(ansHtml.includes('<fieldset class="reviewer-width-fieldset"'), 'expected semantic <fieldset> radio groups');
    ok(ansHtml.includes('name="settings-answer-mode"'), 'expected native radio inputs for answer mode');
    ok(ansHtml.includes('name="settings-review-scale"'), 'expected native radio inputs for scale track');
    ok(ansHtml.includes('settings-segmented-bar'), 'expected full-width unified segmented bar for scale options');
    ok(ansHtml.includes('name="settings-stage-width"'), 'expected native radio inputs for stage width');
    ok(ansHtml.includes('divide-y'), 'expected clean hairline divider separating scale and width sections');
    ok(ansHtml.includes('<svg'), 'expected AnswerModeGlyph & ReviewerWidthGlyph schematics in settings answer tab');
    doesNotMatch(ansHtml, /max-w-md|1 · 2/, 'answer mode cards should span full width with schematics instead of 1 · 2 text');
    ok(ansHtml.includes('恢复默认'), 'expected contextual reset link when scale or width is customized');
    doesNotMatch(ansHtml, /揭示答案时自动播放背面音频/, 'answer audio toggles must avoid duplicate stacked subtitles');

    // 3. Shortcuts tab
    setAppState({ settingsInitialTab: 'shortcuts' });
    const scHtml = render(React.createElement(SettingsModal));
    ok(scHtml.includes('<dl'), 'expected semantic description list for shortcuts');
    ok(scHtml.includes('settings-keycap'), 'expected optically trimmed .settings-keycap keycaps');
    doesNotMatch(scHtml, /<kbd[^>]*>[^<]*遗忘/, 'rating prose must never be wrapped inside <kbd>');
    ok(scHtml.includes('卡片信息') && scHtml.includes('旗标') && scHtml.includes('展开下一条提示'), 'expected complete reviewer shortcut entries');

    // 4. Maintenance tab
    setAppState({ settingsInitialTab: 'maintenance' });
    const maintHtml = render(React.createElement(SettingsModal));
    ok(maintHtml.includes('divide-y'), 'expected single-level divide-y diagnostics card without box-in-box nesting');
    ok(maintHtml.includes('role="status"') && maintHtml.includes('aria-live="polite"'), 'expected polite live status regions');
    doesNotMatch(maintHtml, /1\.\s*检查数据库完整性|2\.\s*清理空白卡片|3\.\s*检查冗余媒体文件/, 'independent diagnostics must omit fake step numbers');

    // 5. Native tab
    setAppState({ settingsInitialTab: 'native' });
    const nativeHtml = render(React.createElement(SettingsModal));
    ok(nativeHtml.includes('btn-secondary'), 'expected neutral secondary action button for safe native mode switch');
    doesNotMatch(nativeHtml, /--status-danger/, 'safe reversible native mode tab must never use danger red');
  } finally {
    setAppState({
      settingsOpen: prev.settingsOpen,
      settingsInitialTab: prev.settingsInitialTab,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      reviewContentScale: prev.reviewContentScale,
      reviewStageWidth: prev.reviewStageWidth,
      customNickname: prev.customNickname,
      dashboard: prev.dashboard,
    });
  }
});

section('render · VacationModal & IcuRescueModal');

test('VacationModal renders StudioDurationControl presets + slider without cryptic 3d suffix', () => {
  const prev = getAppState();
  setAppState({
    vacationModalOpen: true,
    vacationModalTab: 'status',
    resolvedLang: 'zh-CN',
    theme: 'light',
    systemDark: false,
    dashboard: {
      ...prev.dashboard,
      vacation: { isActive: false },
    },
  });
  try {
    const html = renderToStaticMarkup(React.createElement(VacationModal));
    ok(html.includes('role="tablist"') && html.includes('role="tab"') && html.includes('role="tabpanel"'), 'expected semantic tablist/tab/tabpanel roles');
    ok(html.includes('<fieldset class="vacation-duration-fieldset">'), 'expected semantic fieldset for duration presets');
    ok(html.includes('class="studio-range-slider"') && html.includes('type="range"'), 'expected branded native range slider');
    ok(/<label for="([^"]+)"[^>]*>休假时长<\/label>/.test(html), 'expected <label for> bound to duration range input');
    ok(html.includes('aria-valuetext="3 天"'), 'expected localized aria-valuetext on slider');
    ok(/aria-pressed="true"[^>]*>[\s\S]*?<span>3[\s\S]*?天<\/span><\/button>/.test(html), 'expected active preset button with check indicator');
    ok(html.includes('vacation-safeguards-chevron') && html.includes('anki-switch anki-switch-sm'), 'expected disclosure chevron and native/fallback switches for safeguards');
    doesNotMatch(html, />\s*3d\s*</, 'must not render cryptic English 3d abbreviation');
  } finally {
    setAppState({
      vacationModalOpen: prev.vacationModalOpen,
      vacationModalTab: prev.vacationModalTab,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      dashboard: prev.dashboard,
    });
  }
});

test('IcuRescueModal shares Studio modal shell, choice cards, range slider, and semantic history tab', () => {
  const prev = getAppState();
  setAppState({
    icuModalOpen: true,
    icuModalTab: 'rescue',
    resolvedLang: 'zh-CN',
    theme: 'light',
    systemDark: false,
    dashboard: {
      ...prev.dashboard,
      backlog: { ...prev.dashboard.backlog, totalDue: 28, suggestedDays: 7 },
    },
  });
  try {
    const html = renderToStaticMarkup(React.createElement(IcuRescueModal));
    ok(html.includes('vacation-modal-panel') && html.includes('role="tablist"'), 'expected unified Studio modal shell & tablist');
    ok(html.includes('减负记录') && !html.includes('休假记录'), 'expected rescue-specific history tab label');
    ok(html.includes('vacation-choice-card') && html.includes('aria-pressed="true"'), 'expected unified strategy choice cards');
    ok(html.includes('class="studio-range-slider"') && html.includes('min="2"') && html.includes('max="30"'), 'expected shared range slider 2..30');
    ok(html.includes('aria-valuetext="7 天"') && html.includes('执行平摊方案 (7 天)'), 'expected localized unit on slider & CTA');
    doesNotMatch(html, /\(\s*7d\s*\)|>\s*2d\s*<|>\s*30d\s*</, 'must not render raw d suffixes');
  } finally {
    setAppState({
      icuModalOpen: prev.icuModalOpen,
      icuModalTab: prev.icuModalTab,
      resolvedLang: prev.resolvedLang,
      theme: prev.theme,
      systemDark: prev.systemDark,
      dashboard: prev.dashboard,
    });
  }
});


