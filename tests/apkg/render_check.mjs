#!/usr/bin/env node
// ============================================================================
// Anki Studio — apkg 测试的前端渲染检查器
//
// 输入：一个 JSON 文件，内容是从真实 .apkg 抽样出来的
//   [{ deck, model, card, frontHtml, backHtml }, ...]
// 处理：用 esbuild（复用 frontend/node_modules）把前端真实使用的
//   renderMathAndRichHtml 打包成 CJS，然后逐条渲染抽样 HTML。
// 输出：最后一行为 JSON { issues: [{check, detail}], checked: N }
//
// 断言的是「后端 HTML 已经正确、前端渲染别把它弄坏」：
//   - 二次转义实体（`&amp;nbsp;` 会显示成字面量 &nbsp; —— PCSI 真实踩过）
//   - 公式分隔符/LaTeX 命令残留（渲染失败会原样漏出）
//   - 模板占位符、<script>、[sound:] 残留、undefined/NaN
// ============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADDON_ROOT = path.resolve(HERE, '..', '..');
const FRONTEND_MODULES = path.join(ADDON_ROOT, 'frontend', 'node_modules');
const ESBUILD_ENTRY = path.join(FRONTEND_MODULES, 'esbuild', 'lib', 'main.js');
const MATH_RENDERER = path.join(ADDON_ROOT, 'frontend', 'src', 'utils', 'mathRenderer');

const DOUBLE_ESCAPED_RE = /&amp;(?:nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i;
const TEMPLATE_PLACEHOLDER_RE = /\{\{[^{}]{1,120}\}\}/;
const SCRIPT_TAG_RE = /<script\b/i;
const SOUND_TAG_RE = /\[sound:[^\]]+\]/i;
const NON_FINITE_RE = /\b(?:undefined|NaN|Infinity)\b/;
const LATEX_CMD_RE = /\\(?:frac|sqrt|pi|alpha|beta|gamma|theta|sum|int|cdot|times|le|ge|ne)\b/;
// 迷你渲染器尚未实现的命令：出现即说明用户会看到裸 LaTeX 源码。
const UNSUPPORTED_LATEX_RE =
  /\\(?:ce|underset|overset|overline|underline|widehat|widetilde|vec|mathbb|mathcal|displaystyle|textstyle|substack|xrightarrow|xleftarrow|begin|end)\b/;
const MATH_DELIM_RE = /\[\$\]|\\\(|\\\[|\$\$/;

function fail(list, check, detail) {
  list.push({ check, detail });
}

function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    console.error('usage: node render_check.mjs <payload.json>');
    process.exit(2);
  }
  if (!fs.existsSync(ESBUILD_ENTRY)) {
    console.error('esbuild missing; run `cd frontend && npm install` first');
    process.exit(2);
  }

  let esbuild;
  try {
    esbuild = createRequire(import.meta.url)(ESBUILD_ENTRY);
  } catch (error) {
    console.error('failed to load esbuild:', error);
    process.exit(2);
  }

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-apkg-render-'));
  const entryFile = path.join(outDir, 'entry.ts');
  const outFile = path.join(outDir, 'bundle.cjs');
  try {
    fs.writeFileSync(
      entryFile,
      `import { renderMathAndRichHtml, formatCardPreviewHtml } from ${JSON.stringify(MATH_RENDERER)};\n` +
        'export { renderMathAndRichHtml, formatCardPreviewHtml };\n',
      'utf-8'
    );
    esbuild.buildSync({
      entryPoints: [entryFile],
      outfile: outFile,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      logLevel: 'warning',
      nodePaths: [FRONTEND_MODULES],
    });
  } catch (error) {
    console.error('failed to bundle mathRenderer:', error);
    process.exit(2);
  }

  let renderer;
  try {
    renderer = createRequire(import.meta.url)(outFile);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  const samples = JSON.parse(fs.readFileSync(payloadPath, 'utf-8'));
  const issues = [];
  let checked = 0;

  for (const sample of samples) {
    for (const side of ['frontHtml', 'backHtml']) {
      const raw = sample[side] || '';
      checked += 1;
      const label = `${sample.deck} / ${sample.model} / card ${sample.card} / ${side}`;
      let html;
      try {
        html = renderer.renderMathAndRichHtml(raw);
      } catch (error) {
        fail(issues, 'frontend:render-crash', `${label}: ${error}`);
        continue;
      }
      if (raw.trim() && !String(html || '').trim()) {
        fail(issues, 'frontend:render-empty', `${label}: 渲染结果为空`);
        continue;
      }
      if (DOUBLE_ESCAPED_RE.test(html)) {
        fail(issues, 'frontend:double-escaped-entity', `${label}: 出现二次转义实体（会显示成 &nbsp; 之类字面量）`);
      }
      if (TEMPLATE_PLACEHOLDER_RE.test(html)) {
        fail(issues, 'frontend:template-placeholder', `${label}: 渲染后仍残留模板占位符`);
      }
      if (SCRIPT_TAG_RE.test(html)) {
        fail(issues, 'frontend:script-leak', `${label}: 渲染后残留 <script>`);
      }
      if (SOUND_TAG_RE.test(html)) {
        fail(issues, 'frontend:sound-tag', `${label}: 渲染后残留 [sound:]`);
      }
      if (NON_FINITE_RE.test(html)) {
        fail(issues, 'frontend:non-finite', `${label}: 出现 undefined/NaN/Infinity`);
      }
      if (MATH_DELIM_RE.test(raw) && LATEX_CMD_RE.test(html)) {
        fail(issues, 'frontend:unrendered-latex', `${label}: 含公式的输入渲染后仍残留 LaTeX 命令`);
      }
      if (MATH_DELIM_RE.test(raw) && UNSUPPORTED_LATEX_RE.test(html)) {
        fail(issues, 'frontend:unsupported-latex', `${label}: 公式里含未支持的 LaTeX 命令（会显示裸源码）`);
      }
      if (MATH_DELIM_RE.test(raw) && /\\(\?:\(|\)|\[|\])/.test(html)) {
        fail(issues, 'frontend:math-delimiter-leftover', `${label}: 渲染后残留 \\( \\) 公式分隔符`);
      }
      // 卡片库/表格走的紧凑摘要同样不能出现二次转义实体
      if (side === 'frontHtml') {
        try {
          const preview = renderer.formatCardPreviewHtml(raw);
          if (DOUBLE_ESCAPED_RE.test(preview)) {
            fail(issues, 'frontend:preview-double-escaped', `${label}: formatCardPreviewHtml 出现二次转义实体`);
          }
        } catch (error) {
          fail(issues, 'frontend:preview-crash', `${label}: ${error}`);
        }
      }
    }
  }

  console.log(JSON.stringify({ checked, issues }));
}

main();
