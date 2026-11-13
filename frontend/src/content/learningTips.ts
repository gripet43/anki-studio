/**
 * 首页「学习小贴士」文案（轮播）。
 *
 * 内容取舍：只保留与 Anki Studio 产品观一致、对学习者真正有用的原则；
 * 第三方工具广告（Obsidian 同步插件、AI 拍照制卡、幕布、iOS 价格等）一律不放。
 * 语言覆盖：中英先上；简体/繁体走中文，其余语言回退英文（后续再补全 16 种）。
 */
export type TipLocale = 'zh' | 'en';

export interface LearningTip {
  id: string;
  category: Record<TipLocale, string>;
  text: Record<TipLocale, string>;
}

export const LEARNING_TIPS: LearningTip[] = [
  {
    id: 'understand-first',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '先理解，再制卡——没弄懂的内容，先别交给 Anki 去记。',
      en: 'Understand first, then make the card — don’t hand Anki something you haven’t grasped.',
    },
  },
  {
    id: 'keep-cards-short',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '卡片短一点：20–80 字、10 秒内能答完；长知识点拆成几张。',
      en: 'Keep cards short: 20–80 words, answerable in 10 seconds; split big topics into several cards.',
    },
  },
  {
    id: 'make-your-own',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '自己做的卡记得最牢：别人的 deck 可以借鉴，但别省掉自己的理解。',
      en: 'Cards you make yourself stick best — borrow decks if you like, but don’t skip your own understanding.',
    },
  },
  {
    id: 'mistake-one-point',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '错题只记「错的那一点」，一张卡只解决一个错误。',
      en: 'For mistakes, capture only the exact point you got wrong — one card, one error.',
    },
  },
  {
    id: 'learn-vs-review',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '学习与复习分开：Anki 用来「记住」，不用来「第一次学会」。',
      en: 'Separate learning from reviewing: Anki is for remembering, not for learning something the first time.',
    },
  },
  {
    id: 'fewer-honest-reviews',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '宁可今天少刷几张，也别含糊地点「记得」；状态不好时，暂停比硬撑划算。',
      en: 'Fewer honest reviews beat rushed ones — when you’re not okay, pausing beats pushing through.',
    },
  },
  {
    id: 'fixed-daily-slot',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '每天固定一段时间给复习，比偶尔一次学很久更有效。',
      en: 'A fixed daily slot for review works better than one long session now and then.',
    },
  },
  {
    id: 'backlog-in-batches',
    category: { zh: '积压应对', en: 'Backlog' },
    text: {
      zh: '积压别一口气清完：分批追赶，或让「进度减负」把压力摊到接下来几天。',
      en: 'Don’t clear a backlog in one sitting — catch up in batches, or let Schedule Relief spread it over the next few days.',
    },
  },
  {
    id: 'fsrs-order',
    category: { zh: '排序', en: 'Ordering' },
    text: {
      zh: '先复习最可能忘的：FSRS 的遗忘预测会帮你把真正该看的卡排在前面。',
      en: 'Review what you’re most likely to forget first — FSRS predicts what deserves the front of the queue.',
    },
  },
  {
    id: 'cards-vs-notes',
    category: { zh: '知识体系', en: 'Knowledge System' },
    text: {
      zh: '卡片负责记住「点」，笔记/导图负责连成「线」——两者一起用才成体系。',
      en: 'Cards hold the dots; notes and mind maps connect them — use both to build a real system.',
    },
  },
];

export function resolveTipLocale(lang: string): TipLocale {
  return String(lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
