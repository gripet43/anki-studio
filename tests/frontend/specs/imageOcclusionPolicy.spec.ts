// ============================================================================
// 图片遮挡只读策略：判别必须准，不能把普通卡误锁成只读
//
// 产品决定（2026-11-13）：Studio 不再提供图片遮挡的创建与编辑，只负责显示；
// 打开已有遮挡卡时给「当前不支持图片挖空卡片编辑」提示。判别错了会误伤大量
// 正常卡片（只读 = 不能改任何字段），所以这里把三类信号与易误判的边界都钉住。
// ============================================================================

import { section, test, ok, equal } from '../harness';
import {
  IMAGE_OCCLUSION_AUTHORING_ENABLED,
  isImageOcclusionNote,
} from '../../../frontend/src/utils/imageOcclusionPolicy';

section('image occlusion · display-only policy');

test('策略常量：Studio 不开放遮挡卡的新建/编辑', () => {
  equal(IMAGE_OCCLUSION_AUTHORING_ENABLED, false);
});

test('按字段名识别原生 Image Occlusion 笔记（大小写与空格不敏感）', () => {
  ok(isImageOcclusionNote({
    fields: {
      Occlusion: '{{c1::image-occlusion:rect:left=.1:top=.1:width=.1:height=.1}}',
      Image: '<img src="x.png">',
      Header: '胸廓解剖',
      'Back Extra': '',
      Comments: '',
    },
  }));
  ok(isImageOcclusionNote({
    fields: { ' occlusion ': '...', image: '...' },
  }));
});

test('字段值里的原生指令也能兜住（字段被改名/裁剪时）', () => {
  ok(isImageOcclusionNote({
    fields: { Mask: '{{c2::image-occlusion:rect:left=.2:top=.2:width=.1:height=.1:oi=1}}' },
  }));
});

test('已渲染 HTML 里的 .anki-io-wrap 也能识别旧格式卡', () => {
  ok(isImageOcclusionNote({
    frontHtml: '<div class="anki-io-wrap"><img src="x.png"></div>',
  }));
  ok(isImageOcclusionNote({
    front: '{{c1::image-occlusion:rect:left=.1:top=.1:width=.1:height=.1}}',
  }));
});

test('普通卡片不能误判：正文里提到这个术语也不算', () => {
  equal(isImageOcclusionNote({
    fields: { 正面: 'What is image occlusion in Anki?', 背面: 'A way to hide parts of an image.' },
  }), false);
  equal(isImageOcclusionNote({
    fields: { Front: 'perceive', Back: '察觉' },
    frontHtml: '<p>perceive</p>',
  }), false);
});

test('空输入 / 只缺一个字段都不算', () => {
  equal(isImageOcclusionNote(null), false);
  equal(isImageOcclusionNote(undefined), false);
  equal(isImageOcclusionNote({}), false);
  equal(isImageOcclusionNote({ fields: { Occlusion: '...' } }), false);
  equal(isImageOcclusionNote({ fields: { Image: '...' } }), false);
});

test('字段名齐全但没有指令时仍按卡型判为遮挡（避免漏锁）', () => {
  ok(isImageOcclusionNote({
    fields: { Occlusion: '', Image: '' },
  }));
});
