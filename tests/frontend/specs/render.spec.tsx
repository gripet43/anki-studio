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
