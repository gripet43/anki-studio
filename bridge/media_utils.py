# -*- coding: utf-8 -*-
"""
Anki Studio — Shared Media Path Resolution & Storage Normalization Helpers
Resolves relative Anki media filenames (`<img src="foo.png">`) to `file:///.../collection.media/foo.png`
for WebView preview & WYSIWYG editing, and normalizes `file://` media URIs back into portable
Anki relative filenames (`src="foo.png"`) before saving notes to SQLite.
"""

from __future__ import annotations

import html
from functools import lru_cache
from pathlib import Path
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, NamedTuple, Tuple

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


def get_media_http_base_url(mw=None) -> str:
    """解析 Anki 内置本地媒体服务器 HTTP 根路径。

    供 ``sandbox="allow-scripts"`` 的跨源 ``srcdoc`` iframe 加载图片、音频与
    ``@font-face`` 字体，避免不透明 origin 下 ``file://`` 子资源被 Chromium 拦截。
    """
    target_mw = mw
    if target_mw is None:
        try:
            import aqt

            target_mw = getattr(aqt, "mw", None)
        except Exception:
            target_mw = None
    if target_mw is None:
        return ""
    try:
        ms = getattr(target_mw, "mediaServer", None)
        if ms is not None and hasattr(ms, "getPort"):
            port = int(ms.getPort() or 0)
            if port > 0:
                loopback = ".".join(("127", "0", "0", "1"))
                return f"http://{loopback}:{port}/"
    except Exception:
        pass
    return ""


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


def _to_http_uri(http_base_url: str, rel_name: str) -> str:
    base = str(http_base_url or "").strip().rstrip("/")
    clean_name = rel_name[2:] if rel_name.startswith("./") else rel_name
    clean_name = clean_name.lstrip("/")
    quoted = urllib.parse.quote(clean_name, safe="/:@!$&'()*+,;=-._~")
    return f"{base}/{quoted}" if base else clean_name


def resolve_media_img_src_for_webview(
    raw_html: str, media_dir: str, http_base_url: str = ""
) -> str:
    """
    Rewrites relative `<img src="...">` attributes in `raw_html` to `file:///.../collection.media/...`
    (or local HTTP media server URL when `http_base_url` is provided) without altering Cloze syntax
    (`{{c1::...}}`) or `[sound:...]` tags.
    Also rescues stale cross-machine `file://` URLs if `data-anki-media` exists in `media_dir`.
    """
    if not raw_html or (not media_dir and not http_base_url):
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
                    if http_base_url and media_dir:
                        try:
                            rel_p = (
                                Path(local_p)
                                .resolve()
                                .relative_to(Path(media_dir).resolve())
                                .as_posix()
                            )
                            uri = _to_http_uri(http_base_url, rel_p)
                            return f'{lead}{eq_part}{q}{html.escape(uri, quote=True)}{q}'
                        except Exception:
                            pass
                    return src_match.group(0)
                media_m = DATA_ANKI_MEDIA_RE.search(tag)
                if media_m and media_dir:
                    fallback_name = urllib.parse.unquote(html.unescape(media_m.group(2).strip()))
                    candidate = Path(media_dir) / fallback_name
                    if fallback_name and candidate.exists():
                        uri = (
                            _to_http_uri(http_base_url, fallback_name)
                            if http_base_url
                            else _to_file_uri(media_dir, fallback_name)
                        )
                        return f'{lead}{eq_part}{q}{html.escape(uri, quote=True)}{q}'
                return src_match.group(0)

            decoded_name = urllib.parse.unquote(src_clean)
            uri = (
                _to_http_uri(http_base_url, decoded_name)
                if http_base_url
                else _to_file_uri(media_dir, decoded_name)
            )
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
# 走 Anki 模板引擎渲染背面 & 日语振假名 / MDX 词典清洗
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
# Anki 把 {{字段}} 里的音频渲染成 `[anki:play:a:0]` 这种「重播按钮」占位符，等着它自己的
# 复习界面把它换成按钮。我们不复刻那个按钮（音频走 audioFiles 自己的播放条），留着就是
# 页面上肉眼可见的一串 `[anki:play:a:0]`，所以直接删掉。
MEDIA_PLACEHOLDER_RE = re.compile(r"\[anki:(?:play|tts):[^\]]*\]", flags=re.I)
SOUND_TAG_RE = re.compile(r"\[sound:([^\]]+)\]")
CLOZE_RE = re.compile(r"\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}")

# 日语振假名标注 ` 漢字[かんじ]` / `10[じゅう]`（仅匹配假名读音，不误伤英语音标 [ə'bændən] 或汉语拼音 [ài]）
FURIGANA_BRACKET_RE = re.compile(
    r" ?([0-9\u4e00-\u9fff\u3400-\u4dbf々〆ヵヶ\u3040-\u309f\u30a0-\u30ff]+)\[([\u3040-\u309f\u30a0-\u30ffー～〜・、，\s]+)\]"
)
RUBY_RT_RE = re.compile(r"<rt\b[^>]*>[\s\S]*?</rt\s*>", flags=re.I)
RUBY_RP_RE = re.compile(r"<rp\b[^>]*>[\s\S]*?</rp\s*>", flags=re.I)
# MDX 词典字段内残留的索引标记（如 HSK1-6 `Từ Điển` 开头的 `` `1`爱`4` ``）
MDX_INDEX_MARKER_RE = re.compile(r"`\d+`")

# 模板自带的 <style> / <script> 块。沙盒渲染必须原样保留它们（那正是 Track B 要执行的
# 模板脚本与样式表），但在做振假名/标记清洗时又不能把块里的内容当正文处理——
# 否则 CSS 里的 `content: "山田[やまだ]"` 会被替换成 <ruby>、脚本里的字符串也会被改。
# 统一做法：先把这些块换成占位符，处理完正文再原样拼回。
PROTECTED_BLOCK_RE = re.compile(
    r"(<script\b[^>]*>[\s\S]*?</script\s*>|<style\b[^>]*>[\s\S]*?</style\s*>)",
    flags=re.I,
)
_PROTECTED_PLACEHOLDER = "\x00anki-studio-protected-block-%d\x00"


