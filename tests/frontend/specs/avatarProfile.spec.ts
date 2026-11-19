// ============================================================================
// Profile Avatar validation, square crop math, SSR render & store contracts
// All tests are strictly synchronous per `tests/frontend/harness.ts`.
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, eq, equal, ok, doesNotMatch, throws } from '../harness';
import {
  AVATAR_CROP_MAX_ZOOM,
  AVATAR_CROP_MIN_ZOOM,
  AVATAR_CROP_VIEWPORT_PX,
  AVATAR_IMAGE_ACCEPT,
  AVATAR_PRESET_IDS,
  AvatarImageError,
  clampAvatarCropTransform,
  computeAvatarCropLayout,
  computeInteractiveAvatarCropRect,
  computeSquareCoverCropRect,
  DEFAULT_AVATAR_CROP,
  DEFAULT_CUSTOM_AVATAR,
  estimateDataUrlDecodedBytes,
  getAvatarInitial,
  isDefaultCustomAvatar,
  isSafeAvatarDataUrl,
  isSupportedSourceImageFile,
  MAX_AVATAR_OUTPUT_BYTES,
  normalizeAvatarCropRotation,
  normalizeCustomAvatarConfig,
  rotateAvatarCropTransform,
  scaleAvatarCropTransformZoom,
} from '../../../frontend/src/utils/avatarImage';
import { UserAvatar } from '../../../frontend/src/components/common/UserAvatar';
import { AvatarCropModal } from '../../../frontend/src/components/settings/AvatarCropModal';
import { Sidebar } from '../../../frontend/src/components/layout/Sidebar';
import { SettingsModal } from '../../../frontend/src/components/settings/SettingsModal';
import { DesignSystemView } from '../../../frontend/src/components/design-system/DesignSystemView';
import {
  appActions,
  getAppState,
  setAppState,
} from '../../../frontend/src/stores/useAppStore';
import { translate } from '../../../frontend/src/i18n/translations';
import { callAnki } from '../../../frontend/src/bridge/pycmd';

const SAMPLE_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const SAMPLE_WEBP_DATA_URL =
  'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
const UNSAFE_SVG_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=';

function renderSafe(element: React.ReactElement): string {
  const html = renderToStaticMarkup(element);
  ok(html.length > 0, 'rendered empty markup');
  doesNotMatch(html, /undefined|NaN/, 'rendered markup leaked undefined or NaN');
  return html;
}

section('avatar · validation, presets & crop geometry');

test('AVATAR_PRESET_IDS exposes the exact 8 built-in presets', () => {
  eq(
    [...AVATAR_PRESET_IDS],
    ['book', 'owl', 'leaf', 'spark', 'cat', 'mountain', 'compass', 'flame']
  );
});

test('isSafeAvatarDataUrl allows raster data URLs within 512KB and blocks SVG/XSS/remote URLs', () => {
  equal(isSafeAvatarDataUrl(SAMPLE_PNG_DATA_URL), true);
  equal(isSafeAvatarDataUrl(SAMPLE_WEBP_DATA_URL), true);
  equal(isSafeAvatarDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='), true);
  equal(isSafeAvatarDataUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), true);

  equal(isSafeAvatarDataUrl(UNSAFE_SVG_DATA_URL), false, 'must block image/svg+xml');
  equal(isSafeAvatarDataUrl('javascript:alert(1)'), false, 'must block javascript:');
  equal(isSafeAvatarDataUrl('https://example.com/avatar.png'), false, 'must block https:');
  equal(isSafeAvatarDataUrl('file:///tmp/avatar.png'), false, 'must block file:');
  equal(isSafeAvatarDataUrl('data:image/png;base64,'), false, 'must block empty payload');
  equal(isSafeAvatarDataUrl('data:text/html;base64,PGgxPkZha2U8L2gxPg=='), false, 'must block text/html');

  const oversizedB64Len = Math.ceil(((MAX_AVATAR_OUTPUT_BYTES + 128) * 4) / 3);
  const alignedLen = oversizedB64Len + ((4 - (oversizedB64Len % 4)) % 4);
  const oversized = `data:image/png;base64,${'A'.repeat(alignedLen)}`;
  ok(estimateDataUrlDecodedBytes(oversized) > MAX_AVATAR_OUTPUT_BYTES);
  equal(isSafeAvatarDataUrl(oversized), false, 'must reject payload exceeding 512KB');
});

