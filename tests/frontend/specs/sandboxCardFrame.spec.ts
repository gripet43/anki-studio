import assert from 'node:assert/strict';
import vm from 'node:vm';
import { section, test } from '../harness';
import {
  buildSandboxSrcDoc,
  normalizeSandboxHttpBaseUrl,
  sanitizeSandboxPreloadScripts,
} from '../../../frontend/src/components/reviewer/SandboxCardFrame';

section('SandboxCardFrame — relative script resolution & on-demand preload');

test('normalizeSandboxHttpBaseUrl accepts http(s) and rejects non-http schemes', () => {
  assert.equal(normalizeSandboxHttpBaseUrl('http://localhost:5000'), 'http://localhost:5000/');
  assert.equal(normalizeSandboxHttpBaseUrl('http://localhost:5000/'), 'http://localhost:5000/');
  assert.equal(normalizeSandboxHttpBaseUrl('https://localhost:8443'), 'https://localhost:8443/');
  assert.equal(normalizeSandboxHttpBaseUrl('file:///Users/a/media/'), '');
  assert.equal(normalizeSandboxHttpBaseUrl('data:text/plain,1'), '');
  assert.equal(normalizeSandboxHttpBaseUrl(''), '');
});

test('sanitizeSandboxPreloadScripts filters non-http schemes and deduplicates', () => {
  assert.deepEqual(
    sanitizeSandboxPreloadScripts([
      'http://localhost:5000/_jquery.min.js',
      'http://localhost:5000/_jquery.min.js',
      'file:///local/_jquery.min.js',
      'data:text/plain,1',
      'https://localhost:5000/_extra.js',
    ]),
    ['http://localhost:5000/_jquery.min.js', 'https://localhost:5000/_extra.js']
  );
});

test('buildSandboxSrcDoc never emits <base> tag so #hash links and SVG url(#id) stay intact', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'ec-1',
    initialBody: '<a href="#top">top</a><svg><rect fill="url(#g1)"/></svg>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
    mediaHttpBaseUrl: 'http://localhost:5000/',
    preloadScripts: ['http://localhost:5000/_jquery.min.js'],
  });
  assert.equal(/<base\b/i.test(doc), false, 'must not inject <base href>');
  assert.ok(
    doc.includes('<script src="http://localhost:5000/_jquery.min.js"></script>'),
    'should include preloaded _jquery.min.js in <head>'
  );
  assert.ok(
    doc.indexOf('http://localhost:5000/_jquery.min.js') < doc.indexOf('<div id="qa">'),
    'preload script must appear before #qa body scripts'
  );
  assert.ok(
    doc.includes('HTMLScriptElement.prototype'),
    'should inject dynamic relative script src resolver when mediaHttpBaseUrl is set'
  );
});

test('buildSandboxSrcDoc omits resolver and preload tags when not needed', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'plain-1',
    initialBody: '<div>hello</div>',
    cssText: '',
    isDark: true,
    initialZoom: 1,
  });
  assert.equal(doc.includes('HTMLScriptElement.prototype'), false);
  assert.equal(doc.includes('_jquery.min.js'), false);
});

test('buildSandboxSrcDoc renders LaTeX formulas while preserving <script> and <code> blocks verbatim', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'math-1',
    initialBody:
      '<div>Formula: \\( A \\times B \\) and $$\\frac{1}{2}$$</div>' +
      '<script>var a = $("#qa"); var b = $("#x"); var r = /\\(test\\)/;</script>' +
      '<code>$not_math$</code>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
  });
  assert.ok(doc.includes('.anki-math-inline'), 'must include self-contained inline math CSS in sandbox');
  assert.ok(doc.includes('.anki-math-display'), 'must include self-contained display math CSS in sandbox');
  assert.ok(doc.includes('<span class="anki-math-inline">A × B</span>'), 'inline LaTeX should render');
  assert.ok(doc.includes('class="anki-math-frac"'), 'display \\frac should render with sandbox classes');
  assert.ok(
    doc.includes('<script>var a = $("#qa"); var b = $("#x"); var r = /\\(test\\)/;</script>'),
    '<script> contents with $ and \\( must never be corrupted'
  );
  assert.ok(doc.includes('<code>$not_math$</code>'), '<code> blocks must not be rewritten as math');
});

test('buildSandboxSrcDoc attaches native Anki cardN body class (defaulting to card1)', () => {
  const docDefault = buildSandboxSrcDoc({
    cardId: 'ord-default',
    initialBody: '<div>q</div>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
  });
  assert.ok(docDefault.includes('<body class="card card1">'), 'defaults to card1 in light mode');

  const docOrd4Dark = buildSandboxSrcDoc({
    cardId: 'ord-4',
    cardOrd: 4,
    initialBody: '<div>q</div>',
    cssText: '',
    isDark: true,
    initialZoom: 1,
  });
  assert.ok(
    docOrd4Dark.includes('<body class="card card4 nightMode night_mode">'),
    'must include card4 and nightMode classes on body'
  );

  const docInvalid = buildSandboxSrcDoc({
    cardId: 'ord-zero',
    cardOrd: 0,
    initialBody: '<div>q</div>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
  });
  assert.ok(docInvalid.includes('<body class="card card1">'), 'clamps invalid cardOrd < 1 to card1');
});

