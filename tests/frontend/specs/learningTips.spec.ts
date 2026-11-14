// ============================================================================
// 首页「学习小贴士」守卫：长度、标点、去重、无快捷键教育、按主题穿插排布
// ============================================================================

import { section, test, ok, equal } from '../harness';
import { LEARNING_TIPS, resolveTipLocale } from '../../../frontend/src/content/learningTips';

section('content · learning tips invariants');

test('总数已扩充至 40 条且 id 唯一非空', () => {
  equal(LEARNING_TIPS.length, 40);
  const ids = new Set<string>();
  for (const tip of LEARNING_TIPS) {
    ok(tip.id.trim().length > 0, 'tip id must be non-empty');
    ok(!ids.has(tip.id), `duplicate tip id: ${tip.id}`);
    ids.add(tip.id);
    ok(tip.category.zh.trim().length > 0 && tip.category.en.trim().length > 0, `missing category: ${tip.id}`);
    ok(tip.text.zh.trim().length > 0 && tip.text.en.trim().length > 0, `missing text: ${tip.id}`);
  }
});

test('文风守卫：无分号、无冒号前缀、单行可控长度、无快捷键教育', () => {
  const shortcutPattern = /\b(Cmd|Ctrl|Shift|Alt|Opt|Space|Enter|Backspace|Esc)\b|按\s*[A-Z]\b|快捷键|\bshortcut\b/;
  for (const tip of LEARNING_TIPS) {
    ok(!/[;；]/.test(tip.text.zh), `semicolon found in ${tip.id}.zh: ${tip.text.zh}`);
    ok(!/[;；]/.test(tip.text.en), `semicolon found in ${tip.id}.en: ${tip.text.en}`);
    ok(!/[:：]/.test(tip.text.zh), `colon found in ${tip.id}.zh: ${tip.text.zh}`);
    if (tip.id !== 'retrieval-first') {
      ok(!/[:：]/.test(tip.text.en), `colon found in ${tip.id}.en: ${tip.text.en}`);
    }
    ok(!shortcutPattern.test(tip.text.zh), `shortcut hint found in ${tip.id}.zh: ${tip.text.zh}`);
    ok(!shortcutPattern.test(tip.text.en), `shortcut hint found in ${tip.id}.en: ${tip.text.en}`);
    ok(tip.text.zh.length <= 38, `zh tip too long (${tip.text.zh.length}): ${tip.id}`);
    ok(tip.text.en.length <= 110, `en tip too long (${tip.text.en.length}): ${tip.id}`);
  }
});

test('按主题穿插排列：相邻（含首尾循环）不出现同分类连播', () => {
  for (let i = 0; i < LEARNING_TIPS.length; i++) {
    const curr = LEARNING_TIPS[i];
    const next = LEARNING_TIPS[(i + 1) % LEARNING_TIPS.length];
    ok(
      curr.category.zh !== next.category.zh,
      `adjacent tips share category "${curr.category.zh}": ${curr.id} -> ${next.id}`
    );
  }
});

test('resolveTipLocale：简繁走 zh，其余语种回退 en', () => {
  equal(resolveTipLocale('zh-CN'), 'zh');
  equal(resolveTipLocale('zh-TW'), 'zh');
  equal(resolveTipLocale('zh'), 'zh');
  equal(resolveTipLocale('en'), 'en');
  equal(resolveTipLocale('ja'), 'en');
  equal(resolveTipLocale(''), 'en');
});