test('normalizeCustomAvatarConfig degrades invalid or unsafe payloads to initial', () => {
  eq(normalizeCustomAvatarConfig(null), { kind: 'initial' });
  eq(normalizeCustomAvatarConfig(undefined), { kind: 'initial' });
  eq(normalizeCustomAvatarConfig({ kind: 'preset', presetId: 'owl' }), {
    kind: 'preset',
    presetId: 'owl',
  });
  eq(normalizeCustomAvatarConfig({ kind: 'preset', presetId: 'dragon' }), {
    kind: 'initial',
  });
  eq(normalizeCustomAvatarConfig({ kind: 'image', dataUrl: UNSAFE_SVG_DATA_URL }), {
    kind: 'initial',
  });
  eq(normalizeCustomAvatarConfig({ kind: 'image', dataUrl: SAMPLE_WEBP_DATA_URL }), {
    kind: 'image',
    dataUrl: SAMPLE_WEBP_DATA_URL,
  });
  equal(isDefaultCustomAvatar(DEFAULT_CUSTOM_AVATAR), true);
  equal(isDefaultCustomAvatar({ kind: 'preset', presetId: 'book' }), false);
});

test('isSupportedSourceImageFile permits raster formats and blocks SVG/non-images', () => {
  equal(isSupportedSourceImageFile({ name: 'photo.png', type: 'image/png' }), true);
  equal(isSupportedSourceImageFile({ name: 'photo.jpg', type: 'image/jpeg' }), true);
  equal(isSupportedSourceImageFile({ name: 'photo.webp', type: 'image/webp' }), true);
  equal(isSupportedSourceImageFile({ name: 'anim.gif', type: 'image/gif' }), true);
  equal(isSupportedSourceImageFile({ name: 'bitmap.bmp', type: 'image/bmp' }), true);
  equal(isSupportedSourceImageFile({ name: 'fallback.jpeg', type: '' }), true);

  equal(isSupportedSourceImageFile({ name: 'vector.svg', type: 'image/svg+xml' }), false);
  equal(isSupportedSourceImageFile({ name: 'vector.svg', type: '' }), false);
  equal(isSupportedSourceImageFile({ name: 'notes.txt', type: 'text/plain' }), false);
  equal(isSupportedSourceImageFile({ name: 'doc.pdf', type: 'application/pdf' }), false);
});

test('computeSquareCoverCropRect computes centered 1:1 cover crop rectangles', () => {
  eq(computeSquareCoverCropRect(300, 100), { sx: 100, sy: 0, sw: 100, sh: 100 });
  eq(computeSquareCoverCropRect(100, 260), { sx: 0, sy: 80, sw: 100, sh: 100 });
  eq(computeSquareCoverCropRect(128, 128), { sx: 0, sy: 0, sw: 128, sh: 128 });
  throws(() => computeSquareCoverCropRect(0, 100), AvatarImageError);
  throws(() => computeSquareCoverCropRect(100, -5), AvatarImageError);
  throws(() => computeSquareCoverCropRect(Number.NaN, 100), AvatarImageError);
});

test('getAvatarInitial extracts uppercase initial safely', () => {
  equal(getAvatarInitial('alice'), 'A');
  equal(getAvatarInitial('  bob'), 'B');
  equal(getAvatarInitial('张耀'), '张');
  equal(getAvatarInitial(''), 'A');
});

section('avatar · UserAvatar SSR & security fallback');

