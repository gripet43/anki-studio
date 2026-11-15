// ============================================================================
// Day Rollover Helper & Store Transition Unit Tests
// ============================================================================

import { section, test, equal, ok } from '../harness';
import { getEffectiveDayKey, localDateKey } from '../../../frontend/src/utils/localDate';
import { EMPTY_DASHBOARD } from '../../../frontend/src/data/mockData';
import {
  appActions,
  getAppState,
  setAppState,
} from '../../../frontend/src/stores/useAppStore';

section('dayRollover · logical date & store invariants');

test('getEffectiveDayKey uses Anki logicalDate when dayBoundary is available', () => {
  const key = getEffectiveDayKey({
    available: true,
    logicalDate: '2026-11-15',
  });
  equal(key, '2026-11-15');
});

test('getEffectiveDayKey falls back to localDateKey when unavailable or malformed', () => {
  const sampleDate = new Date(2026, 10, 15, 2, 30, 0);
  const expected = localDateKey(sampleDate);
  equal(getEffectiveDayKey(null, sampleDate), expected);
  equal(getEffectiveDayKey({ available: false, logicalDate: '2026-11-14' }, sampleDate), expected);
  equal(getEffectiveDayKey({ available: true, logicalDate: 'bad-date' }, sampleDate), expected);
});

test('EMPTY_DASHBOARD provides unavailable dayBoundary default', () => {
  ok(EMPTY_DASHBOARD.dayBoundary);
  equal(EMPTY_DASHBOARD.dayBoundary?.available, false);
  equal(EMPTY_DASHBOARD.dayBoundary?.schedToday, 0);
});

test('startReview captures reviewSessionDayKey and exitReview clears rollover state', () => {
  const prevState = getAppState();
  try {
    setAppState({
      dayBoundary: {
        available: true,
        schedToday: 888,
        dayCutoff: 1_900_000_000,
        dayStartSec: 1_899_913_600,
        logicalDate: '2026-11-15',
        rolloverHour: 4,
        serverNow: 1_899_950_000,
      },
      pendingDayRollover: {
        fromSchedToday: 887,
        toSchedToday: 888,
        logicalDate: '2026-11-15',
        detectedAtMs: 12345,
      },
      decks: [
        {
          id: '1',
          name: 'Default',
          fullName: 'Default',
          depth: 0,
          dueNew: 0,
          dueReview: 0,
          totalCards: 0,
          progress: 0,
          lastStudied: '',
          masteryScore: 0,
          color: '#3B82F6',
        },
      ],
      libraryCards: [],
    });

    void appActions.startReview('1');
    const started = getAppState();
    equal(started.inReviewMode, true);
    equal(started.reviewSessionDayKey, 888);
    equal(started.pendingDayRollover, null);

    appActions.exitReview();
    const exited = getAppState();
    equal(exited.inReviewMode, false);
    equal(exited.reviewSessionDayKey, null);
    equal(exited.pendingDayRollover, null);
  } finally {
    setAppState(prevState);
  }
});
