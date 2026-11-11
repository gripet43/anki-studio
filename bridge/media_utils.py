# -*- coding: utf-8 -*-
"""
Anki Modern OS — Shared Media Path Resolution & Storage Normalization Helpers
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
