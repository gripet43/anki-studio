// ============================================================================
// Cmd+K Global Search reset behavior
// Closing and reopening global search must start with an empty query, zero
// stale results, reset selection index, and no lingering searching state.
// ============================================================================

import { section, test, equal, eq } from '../harness';
import { appActions, getAppState, setAppState } from '../../../frontend/src/stores/useAppStore';

const SAMPLE_CARDS = [
  {
    id: 'c-1',
    noteId: 'n-1',
    deckId: 'd-1',
    deckName: 'English',
    front: 'serendipity',
    back: 'happy chance discovery',
    tags: ['vocab'],
    status: 'review' as const,
    reps: 3,
    intervalDays: 7,
    mastery: 80,
    stability: 6.5,
    difficultyLevel: 'medium' as const,
    suspended: false,
    flags: 0,
  },
];

section('store · global search reset on close/reopen');

test('closing Cmd+K clears previous search query, results, selection, and searching flag', () => {
  const prevCards = getAppState().libraryCards;
  try {
    setAppState({ libraryCards: SAMPLE_CARDS, cmdKOpen: false });
    setAppState({ cmdKOpen: true });
    appActions.searchCmdKDebounced('serendipity');
    setAppState({ cmdKSelectedIndex: 1 });

    equal(getAppState().cmdKQuery, 'serendipity');
    equal(getAppState().cmdKResults.length, 1);

    // Close the search dialog
    setAppState({ cmdKOpen: false });
    equal(getAppState().cmdKOpen, false);
    equal(getAppState().cmdKQuery, '');
    eq(getAppState().cmdKResults, []);
    equal(getAppState().cmdKSelectedIndex, 0);
    equal(getAppState().cmdKSearching, false);

    // Reopen search dialog: input and state remain completely clean
    setAppState({ cmdKOpen: true });
    equal(getAppState().cmdKOpen, true);
    equal(getAppState().cmdKQuery, '');
    eq(getAppState().cmdKResults, []);
    equal(getAppState().cmdKSelectedIndex, 0);
    equal(getAppState().cmdKSearching, false);
  } finally {
    setAppState({ cmdKOpen: false, libraryCards: prevCards });
  }
});

test('functional updater toggle (Cmd+K / Dashboard reopen) resets stale query even if pre-populated', () => {
  try {
    setAppState({ cmdKOpen: true, cmdKQuery: 'stale-term', cmdKSelectedIndex: 2 });
    // Toggle closed
    setAppState((prev) => ({ cmdKOpen: !prev.cmdKOpen }));
    equal(getAppState().cmdKOpen, false);
    equal(getAppState().cmdKQuery, '');
    equal(getAppState().cmdKSelectedIndex, 0);

    // Simulate stale query injected while closed before reopening
    setAppState({ cmdKQuery: 'leftover' });
    setAppState((prev) => ({ cmdKOpen: !prev.cmdKOpen }));
    equal(getAppState().cmdKOpen, true);
    equal(getAppState().cmdKQuery, '');
    eq(getAppState().cmdKResults, []);
  } finally {
    setAppState({ cmdKOpen: false });
  }
});

test('clearing query with empty string wipes results and cancels searching state', () => {
  const prevCards = getAppState().libraryCards;
  try {
    setAppState({ libraryCards: SAMPLE_CARDS, cmdKOpen: true });
    appActions.searchCmdKDebounced('serendipity');
    equal(getAppState().cmdKResults.length, 1);

    appActions.searchCmdKDebounced('');
    equal(getAppState().cmdKQuery, '');
    eq(getAppState().cmdKResults, []);
    equal(getAppState().cmdKSearching, false);
  } finally {
    setAppState({ cmdKOpen: false, libraryCards: prevCards });
  }
});
