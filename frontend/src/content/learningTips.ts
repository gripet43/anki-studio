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
  {
    id: 'minimum-information',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '一张卡只问一个点；答案里出现「和」，就该拆成两张。',
      en: 'One card, one point — if the answer contains “and”, split it into two cards.',
    },
  },
  {
    id: 'enough-context',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '几个月后再看也能认出在问什么——题干缺上下文，就补一句来源或场景。',
      en: 'Make sure you still know what’s being asked months later — add a source or scene to a bare prompt.',
    },
  },
  {
    id: 'why-not-what',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '少问「是什么」，多问「为什么 / 如果……会怎样」；能解释因果的卡记得更牢。',
      en: 'Ask “why” and “what if” more than “what” — cards that explain cause and effect stick better.',
    },
  },
  {
    id: 'cloze-first',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '优先用填空：挖掉关键词，比整句背诵更省力，也更接近真实回忆。',
      en: 'Prefer cloze deletions: hiding the key word beats memorising whole sentences, and mirrors real recall.',
    },
  },
  {
    id: 'retrieval-first',
    category: { zh: '记忆科学', en: 'Memory Science' },
    text: {
      zh: '先合上书回忆，再翻卡；想不起来的那几秒，才是记忆真正变牢的时候。',
      en: 'Recall before you flip: those few seconds of struggle are where memory actually gets stronger.',
    },
  },
  {
    id: 'desirable-difficulty',
    category: { zh: '记忆科学', en: 'Memory Science' },
    text: {
      zh: '稍微吃力是好事；如果一张卡每次都是一眼就会，它可能不值得留在库里。',
      en: 'A little struggle is healthy — a card that’s always effortless probably doesn’t need to stay in your deck.',
    },
  },
  {
    id: 'sleep-consolidation',
    category: { zh: '记忆科学', en: 'Memory Science' },
    text: {
      zh: '睡前过一遍当天最难的几张卡，睡眠会帮你把它们再巩固一遍。',
      en: 'Review your hardest cards before bed — sleep quietly consolidates them overnight.',
    },
  },
  {
    id: 'prune-the-library',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '定期清理卡片库：删掉永远答不对和一眼就会的卡，留好卡比留多卡重要。',
      en: 'Prune the library now and then: drop the never-right and the always-easy — good cards beat many cards.',
    },
  },
  {
    id: 'own-words',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '用自己的话写卡面：照抄原句记住的是句子，复述出来的才是理解。',
      en: 'Write cards in your own words — copying a sentence remembers the words, not the idea.',
    },
  },
  {
    id: 'worth-remembering',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '只把值得记十年的内容做成卡；卡片库不是收藏夹。',
      en: 'Only card what’s worth remembering for a decade — a library is not a scrapbook.',
    },
  },
];

export function resolveTipLocale(lang: string): TipLocale {
  return String(lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