def _protect_style_and_script_blocks(text: str) -> Tuple[str, List[str]]:
    """把 ``<style>`` / ``<script>`` 块替换成占位符，返回 ``(masked_text, blocks)``。"""
    if not text:
        return text, []
    blocks: List[str] = []

    def _replace(match: "re.Match[str]") -> str:
        blocks.append(match.group(0))
        return _PROTECTED_PLACEHOLDER % (len(blocks) - 1)

    return PROTECTED_BLOCK_RE.sub(_replace, text), blocks


def _restore_style_and_script_blocks(text: str, blocks: List[str]) -> str:
    for index, block in enumerate(blocks):
        text = text.replace(_PROTECTED_PLACEHOLDER % index, block)
    return text
# N1-N5 蓝宝书倒计时空占位符 `<span class="timer" id="s2"...></span>`
TIMER_SPAN_RE = re.compile(
    r'<div\b[^>]*>\s*<span\b[^>]*\bclass\s*=\s*["\']?timer\b[^>]*>[\s\S]*?</span\s*>\s*</div\s*>',
    flags=re.I,
)
# Anki 标准正反面分割线 `<hr id=answer>` / `<hr id="answer">`
HR_ANSWER_RE = re.compile(r'<hr\b[^>]*\bid\s*=\s*["\']?answer["\']?[^>]*>', flags=re.I)
# eggrolls-JLPT10k 正面与背面容器
MAIN_FRONTSIDE_RE = re.compile(
    r'<main\b[^>]*\bid\s*=\s*["\']?FrontSide["\']?[^>]*>[\s\S]*?</main\s*>',
    flags=re.I,
)
MAIN_BACKSIDE_RE = re.compile(
    r'<main\b[^>]*\bid\s*=\s*["\']?BackSide["\']?[^>]*>',
    flags=re.I,
)
HIDDEN_VOCAB_AUDIO_DIV_RE = re.compile(
    r'<div\b[^>]*\bclass\s*=\s*["\'][^"\']*!hidden[^"\']*["\'][^>]*>[\s\S]*?</div\s*>',
    flags=re.I,
)
JLPT_TOP_BAR_RE = re.compile(
    r'<div\b[^>]*\bclass\s*=\s*["\']?Top["\']?[^>]*>[\s\S]*?</div\s*>',
    flags=re.I,
)
JLPT_SEARCH_LINK_RE = re.compile(
    r'<a\b[^>]*\bclass\s*=\s*["\']?Search["\']?[^>]*>[\s\S]*?</a\s*>',
    flags=re.I,
)
JLPT_SENT_TYPES_SCRIPT_RE = re.compile(
    r"function\s+getType\s*\([^)]*\)\s*\{\s*return\s*\[([^\]]*)\]",
    flags=re.I,
)
JLPT_VOCAB_POS_SCRIPT_RE = re.compile(
    r"['\"]VocabPoS['\"]\s*:\s*['\"]([^'\"]*)['\"]\s*\?",
    flags=re.I,
)


def convert_furigana_to_ruby(
    raw_html: str, strip_reading: bool = False, preserve_style_blocks: bool = False
) -> str:
    """将字段内的 Anki 日语振假名语法 `` 漢字[かな]`` 转为 ``<ruby>漢字<rt>かな</rt></ruby>`` 或纯汉字，并清理 MDX 标记。

    ``preserve_style_blocks=False``（默认，供普通展示/编辑路径使用）会剥掉内嵌
    ``<style>`` / ``<script>``——字段级的样式与脚本不该漏进插件界面。

    ``preserve_style_blocks=True`` 供 Track B 沙盒路径使用：先把 ``<style>`` /
    ``<script>`` 块提取成占位符，只对正文做振假名转换，最后原样拼回。**否则模板的
    样式表会在这一步被整段删掉**——沙盒 iframe 里就只剩无样式裸文本，而且这段删除
    是静默的，测试里只比对正文根本发现不了。
    """
    if not raw_html:
        return ""
    text = str(raw_html)
    protected_blocks: List[str] = []
    if preserve_style_blocks:
        text, protected_blocks = _protect_style_and_script_blocks(text)
    else:
        text = STYLE_BLOCK_RE.sub("", text)
        text = SCRIPT_BLOCK_RE.sub("", text)
    text = MDX_INDEX_MARKER_RE.sub("", text)
    if "[" in text and "]" in text:
        if strip_reading:
            text = FURIGANA_BRACKET_RE.sub(r"\1", text)
        else:
            text = FURIGANA_BRACKET_RE.sub(r"<ruby>\1<rt>\2</rt></ruby>", text)
    if protected_blocks:
        text = _restore_style_and_script_blocks(text, protected_blocks)
    return text