test('UserAvatar renders initial, all 8 SVG presets, and safe image avatars cleanly in SSR', () => {
  const initialHtml = renderSafe(
    React.createElement(UserAvatar, {
      avatar: { kind: 'initial' },
      displayName: 'zhangyao',
      size: 'sm',
      brandHex: '#3076C3',
    })
  );
  ok(initialHtml.includes('data-avatar-kind="initial"'));
  ok(initialHtml.includes('w-8 h-8'));
  ok(initialHtml.includes('#3076C3'));
  ok(initialHtml.includes('>Z<'));

  const presetMarkups = new Set<string>();
  for (const presetId of AVATAR_PRESET_IDS) {
    const lightHtml = renderSafe(
      React.createElement(UserAvatar, {
        avatar: { kind: 'preset', presetId },
        displayName: 'Alice',
        size: 'lg',
        accentColor: 'indigo',
        isDark: false,
      })
    );
    const darkHtml = renderSafe(
      React.createElement(UserAvatar, {
        avatar: { kind: 'preset', presetId },
        displayName: 'Alice',
        size: 'lg',
        accentColor: 'emerald',
        isDark: true,
      })
    );
    ok(lightHtml.includes(`data-avatar-preset="${presetId}"`));
    ok(lightHtml.includes('w-14 h-14'));
    ok(lightHtml.includes('<svg') && lightHtml.includes('aria-hidden="true"'));
    ok(lightHtml !== darkHtml, `${presetId}: dark/accent styling should adapt`);
    presetMarkups.add(lightHtml);
  }
  equal(presetMarkups.size, AVATAR_PRESET_IDS.length, 'all 8 presets must have distinct SVG artwork');

  const imageHtml = renderSafe(
    React.createElement(UserAvatar, {
      avatar: { kind: 'image', dataUrl: SAMPLE_PNG_DATA_URL },
      displayName: 'Alice',
      size: 'lg',
    })
  );
  ok(imageHtml.includes('data-avatar-kind="image"'));
  ok(imageHtml.includes('ring-1 ring-black/10 dark:ring-white/15'));
  ok(imageHtml.includes('class="w-full h-full object-cover"'));
  ok(imageHtml.includes(SAMPLE_PNG_DATA_URL));

  const blockedSvgHtml = renderSafe(
    React.createElement(UserAvatar, {
      avatar: { kind: 'image', dataUrl: UNSAFE_SVG_DATA_URL },
      displayName: 'Zoe',
      size: 'sm',
    })
  );
  ok(blockedSvgHtml.includes('data-avatar-kind="initial"'));
  ok(!blockedSvgHtml.includes('<img'), 'unsafe SVG dataUrl must fall back to initial avatar');
});

section('avatar · store persistence, offline toast & profile isolation');

test('store defaults to initial, updates offline with toast, blocks unsafe SVG, and resets on profile switch', () => {
  const prev = getAppState();
  try {
    equal(prev.customAvatar.kind, 'initial');

    setAppState({ resolvedLang: 'zh-CN', toastMessage: null });
    void appActions.updatePreferences({
      customAvatar: { kind: 'preset', presetId: 'cat' },
    });
    eq(getAppState().customAvatar, { kind: 'preset', presetId: 'cat' });
    equal(getAppState().toastMessage, translate('zh-CN', 'avatarSavedToast'));

    void appActions.updatePreferences({
      customAvatar: { kind: 'image', dataUrl: UNSAFE_SVG_DATA_URL },
    });
    eq(getAppState().customAvatar, { kind: 'initial' });
    equal(getAppState().toastMessage, translate('zh-CN', 'avatarResetToast'));

    setAppState({
      customAvatar: { kind: 'image', dataUrl: SAMPLE_WEBP_DATA_URL },
    });
    void appActions.handleProfileChanged();
    eq(getAppState().customAvatar, { kind: 'initial' });
  } finally {
    setAppState({
      isLoading: prev.isLoading,
      isInitialSyncing: prev.isInitialSyncing,
      activeTab: prev.activeTab,
      customAvatar: prev.customAvatar,
      customNickname: prev.customNickname,
      resolvedLang: prev.resolvedLang,
      toastMessage: prev.toastMessage,
      profileGeneration: prev.profileGeneration,
      lastSyncedTimestamp: prev.lastSyncedTimestamp,
      lastSyncedText: prev.lastSyncedText,
      dashboard: prev.dashboard,
      decks: prev.decks,
    });
  }
});

section('avatar · Sidebar, SettingsModal & DesignSystemView SSR integration');

