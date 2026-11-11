// ============================================================================
// Anki Studio — Media URL Resolution Helpers for Editors & Previews
// Converts relative Anki media filenames (`<img src="foo.png">`) into displayable
// `file:///.../collection.media/foo.png` URIs inside WebView / WYSIWYG editors
// while keeping raw `{{c1::...}}` Cloze syntax and `[sound:...]` untouched.
// ============================================================================

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const IMG_SRC_ATTR_RE = /(\s|["'])(src\s*=\s*)(?:(["'])([^"']*)\3|([^\s"'=<>`]+))/i;
const DATA_ANKI_MEDIA_RE = /\bdata-anki-media\s*=\s*(["'])([^"']+)\1/i;

function decodeMinimalHtmlEntities(val: string): string {
  return val
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function normalizeMediaBaseUrl(baseUrl?: string | null): string {
  const trimmed = String(baseUrl || '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/**
 * Fallback helper: extracts the `file:///.../collection.media/` (or directory prefix)
 * from already-resolved preview HTML (`frontHtml` / `backHtml`) if `envInfo.mediaBaseUrl`
 * is not yet available.
 */
export function extractMediaBaseUrlFromHtml(
  ...htmlList: Array<string | undefined | null>
): string {
  for (const rawHtml of htmlList) {
    if (!rawHtml) continue;
    const tags = rawHtml.match(IMG_TAG_RE);
    if (!tags) continue;
    for (const tag of tags) {
      const m = IMG_SRC_ATTR_RE.exec(tag);
      if (!m) continue;
      const srcVal = decodeMinimalHtmlEntities(
        String(m[3] !== undefined ? m[4] || '' : m[5] || '').trim()
      );
      if (!srcVal.toLowerCase().startsWith('file://')) continue;
      const lower = srcVal.toLowerCase();
      const markerIdx = lower.indexOf('/collection.media/');
      if (markerIdx >= 0) {
        return srcVal.slice(0, markerIdx + '/collection.media/'.length);
      }
      const lastSlash = srcVal.lastIndexOf('/');
      if (lastSlash > 'file://'.length) {
        return srcVal.slice(0, lastSlash + 1);
      }
    }
  }
  return '';
}

function safeDecodeSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function toResolvedFileUrl(relPath: string, normalizedBase: string): string {
  let cleanRel = relPath;
  while (cleanRel.startsWith('./')) {
    cleanRel = cleanRel.slice(2);
  }
  const encodedPath = cleanRel
    .split('/')
    .filter((seg) => seg.length > 0 && seg !== '.')
    .map((seg) => encodeURIComponent(safeDecodeSegment(seg)))
    .join('/');
  return `${normalizedBase}${encodedPath}`;
}

/**
 * Resolves a single `<img>` `src` string for display inside the WebView.
 * Preserves `http(s):`, `data:`, `blob:`, and leading `/`, and rescues foreign `file://`
 * URIs when a `fallbackFilename` (from `data-anki-media`) is available.
 */
export function resolveMediaSrcValue(
  rawSrc: string,
  mediaBaseUrl?: string | null,
  fallbackFilename?: string | null
): string {
  const trimmed = decodeMinimalHtmlEntities(String(rawSrc || '').trim());
  const base = normalizeMediaBaseUrl(mediaBaseUrl);
  const cleanFallback = decodeMinimalHtmlEntities(String(fallbackFilename || '').trim());

  if (!trimmed) {
    return cleanFallback && base ? toResolvedFileUrl(cleanFallback, base) : '';
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('/')
  ) {
    return trimmed;
  }

  if (lower.startsWith('file://')) {
    if (base && !trimmed.startsWith(base) && cleanFallback) {
      return toResolvedFileUrl(cleanFallback, base);
    }
    return trimmed;
  }

  if (!base) return trimmed;
  return toResolvedFileUrl(trimmed, base);
}

/**
 * Rewrites relative `<img src="...">` paths in card field HTML to `file:///.../collection.media/...`
 * so images render inside rich editors without altering `{{c1::...}}` or `[sound:...]` tags.
 */
export function resolveMediaInHtml(rawHtml: string, mediaBaseUrl?: string | null): string {
  if (!rawHtml) return '';
  const base = normalizeMediaBaseUrl(mediaBaseUrl);
  if (!base) return rawHtml;

  return rawHtml.replace(IMG_TAG_RE, (tag) => {
    const mediaM = DATA_ANKI_MEDIA_RE.exec(tag);
    const fallbackFilename = mediaM ? mediaM[2] : '';

    return tag.replace(
      IMG_SRC_ATTR_RE,
      (
        fullMatch,
        lead: string,
        eqPart: string,
        quote: string | undefined,
        qVal: string | undefined,
        uVal: string | undefined
      ) => {
        const rawVal = quote !== undefined ? qVal || '' : uVal || '';
        const q = quote || '"';
        const resolved = resolveMediaSrcValue(rawVal, base, fallbackFilename);
        if (!resolved || resolved === rawVal) {
          return fullMatch;
        }
        const safeAttrVal = resolved
          .replace(/&/g, '&amp;')
          .replace(q === "'" ? /'/g : /"/g, q === "'" ? '&#39;' : '&quot;');
        return `${lead}${eqPart}${q}${safeAttrVal}${q}`;
      }
    );
  });
}
