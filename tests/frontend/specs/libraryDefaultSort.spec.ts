// ============================================================================
// Library default sort ('newest') store, helper, and render contracts
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { section, test, eq, equal, ok, doesNotMatch } from '../harness';
import {
  appActions,
  createEmptyLibraryState,
  DEFAULT_LIBRARY_SORT,
  getAppState,
  setAppState,
  type LibraryCardItem,
} from '../../../frontend/src/stores/useAppStore';
import {
  getNextTableSort,
  hasActiveLibraryFilters,
  LIBRARY_SORT_OPTIONS,
  LibraryView,
  sortLibraryCards,
} from '../../../frontend/src/components/search/LibraryView';
import { translate } from '../../../frontend/src/i18n/translations';

function makeCard(
  id: string,
  overrides: Partial<LibraryCardItem> = {}
): LibraryCardItem {
  return {
    id,
    noteId: `n-${id}`,
    deckId: '1',
    deckName: 'Default',
    front: `Front ${id}`,
    back: `Back ${id}`,
    tags: [],
    mastery: 50,
    stability: 5,
    difficultyLevel: 'medium',
    dueText: 'Due Today',
    dueRaw: 10,
    status: 'due',
    suspended: false,
    flags: 0,
    reps: 1,
    lapses: 0,
    intervalDays: 1,
    ...overrides,
  };
}

section('library · default sort order (newest)');

test('store defaults and profile reset state set librarySortBy to newest', () => {
  equal(DEFAULT_LIBRARY_SORT, 'newest');
  equal(getAppState().librarySortBy, 'newest');
  equal(createEmptyLibraryState().librarySortBy, 'newest');
});

test('hasActiveLibraryFilters ignores default newest sort and flags overrides or filters', () => {
  const clean = hasActiveLibraryFilters({
    filterStatus: 'all',
    filterDifficulty: 'all',
    filterFlag: 'all',
    filterTag: 'all',
    filterDeckId: 'all',
    librarySearchQuery: '',
    librarySortBy: 'newest',
  });
  equal(clean.hasNarrowingFilter, false);
  equal(clean.hasActiveFilters, false);

  for (const overrideSort of ['lapses_desc', 'due_asc', 'front_asc', 'default'] as const) {
    const withSort = hasActiveLibraryFilters({
      filterStatus: 'all',
      filterDifficulty: 'all',
      filterFlag: 'all',
      filterTag: 'all',
      filterDeckId: 'all',
      librarySearchQuery: '',
      librarySortBy: overrideSort,
    });
    equal(withSort.hasNarrowingFilter, false, `${overrideSort} is not a narrowing filter`);
    equal(withSort.hasActiveFilters, true, `${overrideSort} should trigger Reset`);
  }

  const withQuery = hasActiveLibraryFilters({
    filterStatus: 'all',
    filterDifficulty: 'all',
    filterFlag: 'all',
    filterTag: 'all',
    filterDeckId: 'all',
    librarySearchQuery: 'algo',
    librarySortBy: 'newest',
  });
  equal(withQuery.hasNarrowingFilter, true);
  equal(withQuery.hasActiveFilters, true);
});

test('appActions.resetLibraryFilters restores librarySortBy to newest and clears filters', () => {
  const prev = getAppState();
  const snapshot = {
    librarySearchQuery: prev.librarySearchQuery,
    filterStatus: prev.filterStatus,
    filterDifficulty: prev.filterDifficulty,
    filterFlag: prev.filterFlag,
    filterTag: prev.filterTag,
    filterDeckId: prev.filterDeckId,
    librarySortBy: prev.librarySortBy,
    libraryVisibleCount: prev.libraryVisibleCount,
  };

  try {
    appActions.searchLibraryDebounced({
      query: 'dp',
      status: 'due',
      difficulty: 'high',
      flag: '1',
      tag: 'algo',
      deckId: '1',
      sortBy: 'due_asc',
    });
    equal(getAppState().librarySortBy, 'due_asc');

    appActions.resetLibraryFilters();
    const reset = getAppState();
    equal(reset.librarySortBy, 'newest');
    equal(reset.librarySearchQuery, '');
    equal(reset.filterStatus, 'all');
    equal(reset.filterDifficulty, 'all');
    equal(reset.filterFlag, 'all');
    equal(reset.filterTag, 'all');
    equal(reset.filterDeckId, 'all');

    setAppState({ librarySortBy: 'default' });
    appActions.resetLibraryFilters();
    equal(getAppState().librarySortBy, 'newest');
  } finally {
    setAppState(snapshot);
  }
});

test('LIBRARY_SORT_OPTIONS leads with newest and keeps every concrete sort mode', () => {
  eq(
    [...LIBRARY_SORT_OPTIONS],
    [
      'newest',
      'lapses_desc',
      'due_asc',
      'ivl_asc',
      'ivl_desc',
      'stability_asc',
      'front_asc',
    ]
  );
});

