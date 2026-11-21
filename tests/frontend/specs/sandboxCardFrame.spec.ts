import assert from 'node:assert/strict';
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
