import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, equal, eq, ok, doesNotMatch } from '../harness';
import type { DeckItem, ReviewCardItem } from '../../../frontend/src/bridge/pycmd';
import { App } from '../../../frontend/src/App';
import { DashboardView } from '../../../frontend/src/components/dashboard/DashboardView';
import { ZenHomeView } from '../../../frontend/src/components/zen/ZenHomeView';
import {
  resolveIncenseFrameIntervalMs,
  resolveReviewIncenseVisibility,
  resolveReviewIncenseX,
} from '../../../frontend/src/components/zen/ZenIncenseCanvas';
import { ZenReviewView } from '../../../frontend/src/components/zen/ZenReviewView';
import { ZenThresholdOverlay } from '../../../frontend/src/components/zen/ZenThresholdOverlay';
import { dict as arDict } from '../../../frontend/src/i18n/locales/ar';
import { dict as deDict } from '../../../frontend/src/i18n/locales/de';
import { dict as jaDict } from '../../../frontend/src/i18n/locales/ja';
import { dict as koDict } from '../../../frontend/src/i18n/locales/ko';
import { translate } from '../../../frontend/src/i18n/translations';
import { appActions, getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';
import {
  getZenAmbienceVolume,
  getZenSfxVolume,
  playZenCompleteBell,
  playZenEnterBell,
  playZenIncenseIgnite,
  playZenPaperTouch,
  playZenStartDrum,
  setZenAmbienceDucked,
  setZenAmbienceScene,
  setZenAmbienceVolume,
  setZenSfxVolume,
  stopZenAmbience,
} from '../../../frontend/src/utils/zenAudio';
import {
  formatZenIncenseRemaining,
  isZenBlockedGlobalShortcut,
  resolveZenCompleteSubKey,
  resolveZenHomeState,
  resolveZenIncenseCopy,
  resolveZenPeriodLabel,
  resolveZenTimePeriod,
  selectZenPendingDecks,
} from '../../../frontend/src/utils/zenMode';

function makeDeck(overrides: Partial<DeckItem> & { id: string; name: string }): DeckItem {
  return {
    fullName: overrides.name,
    depth: 0,
    isChild: false,
    childrenCount: 0,
    dueNew: 0,
    dueReview: 0,
    totalCards: 100,
    mastery: 62,
    accent: 'indigo',
    ...overrides,
  };
}

function makeCard(overrides?: Partial<ReviewCardItem>): ReviewCardItem {
  return {
    id: '9001',
    noteId: '9001',
    deckId: '1',
    deckName: '考研英语',
    fullDeckName: '考研英语',
    front: 'Serendipity',
    meaning: '意外发现珍奇事物的运气',
    frontHtml: '<p>Serendipity</p>',
    backHtml: '<p>意外发现珍奇事物的运气</p>',
    cardType: 'review',
    reps: 14,
    lapses: 2,
    interval: 12,
    difficulty: 0.4,
    stability: 12,
    flags: 3,
    tags: ['gre-core', 'vocab-unit2'],
    predictions: {
      again: '10 分钟后',
      hard: '4 天后',
      good: '12 天后',
      easy: '1.8 个月后',
    },
    ...overrides,
  };
}

section('zenMode pure logic', () => {
  test('selectZenPendingDecks strips numeric counts and prefers pending top-level decks', () => {
    const decks = [
      makeDeck({ id: '1', name: '考研英语', dueNew: 17, dueReview: 42 }),
      makeDeck({ id: '2', name: '已学完牌组', dueNew: 0, dueReview: 0 }),
      makeDeck({ id: '3', name: '子牌组', isChild: true, depth: 1, dueNew: 5, dueReview: 8 }),
      makeDeck({ id: '4', name: '政治理论', dueNew: 0, dueReview: 29 }),
    ];
    const picked = selectZenPendingDecks(decks);
    eq(picked, [
      { id: '1', name: '考研英语' },
      { id: '4', name: '政治理论' },
    ]);
    ok(!('dueNew' in picked[0]), 'ZenDeckEntry must not expose dueNew');
    ok(!('dueReview' in picked[0]), 'ZenDeckEntry must not expose dueReview');
    ok(!('mastery' in picked[0]), 'ZenDeckEntry must not expose mastery');
  });

  test('selectZenPendingDecks falls back to pending child decks if top-level rows report 0', () => {
    const decks = [
      makeDeck({ id: '1', name: '父牌组', dueNew: 0, dueReview: 0, childrenCount: 1 }),
      makeDeck({ id: '2', name: '父牌组::高频词', isChild: true, depth: 1, dueNew: 3, dueReview: 6 }),
    ];
    eq(selectZenPendingDecks(decks), [{ id: '2', name: '父牌组::高频词' }]);
  });

  test('resolveZenHomeState resolves all 5 deterministic states', () => {
    equal(
      resolveZenHomeState({
        isSyncPending: true,
        isVacationActive: true,
        totalPending: 10,
        pendingDecksCount: 1,
        hasAnyDecks: true,
      }),
      'syncing'
    );
    equal(
      resolveZenHomeState({
        isSyncPending: false,
        isVacationActive: true,
        totalPending: 10,
        pendingDecksCount: 1,
        hasAnyDecks: true,
      }),
      'vacation'
    );
    equal(
      resolveZenHomeState({
        isSyncPending: false,
        isVacationActive: false,
        totalPending: 5,
        pendingDecksCount: 1,
        hasAnyDecks: true,
      }),
      'ready'
    );
    equal(
      resolveZenHomeState({
        isSyncPending: false,
        isVacationActive: false,
        totalPending: 0,
        pendingDecksCount: 0,
        hasAnyDecks: true,
      }),
      'all-done'
    );
    equal(
      resolveZenHomeState({
        isSyncPending: false,
        isVacationActive: false,
        totalPending: 0,
        pendingDecksCount: 0,
        hasAnyDecks: false,
      }),
      'empty'
    );
  });

  test('isZenBlockedGlobalShortcut blocks divergent workspace shortcuts while keeping escape hatches', () => {
    const base = { metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
    ok(isZenBlockedGlobalShortcut('k', { ...base, metaKey: true }), 'blocks Cmd+K');
    ok(isZenBlockedGlobalShortcut(',', { ...base, metaKey: true }), 'blocks Cmd+,');
    ok(isZenBlockedGlobalShortcut('p', { ...base, ctrlKey: true }), 'blocks Ctrl+P');
    ok(isZenBlockedGlobalShortcut('n', base), 'blocks N');
    ok(isZenBlockedGlobalShortcut('d', { ...base, ctrlKey: true, shiftKey: true }), 'blocks Ctrl+Shift+D');

    ok(!isZenBlockedGlobalShortcut('m', { ...base, ctrlKey: true, altKey: true }), 'preserves Ctrl+Alt+M');
    ok(!isZenBlockedGlobalShortcut('z', { ...base, metaKey: true, shiftKey: true }), 'preserves Cmd+Shift+Z');
    ok(!isZenBlockedGlobalShortcut('y', base), 'preserves silent Y sync');
  });

  test('resolveZenTimePeriod, resolveZenCompleteSubKey, and zenAudio v2 are deterministic and SSR-safe', () => {
    equal(resolveZenTimePeriod(7), 'morning');
    equal(resolveZenTimePeriod(14), 'afternoon');
    equal(resolveZenTimePeriod(17), 'evening');
    equal(resolveZenTimePeriod(19), 'evening');
    equal(resolveZenTimePeriod(23), 'night');
    equal(resolveZenTimePeriod(2), 'night');

    equal(resolveZenPeriodLabel(7, 'zh-CN', ''), '晨 读');
    equal(resolveZenPeriodLabel(10, 'zh-CN', ''), '清 昼');
    equal(resolveZenPeriodLabel(12, 'zh-CN', ''), '午 静');
    equal(resolveZenPeriodLabel(15, 'zh-CN', ''), '午 后');
    equal(resolveZenPeriodLabel(17, 'zh-CN', ''), '暮 沉');
    equal(resolveZenPeriodLabel(20, 'zh-CN', ''), '灯 影');
    equal(resolveZenPeriodLabel(23, 'zh-CN', ''), '夜 禅');
    equal(resolveZenPeriodLabel(2, 'zh-CN', ''), '深 宵');

    equal(resolveZenCompleteSubKey('morning'), 'zenAllDoneSubMorning');
    equal(resolveZenCompleteSubKey('afternoon'), 'zenAllDoneSubAfternoon');
    equal(resolveZenCompleteSubKey('evening'), 'zenAllDoneSubEvening');
    equal(resolveZenCompleteSubKey('night'), 'zenAllDoneSubNight');

    equal(formatZenIncenseRemaining(15 * 60_000, 'zh-CN'), '余十五分');
    equal(formatZenIncenseRemaining(9 * 60_000, 'zh-CN'), '余九分');
    equal(formatZenIncenseRemaining(30_000, 'zh-CN'), '将尽');
    equal(formatZenIncenseRemaining(0, 'zh-CN'), '香已尽');
    equal(formatZenIncenseRemaining(9 * 60_000, 'en'), '9 min left');
    equal(jaDict.zenIncenseMinsLeft, '残り{n}分');
    equal(resolveZenIncenseCopy('zh-CN').doneTitle, '一炷香尽');
    equal(resolveZenIncenseCopy('zh-CN').relightBtn, '再续一炷');
    equal(resolveZenIncenseCopy('zh-CN').restBtn, '歇息');
    equal(resolveZenIncenseCopy('en').doneTitle, 'Incense finished');
    // 16-language incense copy coverage (spot-check non-CJK/non-EN and CJK locales)
    for (const [label, table] of [
      ['de', deDict],
      ['ja', jaDict],
      ['ko', koDict],
      ['ar', arDict],
    ] as const) {
      ok(table.zenIncenseDoneTitle && table.zenIncenseDoneTitle !== 'Incense finished', `${label} localized doneTitle`);
      ok(table.zenIncenseMinsLeft.includes('{n}'), `${label} minsLeft placeholder`);
      ok(table.zenIncenseRelightBtn && table.zenIncenseRestBtn && table.zenIncensePaused, `${label} localized incense controls`);
    }

    // Review incense anti-overlap visibility & horizontal margin placement (#11)
    equal(resolveReviewIncenseVisibility(60), 0, 'hides incense on tight half-screen / wide-card margins');
    equal(resolveReviewIncenseVisibility(88), 0, 'hidden at lower ramp threshold');
    ok(resolveReviewIncenseVisibility(102) > 0 && resolveReviewIncenseVisibility(102) < 1, 'smoothly ramps visibility');
    equal(resolveReviewIncenseVisibility(120), 1, 'fully visible with comfortable desk margin');
    equal(resolveReviewIncenseX(1200, 200, false), 1200 - 96, 'LTR anchors inside desk margin');
    equal(resolveReviewIncenseX(1200, 120, false), 1200 - 58, 'LTR centers inside narrower margin clear of card');
    equal(resolveReviewIncenseX(1200, 120, true), 58, 'RTL mirrors inside desk margin');

    // Low-power laptop RAF throttling & suspension (#12)
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'review',
        hidden: true,
        windowFocused: true,
        isIdle: false,
        isGliding: false,
        isFullyExtinguished: false,
      }),
      null,
      'suspends RAF completely when document is hidden'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'review',
        hidden: false,
        windowFocused: true,
        isIdle: false,
        isGliding: false,
        isFullyExtinguished: true,
      }),
      null,
      'suspends RAF completely once review incense is fully extinguished'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'ritual',
        hidden: false,
        windowFocused: false,
        isIdle: true,
        isGliding: false,
        isFullyExtinguished: false,
      }),
      0,
      'never throttles interactive incense ritual'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'ambient',
        hidden: false,
        windowFocused: false,
        isIdle: false,
        isGliding: true,
        isFullyExtinguished: false,
      }),
      0,
      'never throttles Home->Review incense glide'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'review',
        hidden: false,
        windowFocused: false,
        isIdle: false,
        isGliding: false,
        isFullyExtinguished: false,
      }),
      66,
      'throttles to ~15fps when unfocused'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'ambient',
        hidden: false,
        windowFocused: true,
        isIdle: true,
        isGliding: false,
        isFullyExtinguished: false,
      }),
      66,
      'throttles to ~15fps when idle >= 90s'
    );
    equal(
      resolveIncenseFrameIntervalMs({
        mode: 'review',
        hidden: false,
        windowFocused: true,
        isIdle: false,
        isGliding: false,
        isFullyExtinguished: false,
      }),
      0,
      'runs full refresh rate during active focused studying'
    );

    // Node SSR environment lacks AudioContext — all acoustic & ambience APIs must fail softly without throwing
    equal(playZenIncenseIgnite(true), false);
    equal(playZenEnterBell(true), false);
    equal(playZenStartDrum(true), false);
    equal(playZenStartDrum(false), false);
    equal(playZenCompleteBell(true), false);
    equal(playZenPaperTouch(true, 'flip'), false);
    equal(playZenPaperTouch(true, 'settle'), false);
    equal(playZenEnterBell(false), false);
    equal(getZenSfxVolume(), 0.5, 'Default Zen SFX volume must be 50%');
    equal(getZenAmbienceVolume(), 0.5, 'Default Zen ambience volume must be 50%');
    setZenSfxVolume(0.75);
    setZenAmbienceVolume(0.35);
    equal(getZenSfxVolume(), 0.75);
    equal(getZenAmbienceVolume(), 0.35);
    setZenSfxVolume(0.5);
    setZenAmbienceVolume(0.5);
    equal(setZenAmbienceScene('silent', true), false);
    equal(setZenAmbienceScene('rain', true), false);
    stopZenAmbience(0.1);
    setZenAmbienceDucked(true, 0);
    setZenAmbienceDucked(false, 0);
  });
});

