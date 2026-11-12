# -*- coding: utf-8 -*-
"""
Anki Studio — Shared Media Path Resolution & Storage Normalization Helpers
Resolves relative Anki media filenames (`<img src="foo.png">`) to `file:///.../collection.media/foo.png`
for WebView preview & WYSIWYG editing, and normalizes `file://` media URIs back into portable
Anki relative filenames (`src="foo.png"`) before saving notes to SQLite.
"""

from __future__ import annotations

import html
from pathlib import Path
import re
import urllib.parse
import urllib.request

IMG_TAG_RE = re.compile(r"<img\b[^>]*>", flags=re.I)
IMG_SRC_ATTR_RE = re.compile(
    r'(\s|["\'])(src\s*=\s*)(?:(["\'])([^"\']*)\3|([^\s"\'=<>`]+))',
    flags=re.I,
)
DATA_ANKI_MEDIA_RE = re.compile(r'\bdata-anki-media\s*=\s*(["\'])([^"\']+)\1', flags=re.I)


def get_media_dir(col) -> str:
    """Safely resolves `col.media.dir()` as a string, or returns empty string."""
    if col is None:
        return ""
    try:
        if hasattr(col, "media") and hasattr(col.media, "dir"):
            return str(col.media.dir() or "").strip()
    except Exception:
        pass
    return ""


def get_media_base_url(media_dir: str) -> str:
    """Returns trailing-slash `file:///.../collection.media/` URI for WebView relative resolution."""
    if not media_dir:
        return ""
    try:
        uri = Path(media_dir).resolve().as_uri()
        return uri if uri.endswith("/") else f"{uri}/"
    except Exception:
        clean = media_dir.replace("\\", "/").rstrip("/")
        return f"file://{clean}/" if clean else ""


def _path_from_file_uri(uri: str) -> str:
    parsed = urllib.parse.urlparse(uri)
    if parsed.scheme.lower() != "file":
        return ""
    if parsed.netloc not in ("", "localhost"):
        return ""
    return urllib.request.url2pathname(parsed.path)


def _to_file_uri(media_dir: str, rel_name: str) -> str:
    clean_name = rel_name[2:] if rel_name.startswith("./") else rel_name
    abs_path = Path(media_dir) / clean_name
    try:
        return abs_path.resolve().as_uri()
    except Exception:
        return f"file://{abs_path}"


def resolve_media_img_src_for_webview(raw_html: str, media_dir: str) -> str:
    """
    Rewrites relative `<img src="...">` attributes in `raw_html` to `file:///.../collection.media/...`
    without altering Cloze syntax (`{{c1::...}}`) or `[sound:...]` tags.
    Also rescues stale cross-machine `file://` URLs if `data-anki-media` exists in `media_dir`.
    """
    if not raw_html or not media_dir:
        return raw_html or ""

    def _tag_replacer(tag_match):
        tag = tag_match.group(0)

        def _attr_replacer(src_match):
            lead, eq_part, quote, quoted_val, unquoted_val = src_match.groups()
            raw_src = quoted_val if quote is not None else unquoted_val
            src_clean = html.unescape(str(raw_src or "").strip())
            q = quote or '"'
            if not src_clean:
                return src_match.group(0)

            lower_src = src_clean.lower()
            if lower_src.startswith(("http://", "https://", "data:", "blob:", "/")):
                return src_match.group(0)

            if lower_src.startswith("file://"):
                local_p = _path_from_file_uri(src_clean)
                if local_p and Path(local_p).exists():
                    return src_match.group(0)
                media_m = DATA_ANKI_MEDIA_RE.search(tag)
                if media_m:
                    fallback_name = urllib.parse.unquote(html.unescape(media_m.group(2).strip()))
                    candidate = Path(media_dir) / fallback_name
                    if fallback_name and candidate.exists():
                        uri = _to_file_uri(media_dir, fallback_name)
                        return f'{lead}{eq_part}{q}{html.escape(uri, quote=True)}{q}'
                return src_match.group(0)

            decoded_name = urllib.parse.unquote(src_clean)
            uri = _to_file_uri(media_dir, decoded_name)
            return f'{lead}{eq_part}{q}{html.escape(uri, quote=True)}{q}'

        return IMG_SRC_ATTR_RE.sub(_attr_replacer, tag, count=1)

    return IMG_TAG_RE.sub(_tag_replacer, raw_html)


