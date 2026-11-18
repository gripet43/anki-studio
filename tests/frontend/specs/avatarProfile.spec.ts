// ============================================================================
// Profile Avatar validation, square crop math, SSR render & store contracts
// All tests are strictly synchronous per `tests/frontend/harness.ts`.
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, eq, equal, ok, doesNotMatch, throws } from '../harness';
import {
  AVATAR_IMAGE_ACCEPT,
  AVATAR_PRESET_IDS,
  AvatarImageError,
  computeSquareCoverCropRect,
  DEFAULT_CUSTOM_AVATAR,
  estimateDataUrlDecodedBytes,
  getAvatarInitial,
  isDefaultCustomAvatar,
  isSafeAvatarDataUrl,
  isSupportedSourceImageFile,
  MAX_AVATAR_OUTPUT_BYTES,
  normalizeCustomAvatarConfig,
} from '../../../frontend/src/utils/avatarImage';
import { UserAvatar } from '../../../frontend/src/components/common/UserAvatar';
import { Sidebar } from '../../../frontend/src/components/layout/Sidebar';
import { SettingsModal } from '../../../frontend/src/components/settings/SettingsModal';
import { DesignSystemView } from '../../../frontend/src/components/design-system/DesignSystemView';
import {
  appActions,
  getAppState,
  setAppState,
} from '../../../frontend/src/stores/useAppStore';
import { translate } from '../../../frontend/src/i18n/translations';

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
    ok(sidebarHtml.includes('data-open="true"'), 'Settings icon button should reflect settingsOpen state via data-open');
    ok(sidebarHtml.includes('aria-expanded="true"'), 'Settings icon button should expose aria-expanded');
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
