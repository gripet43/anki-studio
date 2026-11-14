// ============================================================================
// Cloze Grouping Mode Unit Tests (Combined 1-card vs Split N-cards)
// ============================================================================

import { section, test, equal, eq } from '../harness';
import {
  countTotalClozeSpans,
  getClozeGroupingMode,
  getDistinctClozeOrdinals,
  rewriteClozeModeInFieldMap,
} from '../../../frontend/src/utils/clozeMode';

section('clozeMode · 同卡合并 / 分步多卡切换与序号统计');

test('空文本与单个 c1 默认属于 combined 模式', () => {
  equal(countTotalClozeSpans(['plain text', '']), 0);
  eq(getDistinctClozeOrdinals(['plain text', '']), []);
  equal(getClozeGroupingMode(['plain text', '']), 'combined');

  const single = ['{{c1::Alpha}} and {{c1::Beta}}', ''];
  equal(countTotalClozeSpans(single), 2);
  eq(getDistinctClozeOrdinals(single), [1]);
  equal(getClozeGroupingMode(single), 'combined');
});

test('多个不同序号自动识别为 split 模式并排序去重', () => {
  const fields = ['{{c3::Gamma}} {{c1::Alpha}}', '{{c2::Beta}} {{c1::Delta}}'];
  equal(countTotalClozeSpans(fields), 4);
  eq(getDistinctClozeOrdinals(fields), [1, 2, 3]);
  equal(getClozeGroupingMode(fields), 'split');
});

test('combined -> split 按字段展示顺序重排为 c1..cN 并保留提示词与 LaTeX 花括号', () => {
  const input = {
    front: 'First {{c1::\\frac{1}{2}::fraction}} then {{c1::second}}',
    back: 'Extra {{c1::third}}',
  };
  const converted = rewriteClozeModeInFieldMap(input, 'split', ['front', 'back']);
  equal(
    converted.front,
    'First {{c1::\\frac{1}{2}::fraction}} then {{c2::second}}',
  );
  equal(converted.back, 'Extra {{c3::third}}');
  equal(getClozeGroupingMode([converted.front, converted.back]), 'split');
  eq(getDistinctClozeOrdinals([converted.front, converted.back]), [1, 2, 3]);
});

test('split -> combined 全部归并为 c1，且可逆', () => {
  const splitMap = {
    front: 'A {{c1::one}} B {{c2::two}}',
    extra: 'C {{c3::three::hint}}',
  };
  const combined = rewriteClozeModeInFieldMap(splitMap, 'combined', ['front', 'extra']);
  equal(combined.front, 'A {{c1::one}} B {{c1::two}}');
  equal(combined.extra, 'C {{c1::three::hint}}');
  equal(getClozeGroupingMode([combined.front, combined.extra]), 'combined');
  eq(getDistinctClozeOrdinals([combined.front, combined.extra]), [1]);
});