section('zenMode store lifecycle', () => {
  test('enterZenMode closes workspace modals, remembers return tab, and exitZenMode restores cleanly', () => {
    const snapshot = getAppState();
    try {
      setAppState({
        zenMode: false,
        activeTab: 'stats',
        inReviewMode: false,
        cmdKOpen: true,
        quickAddOpen: true,
        settingsOpen: true,
        vacationModalOpen: true,
        icuModalOpen: true,
        customStudyModalOpen: true,
      });

      appActions.enterZenMode();
      const entered = getAppState();
      equal(entered.zenMode, true);
      equal(entered.zenThresholdVisible, true);
      equal(entered.zenAmbience, 'silent', 'Zen Mode must default strictly to silent ambience');
      equal(entered.zenReturnTab, 'stats');
      equal(entered.cmdKOpen, false);
      equal(entered.quickAddOpen, false);
      equal(entered.settingsOpen, false);
      equal(entered.vacationModalOpen, false);
      equal(entered.icuModalOpen, false);
      equal(entered.customStudyModalOpen, false);

      appActions.dismissZenThreshold();
      equal(getAppState().zenThresholdVisible, false);

      equal(getAppState().zenSfxVolume, 0.5, 'Zen SFX volume defaults to 50%');
      equal(getAppState().zenAmbienceVolume, 0.5, 'Zen ambience volume defaults to 50%');
      appActions.setZenSfxVolume(0.8);
      equal(getAppState().zenSfxVolume, 0.8);
      equal(getAppState().zenSoundEnabled, true);

      appActions.setZenSfxVolume(0);
      equal(getAppState().zenSfxVolume, 0);
      equal(getAppState().zenSoundEnabled, false);

      appActions.toggleZenSound();
      equal(getAppState().zenSoundEnabled, true);
      equal(getAppState().zenSfxVolume, 0.5, 'Unmuting SFX from 0% restores 50% default volume');

      appActions.toggleZenSound();
      equal(getAppState().zenSoundEnabled, false);

      // Ambience channel is independent from SFX toggle
      appActions.setZenAmbience('rain');
      equal(getAppState().zenAmbience, 'rain');
      equal(getAppState().zenSoundEnabled, false, 'Enabling ambience keeps SFX toggle independent');
      appActions.setZenAmbienceVolume(0.3);
      equal(getAppState().zenAmbienceVolume, 0.3);

      appActions.setZenAmbience('silent');
      equal(getAppState().zenAmbience, 'silent');

      appActions.setZenAmbience('wind');
      equal(getAppState().zenAmbience, 'wind');

      appActions.exitZenMode();
      const exited = getAppState();
      equal(exited.zenMode, false);
      equal(exited.zenAmbience, 'wind', 'Exiting Zen Mode must preserve user ambience preference');
      equal(exited.zenAmbienceVolume, 0.3, 'Exiting Zen Mode must preserve ambience volume');
      equal(exited.zenSoundEnabled, false, 'Exiting Zen Mode must preserve SFX toggle');
      equal(exited.zenThresholdVisible, false);
      equal(exited.activeTab, 'stats');

      // Re-entering Zen Mode keeps the saved audio & ambience preferences intact
      appActions.enterZenMode();
      const reentered = getAppState();
      equal(reentered.zenAmbience, 'wind', 'Re-entering Zen Mode preserves saved ambience');
      equal(reentered.zenAmbienceVolume, 0.3, 'Re-entering Zen Mode preserves saved ambience volume');
      equal(reentered.zenSoundEnabled, false, 'Re-entering Zen Mode preserves saved SFX toggle');
      appActions.exitZenMode();
    } finally {
      setAppState(snapshot);
    }
  });

  test('mid-review Zen entry skips threshold and exits back to standard Reviewer; courtyard-started Zen review exits to Dashboard', () => {
    const snapshot = getAppState();
    try {
      const card = makeCard();
      // Flow A: Entered Zen Mode directly from an active standard review session
      setAppState({
        zenMode: false,
        activeTab: 'stats',
        inReviewMode: true,
        isSessionComplete: false,
        reviewQueue: [card],
        currentCardIndex: 0,
      });

      appActions.enterZenMode();
      equal(getAppState().zenMode, true);
      equal(getAppState().inReviewMode, true);
      equal(getAppState().zenEnteredFromReview, true);
      equal(
        getAppState().zenThresholdVisible,
        false,
        'Entering Zen Mode mid-review must skip the courtyard incense threshold overlay'
      );

      // Exiting Zen Mode mid-review returns seamlessly to the exact same card in standard Reviewer
      appActions.exitZenMode();
      equal(getAppState().zenMode, false);
      equal(getAppState().inReviewMode, true, 'Mid-review exit must keep standard Reviewer open on current card');
      equal(getAppState().zenEnteredFromReview, false);
      equal(getAppState().currentCardIndex, 0);

      // Flow B: Started review from Zen courtyard (zenEnteredFromReview = false) -> exiting Zen closes review to Dashboard
      setAppState({
        zenMode: true,
        zenEnteredFromReview: false,
        activeTab: 'stats',
        inReviewMode: true,
        isSessionComplete: false,
        reviewQueue: [card],
        currentCardIndex: 0,
      });
      appActions.exitZenMode();
      equal(getAppState().zenMode, false);
      equal(getAppState().inReviewMode, false);
      equal(getAppState().activeTab, 'dashboard');

      // Completion exit always closes both Zen Mode and Review cleanly to Dashboard home
      setAppState({
        zenMode: true,
        zenEnteredFromReview: true,
        activeTab: 'stats',
        inReviewMode: true,
        isSessionComplete: true,
      });
      appActions.exitZenMode();
      equal(getAppState().zenMode, false);
      equal(getAppState().inReviewMode, false);
      equal(getAppState().activeTab, 'dashboard');
    } finally {
      setAppState(snapshot);
    }
  });

  test('answering, flipping, and undoing cards in Zen Mode stay quiet with zero SaaS toast clutter', () => {
    const snapshot = getAppState();
    try {
      const card = makeCard();
      setAppState({
        zenMode: true,
        inReviewMode: true,
        isSessionComplete: false,
        isCardFlipped: false,
        reviewQueue: [card],
        currentCardIndex: 0,
        undoStack: [],
        toastMessage: null,
      });
      // Flipping in Zen Mode stays silent without toast
      appActions.flipCard();
      equal(getAppState().isCardFlipped, true);
      equal(getAppState().toastMessage, null);

      // Empty undo stack in Zen Mode stays silent
      void appActions.undoLastReview();
      equal(getAppState().toastMessage, null, 'Empty undo in Zen Mode must not pop a black toast');

      // Non-native env path runs synchronously up to setAppState & silent Zen return
      void appActions.answerCurrentCard(3);
      equal(getAppState().toastMessage, null, 'Zen Mode must not toast FSRS interval after rating');

      // Undoing the answered card in Zen Mode restores silently without toast
      void appActions.undoLastReview();
      equal(getAppState().toastMessage, null, 'Undoing a card in Zen Mode must stay quiet without toast');
    } finally {
      setAppState(snapshot);
    }
  });
});

