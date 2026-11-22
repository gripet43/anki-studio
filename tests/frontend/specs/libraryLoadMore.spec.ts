// ============================================================================
// Card Library — Load More interaction, loading state, re-entry guard & motion
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { equal, ok, section, test } from '../harness';
import {
  appActions,
  createEmptyLibraryState,
  getAppState,
  LIBRARY_VISIBLE_STEP,
  setAppState,
} from '../../../frontend/src/stores/useAppStore';
import { LibraryView } from '../../../frontend/src/components/search/LibraryView';
import { translate } from '../../../frontend/src/i18n/translations';
import type { LibraryCardItem } from '../../../frontend/src/bridge/pycmd';

function makeCards(count: number): LibraryCardItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const id = String(1000 + idx);
    return {
      id,
      noteId: `n_${id}`,
      deckId: '1',
      deckName: 'Default',
      front: `Card Front ${idx + 1}`,
      back: `Card Back ${idx + 1}`,
      tags: [],
      mastery: 50,
      stability: 10,
      difficultyLevel: 'medium',
      dueText: 'Due',
      status: 'review',
      reps: 2,
      lapses: 0,
      intervalDays: 10,
    };
  });
}

section('library · load more interaction & loading state');

test('createEmptyLibraryState initializes libraryLoadingMore=false and visible step=24', () => {
  const empty = createEmptyLibraryState();
  equal(empty.libraryLoadingMore, false);
  equal(empty.libraryVisibleCount, LIBRARY_VISIBLE_STEP);
  equal(LIBRARY_VISIBLE_STEP, 24);
});

test('loadMoreLibraryCards expands buffered cards immediately and guards re-entry while loading', () => {
  const prev = getAppState();
  const snapshot = {
    libraryCards: prev.libraryCards,
    libraryVisibleCount: prev.libraryVisibleCount,
    libraryLoadingMore: prev.libraryLoadingMore,
    libraryHasMoreFromBackend: prev.libraryHasMoreFromBackend,
  };

  try {
    setAppState({
      libraryCards: makeCards(48),
      libraryVisibleCount: 24,
      libraryLoadingMore: false,
      libraryHasMoreFromBackend: true,
    });

    // Fast path: 48 cards already in memory, advancing 24 -> 48 stays synchronous without flicker
    void appActions.loadMoreLibraryCards();
    equal(getAppState().libraryVisibleCount, 48);
    equal(getAppState().libraryLoadingMore, false);

    // Re-entry guard: calls while libraryLoadingMore=true must be ignored
    setAppState({ libraryLoadingMore: true });
    void appActions.loadMoreLibraryCards();
    equal(getAppState().libraryVisibleCount, 48);
    equal(getAppState().libraryLoadingMore, true);
  } finally {
    setAppState(snapshot);
  }
});

test('LibraryView renders idle & loadingMore button states consistently in gallery and table views', () => {
  const prev = getAppState();
  const snapshot = {
    isLoading: prev.isLoading,
    isInitialSyncing: prev.isInitialSyncing,
    syncing: prev.syncing,
    resolvedLang: prev.resolvedLang,
    libraryCards: prev.libraryCards,
    libraryTotalCount: prev.libraryTotalCount,
    libraryFilteredCount: prev.libraryFilteredCount,
    libraryVisibleCount: prev.libraryVisibleCount,
    libraryHasMoreFromBackend: prev.libraryHasMoreFromBackend,
    libraryLoaded: prev.libraryLoaded,
    librarySearching: prev.librarySearching,
    libraryLoadingMore: prev.libraryLoadingMore,
    libraryViewMode: prev.libraryViewMode,
    librarySearchQuery: prev.librarySearchQuery,
    filterStatus: prev.filterStatus,
    filterDifficulty: prev.filterDifficulty,
    filterFlag: prev.filterFlag,
    filterTag: prev.filterTag,
    filterDeckId: prev.filterDeckId,
    librarySortBy: prev.librarySortBy,
  };

  try {
    const cards = makeCards(48);
    for (const viewMode of ['gallery', 'table'] as const) {
      setAppState({
        isLoading: false,
        isInitialSyncing: false,
        syncing: false,
        resolvedLang: 'zh-CN',
        libraryCards: cards,
        libraryTotalCount: 54442,
        libraryFilteredCount: 54442,
        libraryVisibleCount: 24,
        libraryHasMoreFromBackend: true,
        libraryLoaded: true,
        librarySearching: false,
        libraryLoadingMore: false,
        libraryViewMode: viewMode,
        librarySearchQuery: '',
        filterStatus: 'all',
        filterDifficulty: 'all',
        filterFlag: 'all',
        filterTag: 'all',
        filterDeckId: 'all',
        librarySortBy: 'newest',
      });

      const idleHtml = renderToStaticMarkup(React.createElement(LibraryView));
      ok(
        idleHtml.includes('type="button"') && idleHtml.includes('aria-busy="false"'),
        `${viewMode}: idle Load More button must declare type="button" and aria-busy="false"`
      );
      ok(
        idleHtml.includes(translate('zh-CN', 'loadMoreCards', { loaded: 24, total: 48 })),
        `${viewMode}: idle button displays current loaded / total text`
      );
      ok(
        idleHtml.includes('tabular-nums') && idleHtml.includes('active:scale-[0.98]'),
        `${viewMode}: idle button includes tabular-nums and active press tactile scale`
      );

      setAppState({ libraryLoadingMore: true });
      const loadingHtml = renderToStaticMarkup(React.createElement(LibraryView));
      ok(
        loadingHtml.includes('disabled=""') && loadingHtml.includes('aria-busy="true"'),
        `${viewMode}: loading button must be disabled and aria-busy="true"`
      );
      ok(
        loadingHtml.includes(translate('zh-CN', 'loadingMoreCards')),
        `${viewMode}: loading button displays localized loadingMoreCards label`
      );
      ok(
        loadingHtml.includes('motion-safe:animate-spin'),
        `${viewMode}: loading button renders spinning SpinnerIcon`
      );
    }

    // Batch-relative stagger: card #25 (index 24) starts at 0ms animation-delay instead of 336ms
    setAppState({
      libraryViewMode: 'gallery',
      libraryLoadingMore: false,
      libraryVisibleCount: 48,
    });
    const batch2Html = renderToStaticMarkup(React.createElement(LibraryView));
    const zeroDelayCount = (batch2Html.match(/animation-delay:0ms/g) || []).length;
    ok(
      zeroDelayCount >= 2,
      `newly revealed batch cards should restart stagger delay at 0ms (found ${zeroDelayCount})`
    );
  } finally {
    setAppState(snapshot);
  }
});
