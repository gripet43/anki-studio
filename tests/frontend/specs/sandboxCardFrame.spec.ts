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

test('buildSandboxSrcDoc forwards inner vertical scroller detection and sticky horizontal preventDefault', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'scroll-1',
    initialBody: '<div style="overflow-y:auto;height:80px">scroll</div>',
    cssText: '',
    isDark: false,
    initialZoom: 1,
  });
  assert.ok(
    doc.includes('function hasInnerVerticalScroller(target, rawDeltaY)'),
    'sandbox iframe script must detect nested vertical scrollers'
  );
  assert.ok(
    doc.includes('hasInnerVScroll: innerVScroll'),
    'sandbox wheel message must forward hasInnerVScroll flag'
  );
  assert.ok(
    doc.includes('horizPreventUntil'),
    'sandbox wheel handler must guard mid-swipe wobble with sticky horizPreventUntil'
  );
});

test('buildSandboxSrcDoc provides anki.imageOcclusion shim supporting rect/ellipse/polygon and toggle', () => {
  const doc = buildSandboxSrcDoc({
    cardId: 'io-sandbox-1',
    initialBody:
      '<div style="display:none">' +
      '<div class="cloze" data-ordinal="1" data-shape="rect" data-left=".0000" data-top="0.3297" data-width=".0339" data-height="0.3028" data-occludeInactive="1"></div>' +
      '<div class="cloze-inactive" data-ordinal="2" data-shape="ellipse" data-left="0.2" data-top="0.2" data-rx="0.1" data-ry="0.05" data-occludeInactive="1"></div>' +
      '<div class="cloze-highlight" data-ordinal="1" data-shape="polygon" data-left="0.5" data-top="0.5" data-points="0.1,0.1 0.3,0.1 0.2,0.3" data-occludeInactive="1"></div>' +
      '</div>' +
      '<div id="err"></div>' +
      '<div id="image-occlusion-container"><img src="http://127.0.0.1:8975/test.jpg"><canvas id="image-occlusion-canvas"></canvas></div>' +
      '<div><button id="toggle">切换遮罩</button></div>',
    cssText:
      '#image-occlusion-canvas { --active-shape-color: #ff8e8e; --inactive-shape-color: #ffeba2; --active-shape-border: 1px #212121; }',
    isDark: false,
    initialZoom: 1,
  });

  assert.ok(doc.includes('#image-occlusion-container'), 'sandbox must include IO container layout CSS');
  assert.ok(doc.includes('#image-occlusion-canvas'), 'sandbox must include IO canvas overlay CSS');
  assert.ok(doc.includes('window.anki.imageOcclusion'), 'sandbox must expose window.anki.imageOcclusion shim');

  // Extract and execute the main runtime script in node:vm to guard against syntax/escape regressions
  const scripts = Array.from(doc.matchAll(/<script>([\s\S]*?)<\/script>/g)).map((m) => m[1]);
  const mainScript = scripts.find((s) => s.includes('window.anki.imageOcclusion'));
  assert.ok(mainScript, 'must find main sandbox runtime script containing imageOcclusion shim');

  const drawCalls: Array<{ op: string; args: unknown[]; fillStyle?: string; strokeStyle?: string }> = [];
  const fakeCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
    setTransform: () => {},
    clearRect: (...args: unknown[]) => drawCalls.push({ op: 'clearRect', args }),
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fillRect: (...args: unknown[]) =>
      drawCalls.push({ op: 'fillRect', args, fillStyle: fakeCtx.fillStyle }),
    strokeRect: (...args: unknown[]) =>
      drawCalls.push({ op: 'strokeRect', args, strokeStyle: fakeCtx.strokeStyle }),
    beginPath: () => {},
    ellipse: (...args: unknown[]) => drawCalls.push({ op: 'ellipse', args }),
    moveTo: () => {},
    lineTo: (...args: unknown[]) => drawCalls.push({ op: 'lineTo', args }),
    closePath: () => {},
    fill: () => drawCalls.push({ op: 'fill', args: [], fillStyle: fakeCtx.fillStyle }),
    stroke: () => drawCalls.push({ op: 'stroke', args: [], strokeStyle: fakeCtx.strokeStyle }),
    measureText: () => ({ width: 20 }),
    fillText: () => {},
  };

  const fakeImg = {
    complete: true,
    naturalWidth: 1000,
    naturalHeight: 500,
    clientWidth: 1000,
    clientHeight: 500,
    addEventListener: () => {},
  };
  const fakeCanvas = {
    width: 0,
    height: 0,
    clientWidth: 1000,
    clientHeight: 500,
    getContext: () => fakeCtx,
  };
  const toggleListeners: Array<() => void> = [];
  const toggleAttrs: Record<string, string> = {};
  const fakeToggle = {
    style: { display: '' },
    getAttribute: (k: string) => toggleAttrs[k] || null,
    setAttribute: (k: string, v: string) => {
      toggleAttrs[k] = v;
    },
    addEventListener: (ev: string, fn: () => void) => {
      if (ev === 'click') toggleListeners.push(fn);
    },
  };
  const fakeErr = { innerHTML: 'stale error' };
  const shapeNodes: Record<string, Array<{ dataset: Record<string, string> }>> = {
    '.cloze': [
      {
        dataset: {
          ordinal: '1',
          shape: 'rect',
          left: '.0000',
          top: '0.3297',
          width: '.0339',
          height: '0.3028',
          occludeinactive: '1',
        },
      },
    ],
    '.cloze-inactive': [
      {
        dataset: {
          ordinal: '2',
          shape: 'ellipse',
          left: '0.2',
          top: '0.2',
          rx: '0.1',
          ry: '0.05',
          occludeinactive: '1',
        },
      },
    ],
    '.cloze-highlight': [
      {
        dataset: {
          ordinal: '1',
          shape: 'polygon',
          left: '0.5',
          top: '0.5',
          points: '0.1,0.1 0.3,0.1 0.2,0.3',
          occludeinactive: '1',
        },
      },
    ],
  };

  const fakeWindow: Record<string, unknown> = {
    devicePixelRatio: 1,
    addEventListener: () => {},
    getComputedStyle: () => ({
      getPropertyValue: (prop: string) => {
        const map: Record<string, string> = {
          '--active-shape-color': '#ff8e8e',
          '--inactive-shape-color': '#ffeba2',
          '--highlight-shape-color': '#ff8e8e00',
          '--active-shape-border': '1px #212121',
          '--inactive-shape-border': '1px #212121',
          '--highlight-shape-border': '1px #ff8e8e',
        };
        return map[prop] || '';
      },
    }),
  };
  const fakeDocument = {
    body: { scrollHeight: 500, offsetHeight: 500 },
    documentElement: { scrollHeight: 500 },
    getElementById: (id: string) => {
      if (id === 'image-occlusion-canvas') return fakeCanvas;
      if (id === 'image-occlusion-container') return { querySelector: () => fakeImg };
      if (id === 'toggle') return fakeToggle;
      if (id === 'err') return fakeErr;
      if (id === 'qa') return { scrollHeight: 500, offsetHeight: 500, style: {}, getBoundingClientRect: () => ({ height: 500 }) };
      return null;
    },
    querySelector: (sel: string) => (sel === '[data-occludeinactive="1"]' ? shapeNodes['.cloze'][0] : null),
    querySelectorAll: (sel: string) => shapeNodes[sel] || [],
    addEventListener: () => {},
  };

  const ctx = vm.createContext({
    window: fakeWindow,
    document: fakeDocument,
    parent: { postMessage: () => {} },
    requestAnimationFrame: (fn: () => void) => fn(),
    setTimeout: () => 0,
    Array,
    Object,
    String,
    Number,
    Math,
    Boolean,
    Date,
    RegExp,
    parseFloat,
    parseInt,
    isNaN,
  });
  vm.runInContext(mainScript, ctx);

  const ankiObj = fakeWindow.anki as { imageOcclusion: { setup: () => void } };
  assert.ok(ankiObj && ankiObj.imageOcclusion && typeof ankiObj.imageOcclusion.setup === 'function');
  ankiObj.imageOcclusion.setup();

  assert.equal(fakeErr.innerHTML, '', 'setup() must clear any #err content');
  assert.equal(fakeCanvas.width, 1000);
  assert.equal(fakeCanvas.height, 500);
  const fillRect = drawCalls.find((c) => c.op === 'fillRect');
  assert.ok(fillRect, 'must draw active rect mask');
  assert.equal(fillRect.fillStyle, '#ff8e8e');
  assert.equal(Number((fillRect.args[0] as number).toFixed(2)), 0);
  assert.equal(Number((fillRect.args[1] as number).toFixed(2)), 164.85);
  assert.equal(Number((fillRect.args[2] as number).toFixed(2)), 33.9);
  assert.equal(Number((fillRect.args[3] as number).toFixed(2)), 151.4);
  assert.ok(drawCalls.some((c) => c.op === 'ellipse'), 'must draw inactive ellipse mask');
  assert.ok(drawCalls.some((c) => c.op === 'lineTo'), 'must draw highlight polygon mask');

  // Clicking #toggle hides masks and clears canvas; clicking again restores masks
  assert.equal(toggleListeners.length, 1);
  drawCalls.length = 0;
  toggleListeners[0]();
  assert.ok(drawCalls.some((c) => c.op === 'clearRect'));
  assert.equal(drawCalls.some((c) => c.op === 'fillRect'), false, 'toggle off must hide rect masks');

  drawCalls.length = 0;
  toggleListeners[0]();
  assert.ok(drawCalls.some((c) => c.op === 'fillRect'), 'toggle back on must redraw rect masks');
});