test('getNextTableSort cycles column sorts back to newest when toggled off', () => {
  equal(getNextTableSort('newest', 'front'), 'front_asc');
  equal(getNextTableSort('front_asc', 'front'), 'newest');

  equal(getNextTableSort('newest', 'stability'), 'stability_asc');
  equal(getNextTableSort('stability_asc', 'stability'), 'newest');

  equal(getNextTableSort('newest', 'due'), 'due_asc');
  equal(getNextTableSort('due_asc', 'due'), 'lapses_desc');
  equal(getNextTableSort('lapses_desc', 'due'), 'newest');

  equal(getNextTableSort('front_asc', 'stability'), 'stability_asc');
});

test('sortLibraryCards sorts newest numerically descending and preserves other sort modes', () => {
  const cards = [
    makeCard('201', { front: 'Zebra', lapses: 1, intervalDays: 30, mastery: 80, dueRaw: 5 }),
    makeCard('999', { front: 'Alpha', lapses: 5, intervalDays: 2, mastery: 20, dueRaw: 20 }),
    makeCard('1000', { front: 'Middle', lapses: 3, intervalDays: 10, mastery: 50, dueRaw: 1 }),
  ];

  eq(
    sortLibraryCards(cards, 'newest').map((c) => c.id),
    ['1000', '999', '201']
  );
  eq(
    sortLibraryCards(cards, 'default').map((c) => c.id),
    ['201', '999', '1000']
  );
  eq(
    sortLibraryCards(cards, 'front_asc').map((c) => c.id),
    ['999', '1000', '201']
  );
  eq(
    sortLibraryCards(cards, 'lapses_desc').map((c) => c.id),
    ['999', '1000', '201']
  );
  eq(
    sortLibraryCards(cards, 'ivl_asc').map((c) => c.id),
    ['999', '1000', '201']
  );
  eq(
    sortLibraryCards(cards, 'ivl_desc').map((c) => c.id),
    ['201', '1000', '999']
  );
  eq(
    sortLibraryCards(cards, 'stability_asc').map((c) => c.id),
    ['999', '1000', '201']
  );
  eq(
    sortLibraryCards(cards, 'due_asc').map((c) => c.id),
    ['1000', '201', '999']
  );

  const prefixed = [makeCard('card-90'), makeCard('card-200')];
  eq(
    sortLibraryCards(prefixed, 'newest').map((c) => c.id),
    ['card-200', 'card-90']
  );
});

test('LibraryView renders newest label without Reset button by default and puts newer card first', () => {
  const prev = getAppState();
  const snapshot = {
    isLoading: prev.isLoading,
    isInitialSyncing: prev.isInitialSyncing,
    syncing: prev.syncing,
    resolvedLang: prev.resolvedLang,
    libraryCards: prev.libraryCards,
    libraryTotalCount: prev.libraryTotalCount,
    libraryFilteredCount: prev.libraryFilteredCount,
    librarySortBy: prev.librarySortBy,
    libraryViewMode: prev.libraryViewMode,
    librarySearchQuery: prev.librarySearchQuery,
    filterStatus: prev.filterStatus,
    filterDifficulty: prev.filterDifficulty,
    filterFlag: prev.filterFlag,
    filterTag: prev.filterTag,
    filterDeckId: prev.filterDeckId,
  };

  try {
    setAppState({
      isLoading: false,
      isInitialSyncing: false,
      syncing: false,
      resolvedLang: 'zh-CN',
      libraryViewMode: 'gallery',
      librarySearchQuery: '',
      filterStatus: 'all',
      filterDifficulty: 'all',
      filterFlag: 'all',
      filterTag: 'all',
      filterDeckId: 'all',
      librarySortBy: 'newest',
      libraryCards: [
        makeCard('101', { front: 'OLDER_CARD_101' }),
        makeCard('102', { front: 'NEWER_CARD_102' }),
      ],
      libraryTotalCount: 2,
      libraryFilteredCount: 2,
    });

    const defaultHtml = renderToStaticMarkup(React.createElement(LibraryView));
    doesNotMatch(defaultHtml, /undefined|NaN/);
    ok(defaultHtml.includes(translate('zh-CN', 'sortNewest')), 'default render displays 最新添加 ↓');
    ok(
      !defaultHtml.includes(translate('zh-CN', 'resetFilters')),
      'default newest sort must not show Reset Filters button'
    );
    ok(
      defaultHtml.indexOf('NEWER_CARD_102') < defaultHtml.indexOf('OLDER_CARD_101'),
      'newer card must render before older card by default'
    );

    setAppState({ librarySortBy: 'lapses_desc' });
    const overrideHtml = renderToStaticMarkup(React.createElement(LibraryView));
    ok(
      overrideHtml.includes(translate('zh-CN', 'sortLapsesDesc')),
      'non-default sort renders selected label'
    );
    ok(
      overrideHtml.includes(translate('zh-CN', 'resetFilters')),
      'non-default sort shows Reset Filters button'
    );

    setAppState({ libraryCards: [], librarySortBy: 'lapses_desc' });
    const emptyOverrideHtml = renderToStaticMarkup(React.createElement(LibraryView));
    ok(
      emptyOverrideHtml.includes(translate('zh-CN', 'resetFilters')),
      'empty state with non-default sort exposes Reset Filters button'
    );
  } finally {
    setAppState(snapshot);
  }
});