def normalize_media_html_for_storage(raw_html: str, media_dir: str) -> str:
    """
    Normalizes `<img src="file:///.../collection.media/<name>">` back into portable Anki
    relative filenames (`<img src="<name>">`) before writing fields into Anki's SQLite database.
    """
    if not raw_html or not media_dir or "file://" not in raw_html.lower():
        return raw_html or ""

    try:
        resolved_media_root = Path(media_dir).resolve()
    except Exception:
        resolved_media_root = Path(media_dir)

    def _tag_replacer(tag_match):
        tag = tag_match.group(0)

        def _attr_replacer(src_match):
            lead, eq_part, quote, quoted_val, unquoted_val = src_match.groups()
            raw_src = quoted_val if quote is not None else unquoted_val
            src_clean = html.unescape(str(raw_src or "").strip())
            q = quote or '"'
            if not src_clean.lower().startswith("file://"):
                return src_match.group(0)

            local_p = _path_from_file_uri(src_clean)
            if not local_p:
                return src_match.group(0)

            try:
                rel_path = Path(local_p).resolve().relative_to(resolved_media_root)
                rel_name = rel_path.as_posix()
            except Exception:
                return src_match.group(0)

            if not rel_name or rel_name == ".":
                return src_match.group(0)
            return f'{lead}{eq_part}{q}{html.escape(rel_name, quote=True)}{q}'

        return IMG_SRC_ATTR_RE.sub(_attr_replacer, tag, count=1)

    return IMG_TAG_RE.sub(_tag_replacer, raw_html)


# ---------------------------------------------------------------------------
# Anki 原生 Image Occlusion
# ---------------------------------------------------------------------------

IO_CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)\}\}", flags=re.S)
IO_RECT_RE = re.compile(r"<rect\b([^>]*?)/?>", flags=re.I)
IO_ATTR_RE = re.compile(r'([\w:-]+)\s*=\s*"([^"]*)"')


def render_native_image_occlusion(note) -> tuple[str, str, str]:
    """把 Anki 原生 Image Occlusion 笔记转成插件自己的静态遮罩结构。

    原生数据形如 ``Occlusion = {{c1::<svg …><rect …/></svg>}}`` 配 ``Image`` 字段。
    Anki 官方界面把 SVG 转义进 ``data-cloze``，再交给
    ``anki.imageOcclusion.setup()`` 画到 canvas；本插件的 WebView 不执行模板里的
    script，所以这里直接把 rect 的 viewBox 坐标（0–100）当作百分比，生成
    ``.anki-io-wrap`` + ``span.anki-io-rect``，复用既有的静态遮罩渲染链路。

    返回 ``(front, back, title)``；不是原生遮挡卡时返回三个空串。
    """
    try:
        image = (note["Image"] or "").strip()
        occlusion = note["Occlusion"] or ""
        header = (note["Header"] or "").strip()
    except (KeyError, TypeError, IndexError):
        return "", "", ""

    if not image or not occlusion:
        return "", "", header

    spans = []
    for cloze in IO_CLOZE_RE.finditer(occlusion):
        num = cloze.group(1)
        for rect in IO_RECT_RE.finditer(cloze.group(2)):
            attrs = dict(IO_ATTR_RE.findall(rect.group(1)))
            try:
                x = float(attrs.get("x", 0))
                y = float(attrs.get("y", 0))
                width = float(attrs.get("width", 0))
                height = float(attrs.get("height", 0))
            except (TypeError, ValueError):
                continue
            if width <= 0 or height <= 0:
                continue
            spans.append(
                f'<span class="anki-io-rect" data-io-rect="{num}" '
                f'style="position:absolute;left:{x:.2f}%;top:{y:.2f}%;'
                f'width:{width:.2f}%;height:{height:.2f}%;">{{{{c{num}::{num}}}}}</span>'
            )

    if not spans:
        return "", "", header

    front = (
        '<div class="anki-io-wrap" data-io-mode="hide-all" '
        'style="position:relative;display:inline-block;max-width:100%;line-height:0;'
        'border-radius:12px;overflow:hidden;">'
        f"{image}{''.join(spans)}</div>"
    )
    # 答案面直接给原图：原生 IO 答对后是移除全部遮罩
    return front, image, header


# ---------------------------------------------------------------------------
# 走 Anki 模板引擎渲染背面
# ---------------------------------------------------------------------------

SCRIPT_BLOCK_RE = re.compile(r"<script\b[^>]*>[\s\S]*?</script\s*>", flags=re.I)
STYLE_BLOCK_RE = re.compile(r"<style\b[^>]*>[\s\S]*?</style\s*>", flags=re.I)
HINT_ANCHOR_RE = re.compile(
    r'<a\b[^>]*\bclass\s*=\s*["\']?hint\b[^>]*>[\s\S]*?</a\s*>', flags=re.I
)
HINT_ELEMENT_RE = re.compile(r'\bclass\s*=\s*["\']?hint\b', flags=re.I)
STYLE_ATTR_RE = re.compile(r"""\s+style\s*=\s*(?:"[^"]*"|'[^']*')""", flags=re.I)
DISPLAY_NONE_RE = re.compile(r"display\s*:\s*none", flags=re.I)
INLINE_HANDLER_RE = re.compile(
    r"""\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)""", flags=re.I
)
ANY_TAG_RE = re.compile(r"<[^>]+>")