test('buildSandboxSrcDoc respects template canvas background and custom .cloze CSS without clashing', () => {
  const darkTemplateCss = `
    .card { color: white; background-color: #2c2c2c; margin: 20px; }
    .cloze { font-weight: normal; }
    .cloze:not(.answerCard) { color: MediumSeaGreen; }
  `;
  const docDarkTpl = buildSandboxSrcDoc({
    cardId: 'co-1',
    cardOrd: 1,
    initialBody: '<div id="cloze-js-rendered"></div>',
    cssText: darkTemplateCss,
    isDark: false,
    initialZoom: 1,
  });
  assert.equal(
    docDarkTpl.includes('background: transparent !important'),
    false,
    'must never force background: transparent !important over template canvas'
  );
  assert.equal(
    docDarkTpl.includes('background: #EAF6F0'),
    false,
    'must not inject fallback .cloze pill when template defines its own .cloze style'
  );
  assert.equal(
    docDarkTpl.includes('.nightMode .cloze,'),
    false,
    'must not override custom MediumSeaGreen .cloze with blue dark-mode rescue'
  );
  assert.ok(docDarkTpl.includes('.card.nightMode,'), 'must include native-style .card.nightMode dark fallback');

  const plainClozeCss = '.card { color: black; background-color: white; } .cloze { color: blue; }';
  const docPlainCloze = buildSandboxSrcDoc({
    cardId: 'plain-cloze-1',
    initialBody: '<span class="cloze">[...]</span>',
    cssText: plainClozeCss,
    isDark: true,
    initialZoom: 1,
  });
  assert.ok(
    docPlainCloze.includes('.nightMode .cloze,'),
    'default blue .cloze without .nightMode rule should receive dark-mode contrast rescue'
  );

  const noClozeCssDoc = buildSandboxSrcDoc({
    cardId: 'no-cloze-css',
    initialBody: '<span class="cloze">[...]</span>',
    cssText: '#card-body { font-size: 16px; }',
    isDark: false,
    initialZoom: 1,
  });
  assert.ok(
    noClozeCssDoc.includes('background: #EAF6F0'),
    'templates without .cloze rules should still get default Studio cloze pill styling'
  );
});

test('buildSandboxSrcDoc installs an in-memory localStorage/sessionStorage shim supporting Object.keys', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'storage-1',
    initialBody: '<div>hello</div>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
  });
  const shimMatch = doc.match(
    /<script>\n\/\/ 沙盒 iframe 处于隔离源[\s\S]*?<\/script>/
  );
  assert.ok(shimMatch, 'must inject storage shim script in <head>');
  assert.ok(
    doc.indexOf(shimMatch[0]) < doc.indexOf('<div id="qa">'),
    'storage shim must execute before #qa card scripts'
  );

  const shimJs = shimMatch[0].replace(/^<script>|<\/script>$/g, '');
  const fakeWindow: Record<string, unknown> = {};
  for (const prop of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(fakeWindow, prop, {
      configurable: true,
      enumerable: true,
      get() {
        throw new Error(`SecurityError: Failed to read '${prop}' from opaque origin`);
      },
    });
  }
  const ctx = vm.createContext({ window: fakeWindow, Object, Proxy, Number, String });
  vm.runInContext(shimJs, ctx);

  const ls = fakeWindow.localStorage as Storage & Record<string, string>;
  const ss = fakeWindow.sessionStorage as Storage & Record<string, string>;
  assert.equal(ls.length, 0);
  assert.equal(ls.getItem('groups'), null);

  ls.setItem('groups', JSON.stringify(['A', 'B']));
  ls.setItem('icons_shown', 'true');
  assert.equal(ls.getItem('groups'), '["A","B"]');
  assert.equal(ls.length, 2);
  assert.deepEqual(Object.keys(ls).sort(), ['groups', 'icons_shown']);
  assert.equal(ls.key(0), 'groups');

  ls.customProp = 'hello';
  assert.equal(ls.getItem('customProp'), 'hello');
  delete ls.customProp;
  assert.equal(ls.getItem('customProp'), null);

  ls.removeItem('icons_shown');
  assert.deepEqual(Object.keys(ls), ['groups']);
  ls.clear();
  assert.equal(ls.length, 0);

  ss.setItem('k', 'v');
  assert.equal(ss.getItem('k'), 'v');
});