test('Sidebar, SettingsModal, and DesignSystemView render UserAvatar and profile controls cleanly', () => {
  const prev = getAppState();
  try {
    setAppState({
      resolvedLang: 'zh-CN',
      settingsOpen: true,
      settingsInitialTab: 'appearance',
      customNickname: '',
      customAvatar: { kind: 'preset', presetId: 'owl' },
      dashboard: {
        ...prev.dashboard,
        userName: '张耀',
      },
    });

    const sidebarHtml = renderSafe(React.createElement(Sidebar));
    ok(sidebarHtml.includes('data-avatar-preset="owl"'));
    ok(sidebarHtml.includes('张耀'));
    ok(
      !sidebarHtml.includes(translate('zh-CN', 'customStudyEntryBtn')),
      'Sidebar stays focused without duplicating Custom Study entry'
    );
    ok(sidebarHtml.includes('sidebar-footer-toolbar'), 'Sidebar footer should render unified toolbar');
    ok(sidebarHtml.includes('sidebar-footer-tool-btn'), 'Sidebar footer should render icon-only tool buttons');
    ok(sidebarHtml.includes('aria-pressed="false"'), 'Vacation mode button should expose aria-pressed');
    ok(sidebarHtml.includes('data-open="true"'), 'Profile trigger should reflect settingsOpen state via data-open');
    ok(sidebarHtml.includes('aria-expanded="true"'), 'Profile trigger should expose aria-expanded');
    ok(
      !sidebarHtml.includes(`aria-label="${translate('zh-CN', 'navSettings')}"`),
      'Sidebar footer should omit duplicate settings gear icon button'
    );
    doesNotMatch(sidebarHtml, /\btitle="/, 'Sidebar must not contain raw HTML title= attributes');

    const settingsHtml = renderSafe(React.createElement(SettingsModal));
    ok(settingsHtml.includes(translate('zh-CN', 'avatarSectionLabel')));
    ok(settingsHtml.includes(translate('zh-CN', 'avatarSectionSub')));
    ok(settingsHtml.includes(translate('zh-CN', 'avatarModeInitial')));
    ok(settingsHtml.includes(translate('zh-CN', 'avatarUploadBtn')));
    ok(settingsHtml.includes(translate('zh-CN', 'avatarResetBtn')));
    ok(settingsHtml.includes(`accept="${AVATAR_IMAGE_ACCEPT}"`));
    for (const presetId of AVATAR_PRESET_IDS) {
      const presetName = translate('zh-CN', `avatarPreset_${presetId}` as any);
      ok(
        settingsHtml.includes(
          translate('zh-CN', 'avatarPresetAria', { name: presetName })
        ),
        `missing aria-label for preset ${presetId}`
      );
    }
    doesNotMatch(settingsHtml, /\btitle="/, 'SettingsModal must not contain raw HTML title= attributes');

    const dsHtml = renderSafe(React.createElement(DesignSystemView));
    ok(dsHtml.includes('data-avatar-preset="owl"'));
    ok(dsHtml.includes(translate('zh-CN', 'avatarSectionLabel')));
    doesNotMatch(dsHtml, /\btitle="/, 'DesignSystemView must not contain raw HTML title= attributes');

    // Reset button hides when already using default initial avatar
    setAppState({ customAvatar: { kind: 'initial' } });
    const defaultSettingsHtml = renderSafe(React.createElement(SettingsModal));
    ok(!defaultSettingsHtml.includes(translate('zh-CN', 'avatarResetBtn')));
  } finally {
    setAppState({
      resolvedLang: prev.resolvedLang,
      settingsOpen: prev.settingsOpen,
      settingsInitialTab: prev.settingsInitialTab,
      customNickname: prev.customNickname,
      customAvatar: prev.customAvatar,
      dashboard: prev.dashboard,
    });
  }
});

test('Sidebar toggles cleanly between expanded (240px) and collapsed icon rail (72px)', () => {
  const prev = getAppState();
  try {
    setAppState({
      resolvedLang: 'zh-CN',
      activeTab: 'dashboard',
      sidebarCollapsed: false,
      settingsOpen: false,
      customAvatar: { kind: 'preset', presetId: 'owl' },
      dashboard: {
        ...prev.dashboard,
        userName: '张耀',
      },
      decks: [
        {
          id: '1',
          name: 'Default',
          fullName: 'Default',
          depth: 0,
          isChild: false,
          childrenCount: 0,
          dueReview: 12,
          dueNew: 0,
          totalCards: 100,
          masteredPercent: 50,
          retentionPercent: 90,
          accentColor: '#3B82F6',
        } as any,
      ],
    });

    const expandedHtml = renderSafe(React.createElement(Sidebar));
    ok(expandedHtml.includes('data-collapsed="false"'), 'expanded sidebar marks data-collapsed=false');
    ok(expandedHtml.includes('w-[240px]'), 'expanded sidebar uses 240px width');
    ok(
      expandedHtml.includes(`aria-label="${translate('zh-CN', 'sidebarToggleLabel')}"`) &&
        expandedHtml.includes('aria-controls="studio-sidebar-nav"'),
      'collapse button exposes state-neutral aria-label and aria-controls'
    );
    ok(expandedHtml.includes('aria-orientation="horizontal"'), 'expanded footer toolbar is horizontal');
    ok(expandedHtml.includes('focusgroup="toolbar wrap"'), 'expanded footer toolbar uses horizontal focusgroup');
    ok(expandedHtml.includes('>Anki Studio<'), 'expanded sidebar shows brand title');
    ok(
      expandedHtml.includes(`aria-label="${translate('zh-CN', 'settingsTabAbout')} · Anki Studio"`),
      'brand trigger opens Settings About tab'
    );
    ok(expandedHtml.includes('Default'), 'expanded sidebar shows deck tree');

    // Verify openSettings('about') switches cleanly and openSettings('appearance') resets back
    appActions.openSettings('about');
    equal(getAppState().settingsOpen, true, 'openSettings(about) opens SettingsModal');
    equal(getAppState().settingsInitialTab, 'about', 'openSettings(about) targets about tab');
    appActions.openSettings('appearance');
    equal(getAppState().settingsInitialTab, 'appearance', 'openSettings(appearance) resets tab');
    setAppState({ settingsOpen: false });

    // Toggle to collapsed icon rail via store action
    appActions.toggleSidebar();
    equal(getAppState().sidebarCollapsed, true, 'toggleSidebar flips sidebarCollapsed to true');

    const collapsedHtml = renderSafe(React.createElement(Sidebar));
    ok(collapsedHtml.includes('data-collapsed="true"'), 'collapsed sidebar marks data-collapsed=true');
    ok(collapsedHtml.includes('w-[72px]'), 'collapsed sidebar shrinks to 72px icon rail');
    ok(collapsedHtml.includes('aria-expanded="false"'), 'toggle button reflects collapsed aria-expanded=false');
    ok(collapsedHtml.includes('aria-orientation="vertical"'), 'collapsed footer toolbar becomes vertical');
    ok(collapsedHtml.includes('focusgroup="toolbar wrap block"'), 'vertical toolbar enables block-axis focusgroup');
    ok(!collapsedHtml.includes('>Anki Studio<'), 'collapsed rail hides brand wordmark');
    ok(!collapsedHtml.includes('>Default<'), 'collapsed rail hides expanded deck tree');
    ok(
      collapsedHtml.includes(`aria-label="${translate('zh-CN', 'sidebarDecks')}"`),
      'collapsed rail exposes compact Decks icon button'
    );
    ok(
      collapsedHtml.includes(`aria-label="${translate('zh-CN', 'quickAddBtn')}"`) &&
        collapsedHtml.includes(`aria-label="${translate('zh-CN', 'openSettingsTooltip')}"`),
      'collapsed icon-only controls expose explicit aria-labels'
    );
    ok(collapsedHtml.includes('aria-current="page"'), 'active nav tab exposes aria-current=page');
    doesNotMatch(collapsedHtml, /\btitle="/, 'collapsed Sidebar must not contain raw HTML title= attributes');

    // Toggle back to expanded
    appActions.toggleSidebar(false);
    equal(getAppState().sidebarCollapsed, false, 'toggleSidebar(false) restores expanded state');

    // SettingsModal Shortcuts tab displays Cmd + \ entry
    setAppState({ settingsOpen: true, settingsInitialTab: 'shortcuts' });
    const shortcutsHtml = renderSafe(React.createElement(SettingsModal));
    ok(
      shortcutsHtml.includes(translate('zh-CN', 'sidebarToggleLabel')),
      'SettingsModal shortcuts tab includes sidebar toggle shortcut label'
    );
  } finally {
    setAppState({
      resolvedLang: prev.resolvedLang,
      activeTab: prev.activeTab,
      sidebarCollapsed: prev.sidebarCollapsed,
      settingsOpen: prev.settingsOpen,
      settingsInitialTab: prev.settingsInitialTab,
      customAvatar: prev.customAvatar,
      dashboard: prev.dashboard,
      decks: prev.decks,
    });
  }
});

section('avatar · interactive file dialog never trips 8s bridge timeout');

test('callAnki disables 8000ms timer for pick_avatar_image while keeping default timeout for normal actions', () => {
  const origWindow = (globalThis as any).window;
  const origSetTimeout = globalThis.setTimeout;
  const origClearTimeout = globalThis.clearTimeout;
  const timers: Array<{ delay: number; cleared: boolean }> = [];
  const pendingCallbacks: Array<(raw: string) => void> = [];

  try {
    (globalThis as any).setTimeout = ((_fn: any, ms: number) => {
      const handle = { delay: ms, cleared: false };
      timers.push(handle);
      return handle as any;
    }) as any;
    (globalThis as any).clearTimeout = ((handle: any) => {
      if (handle && typeof handle === 'object') {
        handle.cleared = true;
      }
    }) as any;
    (globalThis as any).window = {
      pycmd: (_cmd: string, cb: (raw: string) => void) => {
        pendingCallbacks.push(cb);
      },
    };

    // Interactive picker MUST NOT schedule an 8000ms timeout timer
    void callAnki('pick_avatar_image', {});
    equal(timers.length, 0, 'pick_avatar_image must not time out while user browses Finder/Explorer');
    equal(pendingCallbacks.length, 1);
    pendingCallbacks.pop()!(JSON.stringify({ status: 'success', data: { picked: false, canceled: true } }));

    // Standard non-interactive action still schedules 8000ms guard timer and clears on settle
    void callAnki('get_dashboard', {});
    equal(timers.length, 1);
    equal(timers[0].delay, 8000);
    pendingCallbacks.pop()!(JSON.stringify({ status: 'success', data: {} }));
    ok(timers[0].cleared, 'normal action clears timeout once bridge responds');
  } finally {
    (globalThis as any).window = origWindow;
    globalThis.setTimeout = origSetTimeout;
    globalThis.clearTimeout = origClearTimeout;
  }
});

section('avatar · interactive crop geometry & AvatarCropModal SSR');

test('interactive crop math clamps pan bounds, preserves zoom center, rotates 90deg increments, and matches source pixels 1:1', () => {
  // 400x200 landscape in a 200px viewport at 1x -> display 400x200, maxOffsetX = 100, maxOffsetY = 0
  const baseLayout = computeAvatarCropLayout(400, 200, DEFAULT_AVATAR_CROP, 200);
  equal(baseLayout.zoom, 1);
  equal(baseLayout.rotation, 0);
  equal(baseLayout.imgWidth, 400);
  equal(baseLayout.imgHeight, 200);
  equal(baseLayout.displayWidth, 400);
  equal(baseLayout.displayHeight, 200);
  equal(baseLayout.maxOffsetX, 100);
  equal(baseLayout.maxOffsetY, 0);

  // Overshooting pan clamps tightly so no empty edges ever appear
  eq(clampAvatarCropTransform(400, 200, { zoom: 1, offsetX: 999, offsetY: -50 }, 200), {
    zoom: 1,
    offsetX: 100,
    offsetY: 0,
    rotation: 0,
  });

  // Left-most edge (offsetX = +100) crops [0..200], right-most edge (offsetX = -100) crops [200..400]
  eq(computeInteractiveAvatarCropRect(400, 200, { zoom: 1, offsetX: 100, offsetY: 0 }, 200), {
    sx: 0,
    sy: 0,
    sw: 200,
    sh: 200,
  });
  eq(computeInteractiveAvatarCropRect(400, 200, { zoom: 1, offsetX: -100, offsetY: 0 }, 200), {
    sx: 200,
    sy: 0,
    sw: 200,
    sh: 200,
  });

  // Zooming 1x -> 2x scales offsets proportionally so the center pixel stays locked
  const zoomed = scaleAvatarCropTransformZoom(
    400,
    200,
    { zoom: 1, offsetX: 50, offsetY: 0, rotation: 0 },
    2,
    200
  );
  equal(zoomed.zoom, 2);
  equal(zoomed.offsetX, 100);
  equal(zoomed.offsetY, 0);
  equal(zoomed.rotation, 0);
  const zoomedRect = computeInteractiveAvatarCropRect(400, 200, zoomed, 200);
  equal(zoomedRect.sw, 100);
  equal(zoomedRect.sh, 100);
  // Center before zoom was x = 200 - 50 = 150; after zoom center must still be 150 -> sx = 100
  equal(zoomedRect.sx, 100);
  equal(zoomedRect.sy, 50);

  // Rotation normalization snaps & wraps angles cleanly into {0, 90, 180, 270}
  equal(normalizeAvatarCropRotation(-90), 270);
  equal(normalizeAvatarCropRotation(0), 0);
  equal(normalizeAvatarCropRotation(360), 0);
  equal(normalizeAvatarCropRotation(450), 90);

  // Rotating 400x200 by +90deg swaps effective bounding dimensions and pan bounds
  const rotated90Layout = computeAvatarCropLayout(
    400,
    200,
    { zoom: 1, offsetX: 0, offsetY: 0, rotation: 90 },
    200
  );
  equal(rotated90Layout.imgWidth, 400);
  equal(rotated90Layout.imgHeight, 200);
  equal(rotated90Layout.displayWidth, 200);
  equal(rotated90Layout.displayHeight, 400);
  equal(rotated90Layout.maxOffsetX, 0);
  equal(rotated90Layout.maxOffsetY, 100);

  // Rotating by +/-90deg rotates the pan offset vector so the centered source point stays locked
  const startTransform = { zoom: 1, offsetX: 50, offsetY: 0, rotation: 0 as const };
  const startRect = computeInteractiveAvatarCropRect(400, 200, startTransform, 200);
  eq(startRect, { sx: 50, sy: 0, sw: 200, sh: 200 });

  const cw90 = rotateAvatarCropTransform(400, 200, startTransform, 90, 200);
  eq(cw90, { zoom: 1, offsetX: 0, offsetY: 50, rotation: 90 });
  eq(computeInteractiveAvatarCropRect(400, 200, cw90, 200), startRect);

  const cw180 = rotateAvatarCropTransform(400, 200, cw90, 90, 200);
  eq(cw180, { zoom: 1, offsetX: -50, offsetY: 0, rotation: 180 });
  eq(computeInteractiveAvatarCropRect(400, 200, cw180, 200), startRect);

  const cw270 = rotateAvatarCropTransform(400, 200, cw180, 90, 200);
  eq(cw270, { zoom: 1, offsetX: 0, offsetY: -50, rotation: 270 });
  eq(computeInteractiveAvatarCropRect(400, 200, cw270, 200), startRect);

  const backTo0 = rotateAvatarCropTransform(400, 200, cw90, -90, 200);
  eq(backTo0, startTransform);
  eq(computeInteractiveAvatarCropRect(400, 200, backTo0, 200), startRect);

  // Zoom clamps cleanly to [MIN_ZOOM, MAX_ZOOM]
  equal(
    clampAvatarCropTransform(200, 200, { zoom: 0.2, offsetX: 0, offsetY: 0 }, AVATAR_CROP_VIEWPORT_PX).zoom,
    AVATAR_CROP_MIN_ZOOM
  );
  equal(
    clampAvatarCropTransform(200, 200, { zoom: 99, offsetX: 0, offsetY: 0 }, AVATAR_CROP_VIEWPORT_PX).zoom,
    AVATAR_CROP_MAX_ZOOM
  );
});

test('AvatarCropModal renders accessible native dialog, zoom slider, rotate buttons, and no raw title=', () => {
  equal(translate('zh-CN', 'avatarUploadBtn'), '上传头像');
  const html = renderSafe(
    React.createElement(AvatarCropModal, {
      imageSrc: SAMPLE_PNG_DATA_URL,
      resolvedLang: 'zh-CN',
      isDark: false,
      onClose: () => {},
      onChangePhoto: () => {},
      onConfirm: () => {},
    })
  );
  ok(html.includes('<dialog'), 'AvatarCropModal must use native <dialog>');
  ok(!html.includes('role="dialog"'), 'native <dialog> must not add redundant role="dialog"');
  ok(!html.includes('aria-modal='), 'native <dialog> must not add redundant aria-modal');
  ok(html.includes('type="range"'), 'AvatarCropModal must use native range slider for zoom');
  ok(html.includes('avatar-crop-stage'), 'AvatarCropModal must render draggable crop stage');
  ok(html.includes('aria-live="polite"'), 'AvatarCropModal must include live region for keyboard feedback');
  ok(html.includes(translate('zh-CN', 'avatarCropTitle')));
  ok(html.includes(translate('zh-CN', 'avatarCropApplyBtn')));
  ok(html.includes(translate('zh-CN', 'avatarCropChangePhoto')));
  ok(html.includes(translate('zh-CN', 'avatarCropRotateLeft')));
  ok(html.includes(translate('zh-CN', 'avatarCropRotateRight')));
  ok(html.includes('-90°'));
  ok(html.includes('+90°'));
  doesNotMatch(html, /\btitle="/, 'AvatarCropModal must not contain raw HTML title= attributes');
});
