// ============================================================================
// Media URL resolution
// This is the path that decides whether a card's <img> actually renders inside
// the WebView. A regression here silently breaks images/audio in the reviewer,
// library and WYSIWYG editor — exactly the kind of bug the string-only audit
// suite cannot catch.
// ============================================================================

import { section, test, equal, ok } from '../harness';
import {
  normalizeMediaBaseUrl,
  extractMediaBaseUrlFromHtml,
  resolveMediaSrcValue,
  resolveMediaInHtml,
} from '../../../frontend/src/utils/mediaUrl';

const BASE = 'file:///Users/me/Library/Application%20Support/Anki2/User%201/collection.media/';

section('media url · base normalisation');

test('normalizeMediaBaseUrl handles empty, slash-less and already-slashed input', () => {
  equal(normalizeMediaBaseUrl(null), '');
  equal(normalizeMediaBaseUrl(undefined), '');
  equal(normalizeMediaBaseUrl(''), '');
  equal(normalizeMediaBaseUrl('   '), '');
  equal(normalizeMediaBaseUrl('/tmp/media'), '/tmp/media/');
  equal(normalizeMediaBaseUrl('/tmp/media/'), '/tmp/media/');
  equal(normalizeMediaBaseUrl('  /tmp/media  '), '/tmp/media/');
});

section('media url · single src resolution');

test('relative filenames are joined onto the media base', () => {
  equal(resolveMediaSrcValue('foo.png', '/tmp/media/'), '/tmp/media/foo.png');
  equal(resolveMediaSrcValue('./foo.png', '/tmp/media/'), '/tmp/media/foo.png');
  equal(resolveMediaSrcValue('nested/foo.png', '/tmp/media/'), '/tmp/media/nested/foo.png');
});

test('path segments are URI-encoded exactly once', () => {
  equal(resolveMediaSrcValue('a b.png', '/tmp/media/'), '/tmp/media/a%20b.png');
  equal(resolveMediaSrcValue('图片.png', '/tmp/media/'), `/tmp/media/${encodeURIComponent('图片.png')}`);
  // Already-encoded input must not be double-encoded on a second pass.
  equal(resolveMediaSrcValue('a%20b.png', '/tmp/media/'), '/tmp/media/a%20b.png');
  equal(
    resolveMediaSrcValue(encodeURIComponent('图片.png'), '/tmp/media/'),
    `/tmp/media/${encodeURIComponent('图片.png')}`
  );
  // A stray % must not throw — safeDecodeSegment keeps the raw segment.
  equal(resolveMediaSrcValue('100%.png', '/tmp/media/'), '/tmp/media/100%25.png');
});

test('absolute, data, blob and protocol URLs are preserved untouched', () => {
  for (const url of [
    'https://example.com/a.png',
    'http://example.com/a.png',
    'data:image/png;base64,AAAA',
    'blob:file:///abc',
    '/absolute/root.png',
  ]) {
    equal(resolveMediaSrcValue(url, '/tmp/media/'), url);
  }
});

test('matching file:// URIs pass through, foreign ones fall back to data-anki-media', () => {
  const own = `${BASE}foo.png`;
  equal(resolveMediaSrcValue(own, BASE), own);
  equal(
    resolveMediaSrcValue('file:///Users/other/collection.media/x.png', BASE, 'y.png'),
    `${BASE}y.png`,
    'a foreign file:// URI must be rescued through the fallback filename'
  );
  equal(
    resolveMediaSrcValue('file:///Users/other/collection.media/x.png', BASE),
    'file:///Users/other/collection.media/x.png',
    'without a fallback the original file:// URI is kept as-is'
  );
});

test('an empty src is rescued by the fallback filename', () => {
  equal(resolveMediaSrcValue('', BASE, 'fallback.png'), `${BASE}fallback.png`);
  equal(resolveMediaSrcValue('', BASE), '');
  equal(resolveMediaSrcValue('', '', 'fallback.png'), '');
});

test('without a media base the relative path is returned verbatim', () => {
  equal(resolveMediaSrcValue('foo bar.png', ''), 'foo bar.png');
  equal(resolveMediaSrcValue('foo.png', null), 'foo.png');
});

test('HTML entities in the src are decoded before resolution', () => {
  equal(resolveMediaSrcValue('a&amp;b.png', '/tmp/media/'), '/tmp/media/a%26b.png');
  equal(resolveMediaSrcValue('a&quot;b.png', '/tmp/media/'), '/tmp/media/a%22b.png');
});

section('media url · html rewriting');

test('only <img src> is rewritten; anchors, cloze and sound tags survive', () => {
  const html =
    '<p>{{c1::答案}}</p>[sound:beep.mp3]<a href="page.html">link</a>' +
    '<img src="foo.png" alt="x">';
  const out = resolveMediaInHtml(html, '/tmp/media/');
  ok(out.includes('<p>{{c1::答案}}</p>'), 'cloze syntax must be untouched');
  ok(out.includes('[sound:beep.mp3]'), 'sound tags must be untouched');
  ok(out.includes('<a href="page.html">link</a>'), 'anchors must be untouched');
  ok(out.includes('src="/tmp/media/foo.png"'), 'relative image should resolve');
});

test('single-quoted attributes are preserved with their original quote style', () => {
  const out = resolveMediaInHtml("<img src='foo bar.png'>", '/tmp/media/');
  ok(out.includes("src='/tmp/media/foo%20bar.png'"), `unexpected output: ${out}`);
});

test('already-absolute and data images are left byte-for-byte intact', () => {
  const html = '<img src="https://cdn.example.com/a.png"><img src="data:image/png;base64,AA">';
  equal(resolveMediaInHtml(html, '/tmp/media/'), html);
});

test('without a media base the html is returned unchanged', () => {
  const html = '<img src="foo.png">';
  equal(resolveMediaInHtml(html, ''), html);
  equal(resolveMediaInHtml(html, null), html);
  equal(resolveMediaInHtml('', '/tmp/media/'), '');
});

test('data-anki-media rescues an empty src inside the html', () => {
  const out = resolveMediaInHtml('<img src="" data-anki-media="safe.png">', '/tmp/media/');
  ok(out.includes('/tmp/media/safe.png'), `unexpected output: ${out}`);
});

test('rewriting is idempotent (a second pass must not double-encode)', () => {
  const html = '<img src="图片 1.png"><img src="a&amp;b.png">';
  const once = resolveMediaInHtml(html, BASE);
  const twice = resolveMediaInHtml(once, BASE);
  equal(twice, once);
});

section('media url · base extraction fallback');

test('extractMediaBaseUrlFromHtml finds the collection.media prefix', () => {
  const html = `<img src="${BASE}foo.png">`;
  equal(extractMediaBaseUrlFromHtml(html), BASE);
});

test('extractMediaBaseUrlFromHtml falls back to the image directory', () => {
  equal(
    extractMediaBaseUrlFromHtml('<img src="file:///Users/me/somewhere/foo.png">'),
    'file:///Users/me/somewhere/'
  );
});

test('extractMediaBaseUrlFromHtml ignores non-file sources and empty input', () => {
  equal(extractMediaBaseUrlFromHtml(null, undefined, ''), '');
  equal(extractMediaBaseUrlFromHtml('<img src="https://example.com/a.png">'), '');
  equal(extractMediaBaseUrlFromHtml('<p>no images here</p>'), '');
});