def _apply_jlpt_script_transforms(raw_html: str) -> str:
    """还原 ``eggrolls-JLPT10k`` 模板脚本中的 ``setType()`` 与顶栏清理逻辑。

    该卡包把词性 ``{{VocabPoS}}`` 与例句类型 ``{{SentType1..4}}`` 写在 ``<script>`` 里，
    由 ``setType()`` 动态往 ``.VocabPoS / .VocabPlus / .SentKanji / .SentFurigana / .SentDef``
    注入 ``<em lang='ja'>［名］</em>``、``［例］``、``［関］``、``［対］``、``［訳］``、``［補］``，
    而 CSS 的 ``.LabelIndent`` 预设了 ``-3em`` 悬挂缩进给这个标签留位置。若直接删脚本不补标签，
    词性与关联词/反义词标记会丢失且整段文字向左悬空错位。
    """
    if "CardSide" not in raw_html and "VocabPoS" not in raw_html:
        return raw_html

    sent_types = ["例", "例", "例", "例"]
    st_match = JLPT_SENT_TYPES_SCRIPT_RE.search(raw_html)
    if st_match:
        parsed_types = re.findall(r"['\"]([^'\"]*)['\"]", st_match.group(1))
        for idx, val in enumerate(parsed_types[:4]):
            clean_val = val.strip()
            if clean_val and not clean_val.startswith("{{"):
                sent_types[idx] = clean_val

    vocab_pos = "名"
    pos_match = JLPT_VOCAB_POS_SCRIPT_RE.search(raw_html)
    if pos_match:
        cand = pos_match.group(1).strip()
        if cand and not cand.startswith("{{"):
            vocab_pos = cand

    text = JLPT_TOP_BAR_RE.sub("", raw_html)
    text = JLPT_SEARCH_LINK_RE.sub("", text)

    def _inject_tag(pattern: str, prefix_fn):
        idx_box = [0]

        def _repl(m):
            open_tag, inner, close_tag = m.group(1), m.group(2), m.group(3)
            cur_idx = idx_box[0]
            idx_box[0] += 1
            plain_inner = ANY_TAG_RE.sub("", inner).strip()
            if not plain_inner or "<em" in inner:
                return m.group(0)
            label = prefix_fn(cur_idx)
            return f"{open_tag}<em lang=\"ja\">［{label}］</em>{inner}{close_tag}"

        return re.sub(pattern, _repl, text, flags=re.I)

    text = _inject_tag(
        r'(<h3\b[^>]*\bclass\s*=\s*["\'][^"\']*\bVocabPoS\b[^"\']*["\'][^>]*>)([\s\S]*?)(</h3\s*>)',
        lambda _: vocab_pos,
    )
    text = _inject_tag(
        r'(<h3\b[^>]*\bclass\s*=\s*["\'][^"\']*\bVocabPlus\b[^"\']*["\'][^>]*>)([\s\S]*?)(</h3\s*>)',
        lambda _: "補",
    )
    text = _inject_tag(
        r'(<h3\b[^>]*\bclass\s*=\s*["\'][^"\']*\bSentKanji\b[^"\']*["\'][^>]*>)([\s\S]*?)(</h3\s*>)',
        lambda i: sent_types[i] if i < len(sent_types) else "例",
    )
    text = _inject_tag(
        r'(<h3\b[^>]*\bclass\s*=\s*["\'][^"\']*\bSentFurigana\b[^"\']*["\'][^>]*>)([\s\S]*?)(</h3\s*>)',
        lambda i: sent_types[i] if i < len(sent_types) else "例",
    )
    text = _inject_tag(
        r'(<h3\b[^>]*\bclass\s*=\s*["\'][^"\']*\bSentDef\b[^"\']*["\'][^>]*>)([\s\S]*?)(</h3\s*>)',
        lambda _: "訳",
    )
    return text


def sanitize_rendered_card_html(raw_html: str, reveal_hints: bool = True) -> str:
    """把 Anki 模板渲出的 HTML 清理成能安全塞进 React innerHTML 的形态。

    三类必须清掉的东西，都是模板写给 Anki 桌面复习界面用的：

    1. ``<script>``：卡片脚本。``dangerouslySetInnerHTML`` 本来就不执行它，留着只是脏
       HTML；而真要执行，等于让第三方卡包在本插件的特权 WebView 里跑任意 JS，
       那个 WebView 手里握着 pycmd 桥。
    2. ``<style>``：正文内联样式一律清掉。模板自己的样式表由
       :func:`extract_model_css_text` 单独抽取、作用域化后注入，跟正文分两路走。
    3. ``{{hint:字段}}`` 脚手架：``<a class=hint>标签</a>`` 加一个
       ``<div class=hint style="display:none">内容</div>``，原本靠上面那段脚本点开。
       ``reveal_hints=True``（默认，供**背面**使用）直接把内容露出来、丢掉标签，
       否则内容永远不可达；``reveal_hints=False``（**正面**）保留 ``display:none``，
       让正面和原生一样只显示入口提示，不提前剧透答案。

    顺带清掉 ``onclick`` 之类内联事件属性，免得用户一点就抛 ReferenceError，以及
    ``[anki:play:a:0]`` 这类重播按钮占位符。最后交给
    :func:`normalize_rendered_whitespace` 压平模板缩进。
    """
    if not raw_html:
        return ""

    text = _apply_jlpt_script_transforms(raw_html)
    text = SCRIPT_BLOCK_RE.sub("", text)
    text = STYLE_BLOCK_RE.sub("", text)
    text = TIMER_SPAN_RE.sub("", text)
    text = HINT_ANCHOR_RE.sub("", text)
    text = MEDIA_PLACEHOLDER_RE.sub("", text)
    text = MDX_INDEX_MARKER_RE.sub("", text)
    text = re.sub(r'<input\b[^>]*\bid\s*=\s*["\']?typeans["\']?[^>]*>', "", text, flags=re.I)

    def _fix_tag(tag_match):
        tag = tag_match.group(0)
        if reveal_hints and HINT_ELEMENT_RE.search(tag) and DISPLAY_NONE_RE.search(tag):
            tag = STYLE_ATTR_RE.sub("", tag, count=1)
        return INLINE_HANDLER_RE.sub("", tag)

    cleaned = normalize_rendered_whitespace(ANY_TAG_RE.sub(_fix_tag, text))
    if "<ruby" in cleaned:
        cleaned = re.sub(
            r"(?<=[\u3040-\u30ff\u4e00-\u9fff\u3400-\u4dbf</>])\s+(?=<ruby\b|<b\b[^>]*>\s*<ruby\b)",
            "",
            cleaned,
        )
        cleaned = re.sub(r"(<b\b[^>]*>)\s+(?=<ruby\b)", r"\1", cleaned)
    return cleaned