def sanitize_rendered_card_html(raw_html: str) -> str:
    """把 Anki 模板渲出的 HTML 清理成能安全塞进 React innerHTML 的形态。

    三类必须清掉的东西，都是模板写给 Anki 桌面复习界面用的：

    1. ``<script>``：卡片脚本。``dangerouslySetInnerHTML`` 本来就不执行它，留着只是脏
       HTML；而真要执行，等于让第三方卡包在本插件的特权 WebView 里跑任意 JS，
       那个 WebView 手里握着 pycmd 桥。
    2. ``<style>``：模板 CSS 统一在 :func:`render_native_card_html` 里说明为什么不注入。
    3. ``{{hint:字段}}`` 脚手架：``<a class=hint>标签</a>`` 加一个
       ``<div class=hint style="display:none">内容</div>``，原本靠上面那段脚本点开。
       脚本不跑就没有展开入口，所以直接把内容露出来，标签丢掉。

    顺带清掉 ``onclick`` 之类内联事件属性，免得用户一点就抛 ReferenceError。
    最后交给 :func:`normalize_rendered_whitespace` 压平模板缩进。
    """
    if not raw_html:
        return ""

    text = SCRIPT_BLOCK_RE.sub("", raw_html)
    text = STYLE_BLOCK_RE.sub("", text)
    text = HINT_ANCHOR_RE.sub("", text)

    def _fix_tag(tag_match):
        tag = tag_match.group(0)
        if HINT_ELEMENT_RE.search(tag) and DISPLAY_NONE_RE.search(tag):
            tag = STYLE_ATTR_RE.sub("", tag, count=1)
        return INLINE_HANDLER_RE.sub("", tag)

    return normalize_rendered_whitespace(ANY_TAG_RE.sub(_fix_tag, text))


NEWLINE_RUN_RE = re.compile(r"\s*\n\s*")
MULTI_SPACE_RE = re.compile(r"[ \t]{2,}")


def normalize_rendered_whitespace(raw_html: str) -> str:
    """把模板缩进压平。

    模板排版留下的成片换行，在普通 HTML 里会被折叠成空白，但本插件的正文容器用
    ``white-space: pre-wrap``（为了保留纯文本卡里的手动换行）。两者一凑，模板里
    ``\\n\\n\\n`` 的缩进就变成背面上好几行空行。这里把换行统一压成一个空格：
    不会把相邻的行内元素粘成 ``foobar``，也不影响 ``pre-wrap`` 之下的正常排版。
    """
    if not raw_html:
        return ""
    text = NEWLINE_RUN_RE.sub(" ", raw_html)
    return MULTI_SPACE_RE.sub(" ", text).strip()


def render_native_card_html(card) -> tuple[str, list[str]]:
    """用 Anki 自己的模板引擎渲染答案面，返回 ``(html, audio_files)``。

    为什么非走原生渲染不可：插件早期把 ``fields[1]`` 当背面正文，只要卡包不是
    “两个字段”的形态，多出来的释义、例句、词源……在背诵界面上就整段消失
    （编辑界面全都在，所以肉眼很难立刻归因）。模板引擎会把 ``{{字段}}``、
    ``{{#字段}}`` 条件段、``{{FrontSide}}``、``{{hint:}}`` 全部算完，那才是用户
    心里“这张卡的背面”。

    ``browser=True`` 的理由：它只影响 ``card_did_render`` 钩子是否触发（那个钩子
    是给真正的复习界面用的，逐个序列化整条队列时会误伤别的插件），渲染结果本身
    不变——拿 ``UVBasic-English`` 卡包 997 张卡逐个比对过，``browser`` 取 True/False
    输出完全一致。

    模板 CSS **故意不注入**，两个原因：
    1. 第三方卡包的 ``css`` 字段常是遗留 HTML 大杂烩（自带 ``</style>``、``<style>``、
       ``<script>``、``html`` 注释），塞进 React 会直接撑破样式表，剩下的片段变成
       可见的乱码文本。
    2. 那套 CSS 是按白底设计的（``background-color:#fff``），落到本插件的深色主题里
       就是一片刺眼白块，还会把 ``.card`` / ``.section`` 这类通用类名泄漏到全站。
    正文结构保留，视觉交给插件自己的设计系统。
    """
    if card is None:
        return "", []
    try:
        output = card.render_output(browser=True)
    except Exception:
        return "", []

    answer = sanitize_rendered_card_html(getattr(output, "answer_text", "") or "")

    audio: list[str] = []
    for tag in getattr(output, "answer_av_tags", None) or []:
        name = str(getattr(tag, "filename", "") or "").strip()
        if name and name not in audio:
            audio.append(name)
    return answer, audio
