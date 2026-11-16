// ============================================================================
// Library batch bury/unbury & sibling synchronization tests
// ============================================================================

import { section, test, equal } from '../harness';
import {
  applyQueueFlagToLibraryCards,
  type LibraryCardItem,
} from '../../../frontend/src/stores/useAppStore';

function makeGroupedCard(): LibraryCardItem {
  return {
    id: '201',
    noteId: 'n-200',
    deckId: '1',
    deckName: 'Test',
    front: 'Cloze {{c1::alpha}} / {{c2::beta}}',
    back: 'Answer',
    tags: ['test'],
    status: 'due',
    reps: 1,
    intervalDays: 1,
    mastery: 50,
    stability: 1,
    difficultyLevel: 'medium',
    suspended: false,
    buried: false,
    flags: 0,
    siblingCardIds: ['201', '202'],
    siblingCount: 2,
    siblingCards: [
      {
        id: '201',
        ord: 0,
        label: 'c1',
        status: 'due',
        suspended: false,
        buried: false,
        dueText: 'Due Today',
        mastery: 50,
        difficultyLevel: 'medium',
        flags: 0,
        reps: 1,
        lapses: 0,
        intervalDays: 1,
        isCloze: true,
      },
      {
        id: '202',
        ord: 1,
        label: 'c2',
        status: 'due',
        suspended: false,
        buried: false,
        dueText: 'Due Today',
        mastery: 50,
        difficultyLevel: 'medium',
        flags: 0,
        reps: 1,
        lapses: 0,
        intervalDays: 1,
        isCloze: true,
      },
    ],
  };
}

section('store · library batch bury & unbury sibling sync');

test('applyQueueFlagToLibraryCards syncs bury/unbury across card and siblingCards', () => {
  const afterBury = applyQueueFlagToLibraryCards(
    [makeGroupedCard()],
    ['201'],
    'buried',
    true,
    true
  )[0];
  equal(afterBury.buried, true);
  equal(afterBury.status, 'buried');
  equal(afterBury.siblingCards?.[0].buried, true);
  equal(afterBury.siblingCards?.[1].buried, true);

  const afterSingleUnbury = applyQueueFlagToLibraryCards(
    [afterBury],
    ['201'],
    'buried',
    false,
    false
  )[0];
  equal(afterSingleUnbury.siblingCards?.[0].buried, false);
  equal(afterSingleUnbury.siblingCards?.[1].buried, true);
  equal(afterSingleUnbury.buried, false);
  equal(afterSingleUnbury.status, 'due');
});
