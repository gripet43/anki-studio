#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""在真实浏览器里跑「编辑器 → 字段」的 DOM 往返断言（可选，不进门禁）。

为什么单独有这一层：`serializeFromWysiwyg` 是**纯 DOM** 逻辑，Node 里没有 DOM 就先
没得测；而它一旦退化就是**静默丢数据**（挖空里的加粗/图片被吃掉），字符串审计只能
守住「用了 innerHTML」，守不住「拼出来的字符串对不对」。

做法：用 `frontend/node_modules` 里现成的 esbuild 把
`frontend/src/utils/wysiwygField.ts` 打成 IIFE，塞进一个静态页面，
用无头 Chrome `--dump-dom` 取回断言结果。

    python3 tests/frontend/run_browser.py

找不到 Chrome 时**跳过并返回 0**，不会把没有浏览器的机器卡住。
"""
from __future__ import annotations

import json
import html as html_mod
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FRONTEND = ROOT / "frontend"
SPEC = FRONTEND / "src" / "utils" / "wysiwygField.ts"

CHROME_CANDIDATES = (
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
)

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>wysiwygField round-trip</title>
<pre id="out">running</pre>
<script src="wf.js"></script>
<script>
  const results = [];
  const ZW = '\\u200B';
  function t(name, dom, expect, forbid) {
    const host = document.createElement('div');
    host.innerHTML = dom;
    const got = window.WF.serializeFromWysiwyg(host);
    const okExpect = expect.every((e) => got.includes(e));
    const okForbid = (forbid || []).every((f) => !got.includes(f));
    results.push({ name, got, ok: okExpect && okForbid, expect, forbid });
  }
  const pill = (ord, body, hint) =>
    '<span class="anki-cloze-pill" data-cloze-ord="' + ord + '"' +
    (hint ? ' data-cloze-hint="' + hint + '"' : '') + '>' +
    '<span class="anki-cloze-prefix" contenteditable="false">c' + ord + ':</span>' +
    '<span class="anki-cloze-body">' + body + '</span></span>' + ZW;

  t('cloze keeps <b>', pill(1, '<b>加粗答案</b>'),
    ['{{c1::<b>加粗答案</b>}}'], ['anki-cloze', '&lt;b&gt;']);
  t('cloze keeps <b> + hint', pill(2, '<b>答案</b>' + ZW + '(提示)', '提示'),
    ['{{c2::<b>答案</b>::提示}}'], ['(提示)(提示)']);
  t('cloze keeps <img>', pill(1, '<img src="paste_1.jpg">'),
    ['{{c1::<img src="paste_1.jpg">}}'], ['&lt;img']);
  t('empty cloze removed',
    '<p>前后' + pill(1, ZW) + '</p>', ['<p>前后</p>'], ['{{c1::']);
  t('plain < in cloze stays escaped', pill(1, 'a &lt; b'),
    ['{{c1::a &lt; b}}'], ['{{c1::a < b}}']);
  t('mark with only an image survives',
    '<mark style="background:#FDF3E7"><img src="a.jpg"></mark>',
    ['<img src="a.jpg">'], []);
  t('plain content untouched',
    '<p><b>粗</b><i>斜</i> 😀🔥 <mark style="background:#FDF3E7">亮</mark></p>' +
    '<p>\\\\( a^2 \\\\)</p><table style="width:100%"><tbody><tr>' +
    '<td style="border:1px solid #D0D7DE">格</td></tr></tbody></table>',
    ['<b>粗</b>', '<i>斜</i>', '😀🔥', 'background:#FDF3E7', '\\\\( a^2 \\\\)', '#D0D7DE'],
    ['anki-cloze', ZW]);
  t('zwsp stripped', '<p>a' + ZW + 'b' + ZW + '</p>', ['<p>ab</p>'], [ZW]);

  document.getElementById('out').textContent = JSON.stringify(results);
</script>
"""


def find_chrome() -> str | None:
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    return shutil.which("google-chrome") or shutil.which("chromium")


def main() -> int:
    if not SPEC.exists():
        print(f"缺少 {SPEC}")
        return 1

    chrome = find_chrome()
    if not chrome:
        print("未找到 Chrome/Chromium，跳过浏览器端往返测试")
        return 0

    node = shutil.which("node")
    if not node:
        print("未找到 node，跳过（需要 esbuild 打包）")
        return 0

    esbuild = FRONTEND / "node_modules" / "esbuild" / "lib" / "main.js"
    if not esbuild.exists():
        print("未找到 frontend/node_modules/esbuild，先 cd frontend && npm install")
        return 1

    tmp = Path(tempfile.mkdtemp(prefix="wysiwyg_rt_"))
    try:
        build = (
            "const e=require(process.argv[1]);"
            "e.buildSync({entryPoints:[process.argv[2]],bundle:true,format:'iife',"
            "globalName:'WF',outfile:process.argv[3],target:['es2020']});"
        )
        subprocess.run(
            [node, "-e", build, str(esbuild), str(SPEC), str(tmp / "wf.js")],
            check=True,
            capture_output=True,
        )
        (tmp / "page.html").write_text(PAGE, encoding="utf-8")

        proc = subprocess.run(
            [
                chrome,
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                "--dump-dom",
                (tmp / "page.html").as_uri(),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )
        match = re.search(r'<pre id="out">([\s\S]*?)</pre>', proc.stdout)
        if not match:
            print("未能从浏览器取回结果：")
            print(proc.stdout[:1200] or proc.stderr[:1200])
            return 1
        results = json.loads(html_mod.unescape(match.group(1)))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    failed = [r for r in results if not r["ok"]]
    for r in results:
        if r["ok"]:
            print(f"  ok   {r['name']}")
        else:
            print(f"  FAIL {r['name']}")
            print(f"       got   : {r['got']}")
            print(f"       expect: {r['expect']}  forbid: {r['forbid']}")
    if failed:
        print(f"\n浏览器往返测试失败：{len(failed)}/{len(results)}")
        return 1
    print(f"\n浏览器往返测试全部通过（{len(results)} 项）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
