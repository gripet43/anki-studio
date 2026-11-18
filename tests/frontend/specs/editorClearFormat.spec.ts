// ============================================================================
// Card Editor Clear Formatting (清除格式) unit & SSR render tests
// ============================================================================

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { section, test, equal, ok, doesNotMatch } from '../harness';
import {
  TowerWysiwygEditor,
  stripFormattingFromHtml,
} from '../../../frontend/src/components/quick-add/TowerWysiwygEditor';
import { setAppState, getAppState } from '../../../frontend/src/stores/useAppStore';
import { translate } from '../../../frontend/src/i18n/translations';

section('editor · Clear Formatting pure HTML helper');

test('strips inline formatting tags, <font>, <mark>, and <span style/class>', () => {
  const dirty =
    '<p style="color:red;font-size:20px" class="pasted">' +
    '<span style="color:blue;line-height:2" class="x">A</span>' +
    '<font color="green" size="5">B</font>' +
    '<b><strong><i><em><u><s><strike><code>C</code></strike></s></u></em></i></strong></b>' +
    '<mark style="background:#FDF3E7">D</mark>' +
    '</p>';
  equal(stripFormattingFromHtml(dirty), '<p>ABCD</p>');
});

test('normalizes block headings h1..h6, blockquote, and pre to <p> (preserving <pre> line breaks)', () => {
  const dirty =
    '<h1 style="color:red"><b>H1</b></h1>' +
    '<h2>H2</h2>' +
    '<h3><i>H3</i></h3>' +
    '<blockquote><p>Quoted</p></blockquote>' +
    '<pre>line 1\nline 2</pre>';
  equal(
    stripFormattingFromHtml(dirty),
    '<p>H1</p><p>H2</p><p>H3</p><p>Quoted</p><p>line 1<br>line 2</p>'
  );
});

test('preserves <img>, .anki-io-wrap, Math/LaTeX delimiters, and raw {{c1::...}} syntax', () => {
  const dirty =
    '<p><b><img src="paste_1.png" alt="diagram"></b> ' +
    '<span style="color:red"><b>[$]x^2 + y^2[/$]</b></span> ' +
    '<i>\\( a < b \\)</i> ' +
    '<u>{{c1::answer::hint}}</u></p>' +
    '<div class="anki-io-wrap" style="position:relative">' +
    '<img src="io.png"><span class="anki-io-rect" style="position:absolute;left:10%;top:10%"></span>' +
    '</div>';
  equal(
    stripFormattingFromHtml(dirty),
    '<p><img src="paste_1.png" alt="diagram"> ' +
      '[$]x^2 + y^2[/$] ' +
      '\\( a < b \\) ' +
      '{{c1::answer::hint}}</p>' +
      '<div class="anki-io-wrap" style="position:relative">' +
      '<img src="io.png"><span class="anki-io-rect" style="position:absolute;left:10%;top:10%"></span>' +
      '</div>'
  );
});

test('preserves .anki-cloze-pill wrapper & prefix while clearing formatting inside .anki-cloze-body', () => {
  const dirty =
    '<p><span style="color:red"><span class="anki-cloze-pill" data-cloze-ord="2" data-cloze-hint="tip">' +
    '<span class="anki-cloze-prefix" contenteditable="false">c2:</span>' +
    '<span class="anki-cloze-body"><b><i>ans</i></b> (tip)</span>' +
    '</span></span></p>';
  equal(
    stripFormattingFromHtml(dirty),
    '<p><span class="anki-cloze-pill" data-cloze-ord="2" data-cloze-hint="tip">' +
      '<span class="anki-cloze-prefix" contenteditable="false">c2:</span>' +
      '<span class="anki-cloze-body">ans (tip)</span>' +
      '</span></p>'
  );

  // Mixed multi-paragraph content with cloze pill keeps contenteditable="false" on prefix
  const multiBlock =
    '<p><b>Hello</b></p><p><span class="anki-cloze-pill" data-cloze-ord="1">' +
    '<span class="anki-cloze-prefix" contenteditable="false">c1:</span>' +
    '<span class="anki-cloze-body"><b>ans</b></span></span></p>';
  equal(
    stripFormattingFromHtml(multiBlock),
    '<p>Hello</p><p><span class="anki-cloze-pill" data-cloze-ord="1">' +
      '<span class="anki-cloze-prefix" contenteditable="false">c1:</span>' +
      '<span class="anki-cloze-body">ans</span></span></p>'
  );
});

test('strips inline style/class/bold inside <p style="color:red"> following heading block', () => {
  const dirty = '<h1>Title</h1><p style="color:red"><b>caretWord</b></p><p>Tail</p>';
  equal(stripFormattingFromHtml(dirty), '<p>Title</p><p>caretWord</p><p>Tail</p>');
});

test('preserves table structure/styles, list structure, and links while stripping inline/class junk', () => {
  const dirty =
    '<ul style="color:navy" class="list"><li style="font-size:18px"><b>Item</b></li></ul>' +
    '<p><a href="https://example.com" style="color:red" class="lnk"><b>Link</b></a></p>' +
    '<table style="width:100%"><tbody><tr>' +
    '<td style="border:1px solid #D0D7DE"><h1>Title</h1><b>Body</b></td>' +
    '</tr></tbody></table>';
  equal(
    stripFormattingFromHtml(dirty),
    '<ul><li>Item</li></ul>' +
      '<p><a href="https://example.com">Link</a></p>' +
      '<table style="width:100%"><tbody><tr>' +
      '<td style="border:1px solid #D0D7DE">Title<br>Body</td>' +
      '</tr></tbody></table>'
  );
});

section('editor · Clear Formatting toolbar SSR smoke');

test('TowerWysiwygEditor renders localized Clear Formatting button without raw title=', () => {
  const prevLang = getAppState().resolvedLang;
  try {
    setAppState({ resolvedLang: 'zh-CN' });
    const zhHtml = renderToStaticMarkup(
      React.createElement(TowerWysiwygEditor, {
        label: 'Front',
        value: '<p><b>test</b></p>',
        onChange: () => {},
      })
    );
    ok(zhHtml.includes(`aria-label="${translate('zh-CN', 'editorToolClearFormat')}"`));
    doesNotMatch(zhHtml, /\btitle=/);

    setAppState({ resolvedLang: 'en' });
    const enHtml = renderToStaticMarkup(
      React.createElement(TowerWysiwygEditor, {
        label: 'Front',
        value: '<p><b>test</b></p>',
        onChange: () => {},
      })
    );
    ok(enHtml.includes(`aria-label="${translate('en', 'editorToolClearFormat')}"`));
    doesNotMatch(enHtml, /\btitle=/);
  } finally {
    setAppState({ resolvedLang: prevLang });
  }
});
