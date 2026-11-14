// ============================================================================
// 卡片调试信息诊断工具与报告格式化单测
//
// 验证：
//   1. 正常挖空卡片（modelType=1 + {{cloze:...}}）零误报；
//   2. Standard 卡型里出现 {{c1::...}}、零宽字符、断头挖空都能精确定位；
//   3. 诊断报告完整保留 HTML 标签与原生字段，仅折叠超长 base64 data:URI。
// ============================================================================

import { section, test, equal, ok } from '../harness';
import {
  buildCardDebugReport,
  sanitizeDebugString,
  scanFieldAnomalies,
} from '../../../frontend/src/utils/cardDebugInfo';

section('card debug info · 字段与模板异常扫描');

test('标准 Cloze 模型配合 {{cloze:文字}} 与完整挖空不误报异常', () => {
  const res = scanFieldAnomalies(
    { 文字: '《{{c1::测}}试》', 背面额外: '补充说明' },
    { modelType: 1, qfmt: '{{cloze:文字}}', isClozeCardFlag: true }
  );
  equal(res.anomalies.length, 0);
  equal(res.validClozeFields.length, 1);
  equal(res.brokenClozeCandidates.length, 0);
  equal(res.invisibleChars.length, 0);
});

test('Standard 卡型（modelType=0）包含 {{c1::...}} 时检出 CLOZE_SYNTAX_IN_STANDARD_MODEL', () => {
  const res = scanFieldAnomalies(
    { 文字: '《{{c1::测}}试》' },
    { modelType: 0, qfmt: '{{文字}}', isClozeCardFlag: false }
  );
  const codes = res.anomalies.map((a) => a.code);
  ok(codes.includes('CLOZE_SYNTAX_IN_STANDARD_MODEL'));
});

test('零宽字符与未闭合挖空前缀能精准告警', () => {
  const res = scanFieldAnomalies(
    { 正面: '{{c1\u200b::测}} 与 {{c2:断头' },
    { modelType: 1, qfmt: '{{cloze:正面}}', isClozeCardFlag: true }
  );
  const codes = res.anomalies.map((a) => a.code);
  ok(codes.includes('INVISIBLE_CHARS_DETECTED'));
  ok(codes.includes('BROKEN_CLOZE_SYNTAX'));
  equal(res.invisibleChars[0].codepoint, 'U+200B ZERO WIDTH SPACE');
});

test('sanitizeDebugString 折叠超大 base64 图像但完整保留 HTML 标签与本地文件名', () => {
  const bigBase64 = 'A'.repeat(400);
  const html = `<div><img src="paste_123.png"><img src="data:image/png;base64,${bigBase64}"><b>重点</b></div>`;
  const out = sanitizeDebugString(html);
  ok(out.includes('<img src="paste_123.png">'));
  ok(out.includes('<b>重点</b>'));
  ok(out.includes('data:image/png;base64,<truncated 400 chars>'));
});

test('buildCardDebugReport 生成可解析 JSON 且不剥离 HTML 标签', () => {
  const report = buildCardDebugReport({
    copiedAt: '2026-11-14T15:00:00.000Z',
    client: {
      sourceView: 'reviewer',
      envInfo: {
        platform: 'win',
        osName: 'Windows',
        ankiVersion: '25.09.2',
        platformBadge: 'Windows · 25.09.2',
        studioVersion: '1.5.8',
      },
      theme: 'light',
      accentColor: 'indigo',
      resolvedLang: 'zh-CN',
      sandboxNoteTypeIds: ['999'],
      reviewStageWidth: 'auto',
      reviewContentScale: 100,
      isPreviewSession: false,
      isCardFlipped: false,
      isSandboxCard: true,
    },
    card: {
      id: '1001',
      noteId: '2002',
      deckId: '1',
      deckName: 'TestDeck',
      fullDeckName: 'TestDeck',
      notetypeId: '999',
      noteTypeName: 'CustomNote',
      isCloze: false,
      needsSandbox: false,
      frontHtml: '<span class="cloze">[...]</span>',
      sandboxFrontHtml: '<div id="qa">《{{c1::测}}试》</div>',
      fields: { 文字: '《{{c1::测}}试》' },
    },
    backend: {
      available: true,
      noteTypeInfo: {
        id: '999',
        name: 'CustomNote',
        modelType: 0,
        modelTypeLabel: 'Standard (0)',
        css: '.card { text-align: center; }',
        fieldNames: ['文字', '背面额外'],
        templateCount: 1,
        activeOrd: 0,
        activeTemplate: { name: 'Card 1', qfmt: '{{文字}}', afmt: '{{FrontSide}}' },
        allTemplateNames: ['Card 1'],
      },
      clozeAndCharDiagnostics: {
        anomalies: [
          {
            code: 'CLOZE_SYNTAX_IN_STANDARD_MODEL',
            message: 'Field(s) 文字 contain cloze syntax, but model.type=0.',
          },
        ],
        validClozeFields: ['文字'],
        brokenClozeCandidates: [],
        htmlInsideClozeFields: [],
        invisibleChars: [],
        qfmtHasClozeFilter: false,
        afmtHasClozeFilter: false,
      },
    },
  });

  ok(report.includes('=== Anki Studio Card Debug Info ==='));
  ok(report.includes('[CLOZE_SYNTAX_IN_STANDARD_MODEL]'));
  const jsonMatch = /```json\n([\s\S]+)\n```/.exec(report);
  ok(jsonMatch && jsonMatch[1], 'must include parseable JSON block');
  const parsed = JSON.parse(jsonMatch![1]);
  equal(parsed.cardFrontend.frontHtml, '<span class="cloze">[...]</span>');
  equal(parsed.cardFrontend.sandboxFrontHtml, '<div id="qa">《{{c1::测}}试》</div>');
  equal(parsed.environment.renderMode, 'sandbox-iframe');
  equal(parsed.backendForensics.noteTypeInfo.modelType, 0);
});