def strip_front_side_from_answer(answer_html: str, question_html: str = "") -> str:
    """剥离背面模板（``afmt``）开头重复的 ``{{FrontSide}}`` 或重复题干。

    Anki 官方模板通常在 ``afmt`` 顶部写 ``{{FrontSide}}<hr id=answer>``，因为原生界面翻面时
    整页替换；而 Anki Studio 在复习界面、卡片库与 Cmd+K 预览中，上方已常驻展示了卡片正面，
    下方再渲染整段 ``answer_text`` 会导致正面词条/大字号题干重复出现两次，甚至在卡片库三行摘要
    中把真正的释义挤出可视区。
    """
    if not answer_html:
        return ""

    text = answer_html.strip()

    # 1. 标准 `<hr id=answer>` / `<hr id="answer">` 分割线
    hr_match = HR_ANSWER_RE.search(text)
    if hr_match:
        after_hr = text[hr_match.end() :].strip()
        if plain_text_of(after_hr) or "<img" in after_hr.lower():
            return after_hr

    # 2. `eggrolls-JLPT10k` 的 `<main id="FrontSide">...</main>` + `<main id="BackSide">`
    if MAIN_FRONTSIDE_RE.search(text) and MAIN_BACKSIDE_RE.search(text):
        without_front = MAIN_FRONTSIDE_RE.sub("", text, count=1)
        without_front = HIDDEN_VOCAB_AUDIO_DIV_RE.sub("", without_front).strip()
        if plain_text_of(without_front) or "<img" in without_front.lower():
            return without_front

    # 3. `afmt` 直接以 `{{FrontSide}}` 开头（无 `<hr id=answer>`，如 Chinese Grammar Wiki `Translation`）
    q_clean = (question_html or "").strip()
    if q_clean and text.startswith(q_clean) and len(text) > len(q_clean):
        rest = text[len(q_clean) :].strip()
        rest = re.sub(
            r'^(?:<div\b[^>]*\bclass\s*=\s*["\']?spacer\w*["\']?[^>]*>\s*</div\s*>\s*|<hr\b[^>]*>\s*|<br\s*/?>\s*)+',
            "",
            rest,
            flags=re.I,
        ).strip()
        if plain_text_of(rest) or "<img" in rest.lower():
            return rest

    # 4. `CGW-ValidExample` / `CGW-InvalidExample`：正面末尾是 `<div class="hanzi">...</div>`，背面开头重复该块
    hanzi_m = re.match(
        r'^(\s*<div\b[^>]*\bclass\s*=\s*["\']?hanzi["\']?[^>]*>[\s\S]*?</div\s*>)',
        text,
        flags=re.I,
    )
    if hanzi_m and q_clean and hanzi_m.group(1).strip() in q_clean:
        rest = text[hanzi_m.end() :].strip()
        rest = re.sub(
            r'^(?:<div\b[^>]*\bclass\s*=\s*["\']?spacer\w*["\']?[^>]*>\s*</div\s*>\s*)+',
            "",
            rest,
            flags=re.I,
        ).strip()
        if plain_text_of(rest):
            return rest

    return text


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


