// ============================================================================
// 编辑器插入表格的样式常量
//
// 关键约束：这些内联样式会被**原样存进笔记字段**，之后在 Anki 原生界面（几乎总是
// 白底黑字）里渲染，和插件自己的主题完全无关。所以：
//   1. 不能把当前界面主题烘进去。深色模式下插入的表格若写死 `background:#21222E`，
//      进了原生白底卡片就是「黑底 + 继承来的黑字」，整行表头直接看不见。
//   2. 单元格文字颜色必须**显式声明**（th 尤其），不能指望继承——继承来的是谁的
//      颜色取决于渲染环境，而这里的环境我们控制不了。
//   3. 不写死 font-size：让表格跟随所在正文的字号，编辑器里看到多大、原生里就是多大。
// ============================================================================

/** 描边色。中性浅灰，在白底深色底上都能看见。 */
export const TABLE_BORDER_COLOR = '#D0D7DE';

/** 表头底色。浅色 + 显式深色文字，任何主题下都可读。 */
export const TABLE_HEADER_BG = '#F5F5F7';

/** 表头文字色。与底色成对出现，避免依赖继承。 */
export const TABLE_HEADER_FG = '#1F2328';

export function tableWrapperStyle(): string {
  return [
    'width:100%',
    'border-collapse:collapse',
    'margin:10px 0',
    `border:1px solid ${TABLE_BORDER_COLOR}`,
  ].join('; ') + ';';
}

export function tableHeaderCellStyle(): string {
  return [
    `border:1px solid ${TABLE_BORDER_COLOR}`,
    'padding:6px 10px',
    `background:${TABLE_HEADER_BG}`,
    `color:${TABLE_HEADER_FG}`,
    'text-align:start',
    'min-width:48px',
  ].join('; ') + ';';
}

export function tableBodyCellStyle(): string {
  // td 刻意不写 background / color：白底卡片继承黑字，深色编辑器继承浅字，两边都对。
  return [
    `border:1px solid ${TABLE_BORDER_COLOR}`,
    'padding:6px 10px',
    'min-width:48px',
  ].join('; ') + ';';
}
