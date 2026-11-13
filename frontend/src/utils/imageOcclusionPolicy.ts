// ============================================================================
// 图片遮挡（Image Occlusion）产品策略
//
// 2026-11-13 产品决定：Studio **不再提供图片遮挡的创建与编辑**，只负责显示。
// 原因：Studio 的编辑器固定产出「整图一组」的笔记，而 Anki 原生支持多组 + 两种
// 遮挡模式；继续提供编辑入口，要么给出一个实际上不起作用的模式开关，要么会在
// 「重新编辑」时把原生的多组笔记压扁成一组（静默数据损失）。与其半吊子，不如
// 把建卡与改卡完整交回 Anki 原生编辑器，Studio 保留复习 / 卡片库 / Cmd+K / 预览
// 的显示链路。
//
// 注意：这里关掉的只是**编辑能力**，不是**解析能力**。下面 isImageOcclusionNote()
// 仍要把原生遮挡笔记准确认出来，才能给出「当前不支持编辑」的提示，而不是让用户
// 对着一串 `{{c1::image-occlusion:rect:...}}` 的原始指令发愣。
// ============================================================================

/**
 * 是否开放图片遮挡的创建/编辑入口。
 *
 * 保留成一个显式常量而不是把代码删光：格式序列化（`buildNativeOcclusion`）与
 * 遮罩渲染（`renderMathAndRichHtml` 的 IO 分支）仍是显示链路的一部分，也有单测守着；
 * 产品若日后决定恢复，改这一个布尔值 + 把 UI 接回来即可，不用重写一遍格式知识。
 */
export const IMAGE_OCCLUSION_AUTHORING_ENABLED = false;

/** 判别时只需要这几个字段，避免把整个卡片类型拖进工具层。 */
export interface ImageOcclusionNoteLike {
  fields?: Record<string, string> | null;
  fieldOrder?: string[] | null;
  front?: string | null;
  back?: string | null;
  frontHtml?: string | null;
  backHtml?: string | null;
  meaning?: string | null;
}

/** 原生遮挡笔记的字段名（Anki 的 Image Occlusion 卡型固定 5 个字段）。 */
const IO_FIELD_NAMES = ['occlusion', 'image'];

const NATIVE_IO_COMMAND_RE = /image-occlusion:\w+:/i;
const STUDIO_IO_WRAP_RE = /anki-io-wrap/i;

/**
 * 判断一条笔记是不是图片遮挡卡。三个独立信号，任一命中即为真：
 *
 *  1. 字段名同时含 `Occlusion` 和 `Image`（大小写/首尾空格不敏感）——最可靠；
 *  2. 任一字段值含原生指令 `image-occlusion:rect:` 等——兼容字段被改名/裁剪过的情况；
 *  3. 已渲染 HTML 含 `.anki-io-wrap`——兼容插件自己的老格式卡。
 *
 * 故意不做「文本里出现 'image occlusion' 就算」的模糊匹配：普通卡片的正文完全可能
 * 写到这个词，误判会让一张正常卡片莫名其妙变成只读。
 */
export function isImageOcclusionNote(
  note: ImageOcclusionNoteLike | null | undefined
): boolean {
  if (!note) return false;

  const fields = note.fields;
  if (fields && typeof fields === 'object') {
    const keys = Object.keys(fields).map((k) => k.trim().toLowerCase());
    if (IO_FIELD_NAMES.every((name) => keys.includes(name))) return true;
    for (const value of Object.values(fields)) {
      if (typeof value === 'string' && NATIVE_IO_COMMAND_RE.test(value)) return true;
      if (typeof value === 'string' && STUDIO_IO_WRAP_RE.test(value)) return true;
    }
  }

  const htmlCandidates = [
    note.frontHtml,
    note.backHtml,
    note.front,
    note.back,
    note.meaning,
  ];
  return htmlCandidates.some(
    (html) =>
      typeof html === 'string' &&
      (NATIVE_IO_COMMAND_RE.test(html) || STUDIO_IO_WRAP_RE.test(html))
  );
}