CSS_IMPORT_RE = re.compile(
    r"@import\s+(?:url\(\s*)?[\"']?([^\"')\s;]+)[\"']?\s*\)?\s*;", flags=re.I
)
CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)([^'\")]+)\1\s*\)", flags=re.I)
CSS_COMMENT_RE = re.compile(r"/\*[\s\S]*?\*/")
CSS_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
CSS_ROOT_SELECTOR_RE = re.compile(r"^(?:html|body|:root)\b", flags=re.I)
CSS_DISPLAY_NONE_RE = re.compile(r"display\s*:\s*none\s*(?:!\s*important\s*)?;?", flags=re.I)
CSS_HARSH_CARD_BG_RE = re.compile(
    r"background(?:-color)?\s*:\s*(?:green|#008000|#0f0)\s*(?:!\s*important\s*)?;?",
    flags=re.I,
)
CSS_TALL_MIN_HEIGHT_RE = re.compile(
    r"min-height\s*:\s*[3-9]\d\dpx\s*(?:!\s*important\s*)?;?",
    flags=re.I,
)
CSS_AT_SCOPED = ("@media", "@supports", "@container", "@layer", "@document")
CARD_ROOT_CLASS = "anki-native-card"
# 正面专用作用域根：与背面同时出现在页面上（如 Cmd+K 同时预览两面）时，
# 两份模板 CSS 的 display 规则互不干扰。必须与前端 CommandPaletteModal 的
# NATIVE_CARD_FRONT_ROOT 保持一致。
CARD_FRONT_ROOT_CLASS = "anki-native-card-front"


def extract_model_css_text(raw_css: str) -> str:
    """从模板 ``css`` 字段里抽出纯 CSS 文本。

    第三方卡包（尤其 2016 年前后那批）把整段 HTML 写进 css 字段里：``</style>``、
    ``<style>``、``<!-- 注释 -->``、甚至一段 ``<script>``。原样插进 ``<style>`` 会让
    样式表在第一个 ``</style>`` 处提前闭合，后面的片段变成页面上的可见乱码。
    这里按 ``<style>`` 块取内容；没有标签时按纯 CSS 处理。
    """
    if not raw_css:
        return ""
    text = re.sub(r"<!--[\s\S]*?-->", "", raw_css)
    blocks = re.findall(r"<style\b[^>]*>([\s\S]*?)</style\s*>", text, flags=re.I)
    if blocks:
        text = "\n".join(blocks)
    text = SCRIPT_BLOCK_RE.sub("", text)
    text = CSS_TAG_RE.sub("", text)
    return CSS_COMMENT_RE.sub("", text).strip()


def _read_media_css(media_dir: str, rel_name: str, cap: int = 262_144) -> str:
    """读取 ``collection.media`` 里的样式表（``@import`` 目标），只展开一层。"""
    if not media_dir or not rel_name:
        return ""
    clean = rel_name.split("?")[0].split("#")[0].strip().strip("'\"")
    clean = clean[2:] if clean.startswith("./") else clean
    if not clean or clean.lower().startswith(("http://", "https://", "//", "data:")):
        return ""
    try:
        path = Path(media_dir) / clean
        if not path.is_file() or path.stat().st_size > cap:
            return ""
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def _rewrite_css_urls(css_text: str, media_dir: str, http_base_url: str = "") -> str:
    """把 ``url('_vocab_logo.png')`` 或 ``@font-face`` 的相对路径改成本地 HTTP 或 ``file://``。"""
    if not css_text or (not media_dir and not http_base_url):
        return css_text

    def _repl(match):
        quote, raw = match.group(1), match.group(2).strip()
        if not raw or raw.lower().startswith(("data:", "http://", "https://", "file://", "//")):
            return match.group(0)
        q = quote or '"'
        uri = _to_http_uri(http_base_url, raw) if http_base_url else _to_file_uri(media_dir, raw)
        return f"url({q}{uri}{q})"

    return CSS_URL_RE.sub(_repl, css_text)


def _split_top_level(text: str, sep: str = ",") -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    depth = 0
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return [p.strip() for p in parts if p.strip()]


def _scope_selector_list(selectors: str, scope: str) -> str:
    scoped: list[str] = []
    for sel in _split_top_level(selectors):
        root = CSS_ROOT_SELECTOR_RE.match(sel)
        if root:
            rest = sel[root.end():].strip()
            scoped.append(f"{scope} {rest}" if rest else scope)
        else:
            scoped.append(f"{scope} {sel}")
    return ", ".join(scoped) if scoped else scope


def scope_card_css(
    css_text: str, scope: str = f".{CARD_ROOT_CLASS}", reveal_hidden: bool = True
) -> str:
    """把模板 CSS 的每条选择器都收进 ``scope`` 之下，避免污染整个插件界面。

    只做一层花括号扫描：``@media`` / ``@supports`` 之类容器规则往里递归，
    ``@keyframes`` / ``@font-face`` 原样保留（它们的作用域本来就是全局）。

    ``reveal_hidden`` 会顺手删掉 ``display:none`` 声明。理由：模板里被 CSS 藏起来的
    段落（``#ext_collins{{display:none}}`` 这种）本来靠 ``onclick="toggle('collins')"``
    点开，而脚本在本插件的 WebView 里不执行、内联事件也已清掉——留着这条规则，用户
    就永远看不到柯林斯解释。宁可比原生界面长一点，也不能让内容锁死在不可达状态。
    """
    if not css_text:
        return ""

    out: list[str] = []
    buf: list[str] = []
    i, n = 0, len(css_text)
    while i < n:
        ch = css_text[i]
        if ch == "{":
            prelude = "".join(buf).strip()
            buf = []
            depth = 1
            i += 1
            start = i
            while i < n and depth:
                if css_text[i] == "{":
                    depth += 1
                elif css_text[i] == "}":
                    depth -= 1
                i += 1
            body = css_text[start : i - 1] if depth == 0 else css_text[start:]
            if not prelude:
                continue
            if prelude.startswith("@"):
                if prelude.lower().startswith(CSS_AT_SCOPED):
                    out.append(
                        f"{prelude}{{{scope_card_css(body, scope, reveal_hidden)}}}"
                    )
                else:
                    out.append(f"{prelude}{{{body}}}")
            else:
                if reveal_hidden:
                    body = CSS_DISPLAY_NONE_RE.sub("", body)
                body = CSS_HARSH_CARD_BG_RE.sub("", body)
                body = CSS_TALL_MIN_HEIGHT_RE.sub("", body)
                if not body.strip():
                    continue
                out.append(f"{_scope_selector_list(prelude, scope)}{{{body}}}")
            continue
        if ch == "}":
            buf = []
            i += 1
            continue
        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail.startswith("@"):
        out.append(tail if tail.endswith(";") else f"{tail};")
    return "\n".join(out)


@lru_cache(maxsize=32)
def build_card_css(
    raw_css: str,
    media_dir: str,
    scope: str = f".{CARD_ROOT_CLASS}",
    http_base_url: str = "",
    reveal_hidden: bool = True,
) -> str:
    """模板 CSS → 可直接注入的、带作用域的样式表。

    ``@import`` 的目标（如柯林斯词典的 ``_collins_c.css``）会被展开并排到最前面，
    保持与 Anki 原生的层叠顺序一致——否则打开复习界面时那段样式要等文件加载才到，
    会先闪一下无样式的内容。
    """
    text = extract_model_css_text(raw_css)
    if not text:
        return ""

    parts: list[str] = []
    for name in CSS_IMPORT_RE.findall(text):
        imported = _read_media_css(media_dir, name)
        if not imported:
            continue
        _sub_imports, sub_rest = _split_css_imports(extract_model_css_text(imported))
        parts.append(_rewrite_css_urls(sub_rest, media_dir, http_base_url=http_base_url))
    _imports, rest = _split_css_imports(text)
    parts.append(_rewrite_css_urls(rest, media_dir, http_base_url=http_base_url))

    merged = "\n".join(p for p in parts if p and p.strip())
    if not merged.strip():
        return ""
    return scope_card_css(merged, scope, reveal_hidden=reveal_hidden)


@lru_cache(maxsize=32)
def build_sandbox_card_css(
    raw_css: str, media_dir: str, http_base_url: str = ""
) -> str:
    """供 Track B 沙盒 iframe 使用的完整模板 CSS（保留原始选择器与 display:none）。"""
    text = extract_model_css_text(raw_css)
    if not text:
        return ""

    parts: list[str] = []
    for name in CSS_IMPORT_RE.findall(text):
        imported = _read_media_css(media_dir, name)
        if not imported:
            continue
        _sub_imports, sub_rest = _split_css_imports(extract_model_css_text(imported))
        parts.append(_rewrite_css_urls(sub_rest, media_dir, http_base_url=http_base_url))
    _imports, rest = _split_css_imports(text)
    parts.append(_rewrite_css_urls(rest, media_dir, http_base_url=http_base_url))

    merged = "\n".join(p for p in parts if p and p.strip())
    return merged.strip()


def _split_css_imports(css_text: str) -> tuple[list[str], str]:
    names = CSS_IMPORT_RE.findall(css_text)
    return names, CSS_IMPORT_RE.sub("", css_text)


class NativeRender(NamedTuple):
    """一张卡走完 Anki 模板引擎之后的三样东西，外加它自己的作用域样式表。

    ``css`` 是**背面**用的样式表：会删掉模板里的 ``display:none``，把靠点击展开的
    段落（柯林斯详解、扩展例句）露出来，否则 WebView 不执行模板脚本就永远看不到。
    ``question_css`` 是**正面**用的同一份样式表，但保留 ``display:none``——原生正面
    本来就把这些段落藏着，露出来就会「正面多出一大段内容」。
    """

    question: str
    answer: str
    question_audio: List[str]
    answer_audio: List[str]
    css: str
    question_css: str = ""


def should_replace_front_on_flip(
    card, front_plain: str = "", full_answer_html: str = ""
) -> bool:
    """判断翻面时是否应该用 ``answer_text`` 整页替换正面。

    原生 Anki 翻面一律整页替换；在 Anki Studio 中，仅当 ``afmt`` 包含 ``{{FrontSide}}``
    或背面渲染结果已经包含正面题干文本（如部分作者直接在 ``afmt`` 开头重写 ``{{Word}}`` /
    ``<div class="hanzi">{{中文}}</div>``）时，才在翻面时隐藏上方常驻正面、整页切换为背面，
    彻底避免正面内容在翻面后上下重复两次。
    """
    try:
        tmpl = card.template() if hasattr(card, "template") else None
        if isinstance(tmpl, dict) and "{{FrontSide}}" in str(tmpl.get("afmt", "")):
            return True
    except Exception:
        pass
    try:
        note = card.note() if hasattr(card, "note") else None
        model = note.note_type() if (note is not None and hasattr(note, "note_type")) else None
        if isinstance(model, dict):
            tmpls = model.get("tmpls") or []
            ord_idx = int(getattr(card, "ord", 0) or 0)
            if 0 <= ord_idx < len(tmpls) and "{{FrontSide}}" in str(tmpls[ord_idx].get("afmt", "")):
                return True
    except Exception:
        pass

    clean_front = (front_plain or "").strip()
    if clean_front and full_answer_html:
        ans_plain = plain_text_of(full_answer_html)
        if clean_front in ans_plain:
            return True
    return False


def resolve_replace_front_on_flip(
    card,
    front_plain: str = "",
    native_answer: str = "",
    is_cloze: bool = False,
    is_image_occlusion: bool = False,
) -> bool:
    """复习与搜索两个服务共用的 ``replaceFrontOnFlip`` 判定。

    IO / Cloze 卡一律不整页替换：它们的“正面 / 背面”是同一张笔记的两种挖空视图，
    隐藏上方题干会直接丢掉当前挖空编号对应的提问面。搜索接口以前漏发这个字段，
    编辑器拿不到它就只能按普通卡处理，翻面预览会和复习界面不一致。
    """
    if is_cloze or is_image_occlusion:
        return False
    return should_replace_front_on_flip(card, front_plain, native_answer)


def render_native_card_sides(
    card, media_dir: str = "", strip_front_side: bool = True, raw_output=None
) -> NativeRender:
    """用 Anki 自己的模板引擎渲染正反两面，返回 :class:`NativeRender`。

    ``strip_front_side=True``（默认，供卡片库摘要与 Cmd+K 两段式预览使用）会调用
    :func:`strip_front_side_from_answer` 剥掉模板顶部重复的正面块；复习界面启用
    ``replaceFrontOnFlip`` 时传 ``strip_front_side=False``，由前端整页替换。
    """
    empty = NativeRender("", "", [], [], "")
    if card is None and raw_output is None:
        return empty
    output = raw_output
    if output is None:
        try:
            output = card.render_output()
        except Exception:
            return empty

    try:
        # 正面保留 {{hint::…}} 的 display:none（不剧透），背面才揭开提示内容。
        question = sanitize_rendered_card_html(
            _as_text(getattr(output, "question_text", "")), reveal_hints=False
        )
        raw_answer_sanitized = sanitize_rendered_card_html(
            _as_text(getattr(output, "answer_text", "")), reveal_hints=True
        )
        answer = (
            strip_front_side_from_answer(raw_answer_sanitized, question)
            if strip_front_side
            else raw_answer_sanitized
        )
        question_audio = _av_filenames(getattr(output, "question_av_tags", None))
        answer_audio = _av_filenames(getattr(output, "answer_av_tags", None))
        raw_css = _as_text(getattr(output, "css", ""))
        # 同一份模板 CSS 出两份作用域化结果：背面揭开隐藏段落，正面保留隐藏。
        page_css = build_card_css(raw_css, media_dir) if raw_css else ""
        question_css = (
            build_card_css(
                raw_css,
                media_dir,
                scope=f".{CARD_FRONT_ROOT_CLASS}",
                reveal_hidden=False,
            )
            if raw_css
            else ""
        )
    except Exception:
        return empty
    return NativeRender(question, answer, question_audio, answer_audio, page_css, question_css)


def _as_text(value) -> str:
    """模板渲染结果里的字段偶尔不是字符串（桩对象、None），统一兜成空串。"""
    return value if isinstance(value, str) else ""


def _av_filenames(tags) -> List[str]:
    names: List[str] = []
    for tag in tags or []:
        name = str(getattr(tag, "filename", "") or "").strip()
        if name and name not in names:
            names.append(name)
    return names


def render_native_card_html(
    card, media_dir: str = ""
) -> tuple[str, list[str], str]:
    """只要背面：``(html, audio_files, css)``，见 :func:`render_native_card_sides`。"""
    sides = render_native_card_sides(card, media_dir)
    return sides.answer, sides.answer_audio, sides.css


ANKI_PLAY_TAG_RE = re.compile(r"\[anki:play:([^\]]+)\]", flags=re.I)
ANKI_TTS_TAG_RE = re.compile(r"\[anki:tts:[^\]]*\]", flags=re.I)


def resolve_media_for_sandbox(
    raw_html: str, media_dir: str = "", http_base_url: str = ""
) -> str:
    """为 Track B 沙盒 iframe 准备原始模板 HTML（保留 ``<script>``、内联事件与 ``{{hint}}``）。"""
    if not raw_html:
        return ""
    text = resolve_media_img_src_for_webview(raw_html, media_dir, http_base_url=http_base_url)
    text = ANKI_PLAY_TAG_RE.sub(
        lambda m: (
            f'<a href="#" class="soundLink replay-button" '
            f'onclick="if(window.pycmd)window.pycmd(\x27play:{html.escape(m.group(1).strip())}\x27);return false;" '
            f'style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;'
            f'border-radius:999px;background:rgba(94,92,230,0.12);color:#5E5CE6;text-decoration:none;'
            f'font-size:11px;margin:0 4px;vertical-align:middle;">▶</a>'
        ),
        text,
    )
    text = ANKI_TTS_TAG_RE.sub("", text)

    # 沙盒 HTML 里的 <style> / <script> 必须原样保留（模板脚本与样式表是 Track B 的
    # 核心），所以这里走 preserve_style_blocks=True：只转换正文里的振假名，块内容不动。
    # 之前用「按块手工 split 再拼」的写法，漏掉任何一类块（例如嵌套或大小写变体）
    # 都会让整张样式表被 convert_furigana_to_ruby 静默删掉。
    text = convert_furigana_to_ruby(text, preserve_style_blocks=True)
    return text.strip()


class SandboxRender(NamedTuple):
    """供 Track B 沙盒 iframe 渲染的正反面完整 HTML 与未裁剪模板样式表。"""

    question: str
    answer: str
    css: str


def render_sandbox_card_sides(
    card, media_dir: str = "", http_base_url: str = "", raw_output=None
) -> SandboxRender:
    """使用 Anki 原生 ``card.render_output()`` 生成保留 ``<script>`` 与交互逻辑的沙盒 HTML。"""
    empty = SandboxRender("", "", "")
    if card is None and raw_output is None:
        return empty
    output = raw_output
    if output is None:
        try:
            output = card.render_output()
        except Exception:
            return empty
    try:
        q_raw = _as_text(getattr(output, "question_text", ""))
        a_raw = _as_text(getattr(output, "answer_text", ""))
        raw_css = _as_text(getattr(output, "css", ""))
        q_html = resolve_media_for_sandbox(q_raw, media_dir, http_base_url=http_base_url)
        a_html = resolve_media_for_sandbox(a_raw, media_dir, http_base_url=http_base_url)
        css_out = (
            build_sandbox_card_css(raw_css, media_dir, http_base_url=http_base_url)
            if raw_css
            else ""
        )
        return SandboxRender(q_html, a_html, css_out)
    except Exception:
        return empty


METADATA_FIELD_LOWER = {
    "noteid",
    "note id",
    "id",
    "guid",
    "uuid",
    "link",
    "level",
    "suborder",
    "honorific",
    "index",
    "order",
    "序号",
    "编号",
    "audio",
    "vocabaudio",
    "vocabpitch",
    "vocabpos",
    "example type",
    "source url",
    "article title",
}


def pick_display_field(fields: Dict[str, str], rendered_front: str) -> str:
    """挑出“正面真正显示的那个字段”。

    Anki 的正面是模板算出来的，跟字段顺序没关系；插件却一直拿 ``fields[0]`` 当正面。
    对绝大多数卡包没问题（第一个字段就是主词），碰上 ``eggrolls-JLPT10k`` 或
    ``N1N2N3N4N5`` 这种把 ``NoteID`` / ``Note ID`` 排在第一位的卡包，正面就直接是一串 uuid。

    判定办法：按字段顺序找第一个“内容真的出现在模板正面里”的字段（通过 :func:`plain_text_of`
    自动剥除日语振假名方括号 ``漢字[かな]`` 与 ``<rt>`` 注音再比对）。若正面是蓝宝书的
    ``例文カード``（``class="sentenceexample"``），优先从例句字段中匹配。
    """
    if not fields:
        return ""
    first_key = next(iter(fields))
    probe_front = plain_text_of(rendered_front)
    if not probe_front:
        return first_key

    is_sentence_card = (
        "sentenceexample" in (rendered_front or "")
        and 'class="word"' not in (rendered_front or "")
    )

    candidate_items = list(fields.items())
    if is_sentence_card:
        example_items = [
            (k, v) for k, v in candidate_items if k.lower().startswith("example")
        ]
        other_items = [
            (k, v) for k, v in candidate_items if not k.lower().startswith("example")
        ]
        candidate_items = example_items + other_items

    for name, value in candidate_items:
        if name.strip().lower() in METADATA_FIELD_LOWER:
            continue
        probe = plain_text_of(value)
        if not probe:
            continue
        if probe in probe_front:
            return name
        probe_no_tilde = probe.lstrip("～〜~- ").strip()
        if len(probe_no_tilde) >= 2 and probe_no_tilde in probe_front:
            return name

    for name, value in fields.items():
        probe = plain_text_of(value)
        if probe and probe in probe_front:
            return name

    return first_key


_TEMPLATE_FIELD_TOKEN_RE = re.compile(r"\{\{([^{}]+)\}\}")
_TEMPLATE_FIELD_PREFIX_RE = re.compile(
    r"^(?:[#/^]|text:|type:|cloze:|hint:|tts:|furigana:)", flags=re.I
)
_TEMPLATE_SPECIAL_FIELDS = {
    "frontside",
    "tags",
    "deck",
    "subdeck",
    "card",
    "cardflag",
    "type",
    "notetype",
}


def card_template_dict(card) -> Dict[str, Any]:
    """取这张卡**自己的**模板，而不是 note type 的第一个模板。

    多模板卡型（日→中 / 中→日、正问 / 反问）的正面字段完全由 ``card.ord`` 指向的
    模板决定；只看 ``fields[0]`` 或 ``tmpls[0]`` 都会把另一条模板的字段当成正面，
    于是“多模板卡片”的正面渲染、整页翻面判定会串到另一条模板上。
    """
    if card is None:
        return {}
    try:
        template = card.template() if hasattr(card, "template") else None
        if isinstance(template, dict) and template:
            return template
    except Exception:
        pass
    try:
        note = card.note() if hasattr(card, "note") else None
        model = note.note_type() if (note is not None and hasattr(note, "note_type")) else None
        if isinstance(model, dict):
            tmpls = model.get("tmpls") or []
            ord_idx = int(getattr(card, "ord", 0) or 0)
            if 0 <= ord_idx < len(tmpls) and isinstance(tmpls[ord_idx], dict):
                return tmpls[ord_idx]
    except Exception:
        pass
    return {}


def template_field_references(qfmt: str) -> List[str]:
    """按出现顺序抽出模板正面 ``qfmt`` 引用到的字段名。

    去掉 ``{{text:字段}}`` / ``{{type:字段}}`` / ``{{#条件}}`` / ``{{/条件}}`` 这些修饰，
    过滤 ``FrontSide``、``Tags``、``Card`` 等特殊 token，保留真实的字段名。
    """
    refs: List[str] = []
    for raw in _TEMPLATE_FIELD_TOKEN_RE.findall(qfmt or ""):
        token = raw.strip()
        if not token:
            continue
        token = _TEMPLATE_FIELD_PREFIX_RE.sub("", token).strip()
        if not token or token.lower() in _TEMPLATE_SPECIAL_FIELDS:
            continue
        if token not in refs:
            refs.append(token)
    return refs


def resolve_front_field_name(
    fields: Dict[str, str], rendered_front: str, card=None
) -> str:
    """判定“这张卡当前模板的正面字段”，模板优先、内容比对兜底。

    为什么不能只靠 :func:`pick_display_field`：它按“字段内容出现在渲染正面里”猜，
    多模板卡型下两条模板共用的字段（例句、释义）会互相命中，猜到的未必是当前模板的
    正面。模板的 ``qfmt`` 才是 Anki 判定正面的真实依据——按它引用的字段顺序取第一个
    非空且确实出现在渲染结果里的字段，确定性强得多；模板不可用时再回落到内容比对。
    """
    if not fields:
        return ""
    if card is not None:
        template = card_template_dict(card)
        if template:
            references = template_field_references(str(template.get("qfmt", "") or ""))
            if references:
                probe_front = plain_text_of(rendered_front)
                for name in references:
                    if name not in fields:
                        continue
                    if name.strip().lower() in METADATA_FIELD_LOWER:
                        continue
                    probe = plain_text_of(fields.get(name, ""))
                    if not probe:
                        continue
                    if not probe_front or probe in probe_front:
                        return name
    return pick_display_field(fields, rendered_front)


INLINE_FORMAT_TAG_RE = re.compile(
    r"</?(?:ruby|rb|rp|b|strong|i|em|u|s|font|sub|sup|mark|span)\b[^>]*>",
    flags=re.I,
)


def plain_text_of(raw_html: str) -> str:
    """HTML → 纯文本（去脚本/样式、去标签、去音频标记、去振假名读音、解实体、压空白），用来做文本比对与摘要。"""
    if not raw_html or not isinstance(raw_html, str):
        return ""
    text = SCRIPT_BLOCK_RE.sub(" ", raw_html)
    text = STYLE_BLOCK_RE.sub(" ", text)
    text = RUBY_RT_RE.sub("", text)
    text = RUBY_RP_RE.sub("", text)
    text = SOUND_TAG_RE.sub(" ", text)
    text = MEDIA_PLACEHOLDER_RE.sub(" ", text)
    text = MDX_INDEX_MARKER_RE.sub(" ", text)
    if "[" in text and "]" in text:
        text = FURIGANA_BRACKET_RE.sub(r"\1", text)
    text = CLOZE_RE.sub(lambda m: m.group(2) or "", text)
    text = INLINE_FORMAT_TAG_RE.sub("", text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def wrap_card_with_styles(html_text: str, css_text: str, front: bool = False) -> str:
    """把正文包进卡包作用域容器并挂上作用域样式表。

    里层那个 ``class="card"`` 不能省：模板 CSS 基本都以 ``.card{{color / font}}``
    打底，缺了它就只剩 Studio 深色主题的浅色文字，落到白底卡面上会看不清。

    ``front=True`` 时外层同时挂 ``anki-native-card-front``：正面的样式表是按这个
    作用域生成的（保留模板的 ``display:none``），背面用默认的 ``.anki-native-card``
    作用域（揭开隐藏内容）。两面同时出现在页面上时互不覆盖。
    """
    if not html_text:
        return html_text or ""
    if not css_text:
        return html_text
    return f"<style>{css_text}</style>" + wrap_card_html(html_text, front=front)


def wrap_card_html(html_text: str, front: bool = False) -> str:
    """只给正文套容器，不带样式表（样式由调用方在别处统一渲染一份）。"""
    if not html_text:
        return html_text or ""
    classes = f"{CARD_ROOT_CLASS} {CARD_FRONT_ROOT_CLASS}" if front else CARD_ROOT_CLASS
    return f'<div class="{classes}"><div class="card">{html_text}</div></div>'