section('zenMode SSR rendering invariants', () => {
  test('DashboardView places single Zen Mode trigger in the hero action bar and hides low-energy entry', () => {
    const snapshot = getAppState();
    try {
      setAppState({
        resolvedLang: 'zh-CN',
        isInitialSyncing: false,
        syncing: false,
        zenMode: false,
      });
      const html = renderToStaticMarkup(React.createElement(DashboardView));
      const zenIdx = html.indexOf('data-zen-trigger="dashboard"');
      const syncIdx = html.indexOf('sync-pill-forced-border');
      ok(zenIdx > 0, 'DashboardView must render Zen Mode entry trigger');
      ok(syncIdx > 0, 'DashboardView must render SyncStatusPill');
      ok(zenIdx > syncIdx, 'Zen Mode trigger must sit inside the hero action bar after header');
      ok(!html.includes(translate('zh-CN', 'lowEnergyBtn')), 'Low-energy review button must be hidden');
    } finally {
      setAppState(snapshot);
    }
  });

  test('ZenHomeView shows zero pending numbers in ready state and soft exit prompt in all-done state', () => {
    const snapshot = getAppState();
    try {
      const decks = [
        makeDeck({ id: '1', name: '考研英语', dueNew: 17, dueReview: 42, totalCards: 888, mastery: 73 }),
        makeDeck({ id: '2', name: '政治理论', dueNew: 9, dueReview: 31, totalCards: 512, mastery: 41 }),
      ];
      setAppState({
        resolvedLang: 'zh-CN',
        accentColor: 'indigo',
        isInitialSyncing: false,
        syncing: false,
        zenMode: true,
        inReviewMode: false,
        decks,
        dashboard: {
          ...snapshot.dashboard,
          greeting: '晚上好',
          vacation: { isActive: false, remainingDays: 0 },
          todayStats: { ...snapshot.dashboard.todayStats, totalPending: 99, dueNew: 26, dueReview: 73 },
        },
      });

      const readyHtml = renderToStaticMarkup(React.createElement(ZenHomeView));
      const expectedPeriod = resolveZenTimePeriod(new Date().getHours());
      const expectedCompleteSub = translate('zh-CN', resolveZenCompleteSubKey(expectedPeriod));
      ok(readyHtml.includes(`data-zen-period="${expectedPeriod}"`), 'ZenHomeView exposes circadian period attribute');
      ok(readyHtml.includes('zen-enso-trigger'), 'ZenHomeView renders ceremonial Ensō start trigger');
      ok(readyHtml.includes(translate('zh-CN', 'zenBeginSeal')), 'ZenHomeView renders Ensō center seal label');
      ok(readyHtml.includes(translate('zh-CN', 'zenStartBtn')), 'ZenHomeView preserves accessible start label');
      ok(readyHtml.includes('zen-sound-toggle'), 'ZenHomeView renders subtle Zen sound control');
      ok(readyHtml.includes('data-zen-incense="ambient"'), 'ZenHomeView renders whisper-faint ambient incense canvas');
      ok(readyHtml.includes('data-zen-ambience-active="silent"'), 'ZenHomeView starts with silent ambience');
      ok(readyHtml.includes('考研英语') && readyHtml.includes('政治理论'), 'ZenHomeView lists bare pending deck names');
      for (const forbidden of ['17', '42', '59', '99', '73%', '41%', '888', '512']) {
        ok(!readyHtml.includes(forbidden), `ZenHomeView must not display numeric count/stat: ${forbidden}`);
      }
      ok(!readyHtml.includes('sync-pill-forced-border'), 'ZenHomeView must not render SyncStatusPill');
      doesNotMatch(readyHtml, /\btitle="/, 'ZenHomeView must not contain raw title= attributes');

      // Interactive incense ceremony renders awaiting chamber, unlit incense canvas, & prompt (cannot be skipped)
      setAppState({ zenThresholdVisible: true });
      const thresholdHtml = renderToStaticMarkup(React.createElement(ZenThresholdOverlay));
      ok(thresholdHtml.includes('data-zen-threshold="awaiting"'), 'Incense ceremony starts awaiting user touch');
      ok(thresholdHtml.includes('data-zen-incense="ritual"'), 'Incense ceremony mounts ritual fluid smoke canvas');
      ok(thresholdHtml.includes('data-zen-incense-lit="false"'), 'Incense starts unlit until user lights it');
      ok(thresholdHtml.includes(translate('zh-CN', 'zenIncensePrompt')));
      ok(!thresholdHtml.includes('data-zen-threshold-skip'), 'Incense ceremony must not render a skip button');
      setAppState({ zenThresholdVisible: false });
      equal(renderToStaticMarkup(React.createElement(ZenThresholdOverlay)), '');

      // All-done state
      setAppState({
        decks: [makeDeck({ id: '1', name: '考研英语', dueNew: 0, dueReview: 0 })],
        dashboard: {
          ...snapshot.dashboard,
          greeting: '晚上好',
          vacation: { isActive: false, remainingDays: 0 },
          todayStats: { ...snapshot.dashboard.todayStats, totalPending: 0, dueNew: 0, dueReview: 0 },
        },
      });
      const doneHtml = renderToStaticMarkup(React.createElement(ZenHomeView));
      ok(doneHtml.includes(translate('zh-CN', 'zenAllDoneTitle')));
      ok(doneHtml.includes(expectedCompleteSub));
      ok(doneHtml.includes('zen-enso-ink--closed'), 'ZenHomeView complete renders raster closed Ensō');
      ok(doneHtml.includes('zen-seal-stamp'), 'ZenHomeView complete renders raster vermilion hanko seal');
      ok(doneHtml.includes(translate('zh-CN', 'zenExitBtn')));
      ok(doneHtml.includes('role="status"'));
    } finally {
      setAppState(snapshot);
    }
  });

  test('ZenReviewView hides FSRS intervals, badges, counts, and stats across review and complete screens', () => {
    const snapshot = getAppState();
    try {
      const card = makeCard();
      setAppState({
        resolvedLang: 'zh-CN',
        accentColor: 'indigo',
        zenMode: true,
        inReviewMode: true,
        isSessionComplete: false,
        isCardFlipped: true,
        answerButtonMode: 'four',
        reviewQueue: [card],
        currentCardIndex: 0,
        sessionStudiedCount: 23,
        sessionCorrectCount: 19,
        reviewScopeDeckId: 'all',
        dashboard: {
          ...snapshot.dashboard,
          todayStats: { ...snapshot.dashboard.todayStats, totalPending: 0 },
        },
      });

      const reviewHtml = renderToStaticMarkup(React.createElement(ZenReviewView));
      ok(reviewHtml.includes('data-intro-visible="true"'), 'ZenReviewView starts with 3s onboarding top controls visible');
      ok(
        reviewHtml.includes(translate('zh-CN', 'zenReturnHomeBtn')),
        'ZenReviewView top hoverbar must expose Back to Zen Home button for deck switching'
      );
      ok(reviewHtml.includes('data-zen-incense="review"'), 'ZenReviewView renders the 15-minute review incense timekeeper');
      ok(reviewHtml.includes('data-zen-incense-duration="900000"'), 'ZenReviewView sets fixed 15-minute incense burn duration');
      ok(reviewHtml.includes('Serendipity'), 'renders card front');
      ok(reviewHtml.includes('意外发现珍奇事物的运气'), 'renders card back');
      ok(reviewHtml.includes(translate('zh-CN', 'rateAgain')));
      ok(reviewHtml.includes(translate('zh-CN', 'rateHard')));
      ok(reviewHtml.includes(translate('zh-CN', 'rateGood')));
      ok(reviewHtml.includes(translate('zh-CN', 'rateEasy')));
      // Must NOT render any FSRS interval predictions, badges, tags, reps, progress, or accuracy
      for (const forbidden of [
        '10 分钟',
        '4 天',
        '12 天',
        '1.8 个月',
        'gre-core',
        'vocab-unit2',
        '1 / 24',
        '<progress',
        '83%',
        translate('zh-CN', 'questionSideBadge'),
        translate('zh-CN', 'answerSideBadge'),
        translate('zh-CN', 'recallPrompt'),
        translate('zh-CN', 'sessionAccuracyLabel'),
      ]) {
        ok(!reviewHtml.includes(forbidden), `ZenReviewView must not display: ${forbidden}`);
      }
      doesNotMatch(reviewHtml, /\btitle="/, 'ZenReviewView must not contain raw title= attributes');

      // Binary mode: Good button keeps semantic success class
      setAppState({ answerButtonMode: 'binary', optionKeyHeld: false });
      const binaryHtml = renderToStaticMarkup(React.createElement(ZenReviewView));
      ok(binaryHtml.includes('zen-rate-btn--success'), 'Binary Good button uses semantic success class');
      ok(!binaryHtml.includes('12 天'), 'Binary mode omits FSRS intervals');

      // Global compatMode renders card via SandboxCardFrame even when legacy sandboxNoteTypeIds is empty
      const sandboxCard = makeCard({
        notetypeId: 'nt-global-compat',
        needsSandbox: false,
        sandboxFrontHtml: '<div class="custom-card">Serendipity</div>',
        sandboxBackHtml: '<div class="custom-card">Answer</div>',
      });
      setAppState({
        compatMode: true,
        sandboxNoteTypeIds: [],
        reviewQueue: [sandboxCard],
        currentCardIndex: 0,
      });
      const compatHtml = renderToStaticMarkup(React.createElement(ZenReviewView));
      ok(compatHtml.includes('<iframe'), 'ZenReviewView must honor global compatMode via SandboxCardFrame');
      setAppState({ compatMode: false, reviewQueue: [card] });

      // Completion screen: zero numeric stats + circadian soft exit prompt + carved seal + exit Zen button
      setAppState({ isSessionComplete: true, reviewQueue: [] });
      const completeHtml = renderToStaticMarkup(React.createElement(ZenReviewView));
      const expectedPeriod = resolveZenTimePeriod(new Date().getHours());
      const expectedCompleteSub = translate('zh-CN', resolveZenCompleteSubKey(expectedPeriod));
      ok(completeHtml.includes(translate('zh-CN', 'zenAllDoneTitle')));
      ok(completeHtml.includes(expectedCompleteSub));
      ok(completeHtml.includes('zen-enso-ink--closed'), 'Zen complete renders raster closed Ensō');
      ok(completeHtml.includes('zen-seal-stamp'), 'Zen complete renders raster vermilion hanko seal');
      ok(completeHtml.includes(translate('zh-CN', 'zenExitBtn')));
      ok(!completeHtml.includes('reviewer-complete-stats'), 'Zen complete must omit numeric 3-card stats');
      ok(!completeHtml.includes('83%'), 'Zen complete must omit accuracy percent');
      ok(!completeHtml.includes('<progress'), 'Zen complete must omit progress bar');
    } finally {
      setAppState(snapshot);
    }
  });

  test('App renders strictly two-page Zen shell without Sidebar when zenMode is active', () => {
    const snapshot = getAppState();
    try {
      setAppState({
        resolvedLang: 'zh-CN',
        isInitialSyncing: false,
        syncing: false,
        zenMode: true,
        inReviewMode: false,
        decks: [makeDeck({ id: '1', name: '考研英语', dueNew: 4, dueReview: 8 })],
        dashboard: {
          ...snapshot.dashboard,
          greeting: '早上好',
          todayStats: { ...snapshot.dashboard.todayStats, totalPending: 12, dueNew: 4, dueReview: 8 },
        },
      });
      const zenAppHtml = renderToStaticMarkup(React.createElement(App));
      ok(zenAppHtml.includes('data-zen-mode="true"'));
      ok(zenAppHtml.includes('data-zen-view="home"'));
      ok(!zenAppHtml.includes('sidebar-footer-toolbar'), 'Sidebar must not mount in Zen Mode');
      ok(!zenAppHtml.includes('cmdPaletteAriaLabel'), 'Workspace search must not mount in Zen Mode');
    } finally {
      setAppState(snapshot);
    }
  });
});
