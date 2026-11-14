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
    ok(html.includes('Last synced'), 'English sync prefix must render');
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

