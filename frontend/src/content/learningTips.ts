/**
 * 首页「学习小贴士」文案（轮播，共 40 条）。
 *
 * 内容取舍：只保留与 Anki Studio 产品观一致、对学习者真正有用的原则与功能提示；
 * 第三方工具广告（Obsidian 同步插件、AI 拍照制卡、幕布、iOS 价格等）与快捷键教学一律不放。
 * 排版约束：一句话直述、不用冒号小标题、不用分号；按主题在数组中穿插排列，避免轮播撞题。
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
      zh: '没弄懂的内容，先别交给 Anki 去记。',
      en: 'Don’t hand Anki something you haven’t grasped.',
    },
  },
  {
    id: 'learn-vs-review',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: 'Anki 用来「记住」，不用来「第一次学会」。',
      en: 'Anki is for remembering, not for learning something the first time.',
    },
  },
  {
    id: 'retrieval-first',
    category: { zh: '记忆科学', en: 'Memory Science' },
    text: {
      zh: '先合上书回忆，再翻卡，想不起来的那几秒才是记忆真正变牢的时候。',
      en: 'Recall before you flip: those few seconds of struggle are where memory actually gets stronger.',
    },
  },
  {
    id: 'vacation-mode-before-break',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '出门或忙不过来前开「休假模式」，顺延排期还能保住连续打卡。',
      en: 'Leaving town or swamped? Turn on Vacation Mode to shift due dates and keep your streak.',
    },
  },
  {
    id: 'minimum-information',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '一张卡只问一个点，答案里出现「和」就该拆成两张。',
      en: 'One card, one point — if the answer contains “and”, split it into two cards.',
    },
  },
  {
    id: 'cards-vs-notes',
    category: { zh: '知识体系', en: 'Knowledge System' },
    text: {
      zh: '卡片负责记住「点」，笔记/导图负责连成「线」——两者一起用才成体系。',
      en: 'Cards hold the dots. Notes and mind maps connect them — use both to build a real system.',
    },
  },
  {
    id: 'keep-cards-short',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '20–80 字、10 秒内能答完，长知识点拆成几张。',
      en: '20–80 words, answerable in 10 seconds — split big topics into several cards.',
    },
  },
  {
    id: 'honest-again-calibrates',
    category: { zh: 'FSRS 调度', en: 'FSRS' },
    text: {
      zh: '诚实点「遗忘」不是失败，是在帮 FSRS 校准下次出现的时间。',
      en: 'Pressing Again isn’t failure — it helps FSRS time your next review accurately.',
    },
  },
  {
    id: 'cap-daily-new-cards',
    category: { zh: '节奏管理', en: 'Pacing' },
    text: {
      zh: '新卡每天别加太多，今天多学一张，未来几周就多几次复习。',
      en: 'Go easy on new cards — each one added today means several reviews in the coming weeks.',
    },
  },
  {
    id: 'zoom-mindmap-lightbox',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '图表或导图看清结构胜过长篇大论，复习时点开图片就能放大细看。',
      en: 'Keep diagrams whole instead of long prose — click any card image to zoom and pan.',
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
    id: 'contrast-confusing-pairs',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '老把两个概念搞混，就专门做一张对比卡，只问它们最关键的区别。',
      en: 'Keep mixing up two concepts? Make one contrast card focused on what sets them apart.',
    },
  },
  {
    id: 'fewer-honest-reviews',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '宁可今天少刷几张，也别含糊地点「记得」，状态不好时暂停比硬撑划算。',
      en: 'Fewer honest reviews beat rushed ones — when you’re not okay, pausing beats pushing through.',
    },
  },
  {
    id: 'fsrs-order',
    category: { zh: '排序', en: 'Ordering' },
    text: {
      zh: '让 FSRS 的遗忘预测，把最可能忘的卡排在前面。',
      en: 'Let FSRS put the cards you’re most likely to forget at the front.',
    },
  },
  {
    id: 'light-session-low-energy',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '时间紧或状态一般时，用「轻量复习」过 15 张熟卡就能接住节奏。',
      en: 'Low on time or energy? Try a Light Session of 15 familiar cards to keep your habit alive.',
    },
  },
  {
    id: 'edit-cards-in-review',
    category: { zh: '卡片迭代', en: 'Card Care' },
    text: {
      zh: '复习时觉得题干别扭或太长，顺手改掉它，好卡片都是刷出来的。',
      en: 'Spot an awkward card during review? Fix it on the spot — good cards evolve over time.',
    },
  },
  {
    id: 'make-your-own',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '别人的 deck 可以借鉴，但别省掉自己动手做卡的那一步。',
      en: 'Borrow decks if you like, but don’t skip the step of making cards yourself.',
    },
  },
  {
    id: 'backlog-in-batches',
    category: { zh: '积压应对', en: 'Backlog' },
    text: {
      zh: '分批追赶积压，或让「进度减负」把压力摊到接下来几天。',
      en: 'Catch up on a backlog in batches, or let Schedule Relief spread it over the next few days.',
    },
  },
  {
    id: 'desirable-difficulty',
    category: { zh: '记忆科学', en: 'Memory Science' },
    text: {
      zh: '稍微吃力是好事，如果一张卡每次都是一眼就会，它可能不值得留在库里。',
      en: 'A little struggle is healthy — a card that’s always effortless probably doesn’t need to stay in your deck.',
    },
  },
  {
    id: 'simple-binary-grading',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '答题时只纠结「忘没忘」就行，简洁双按钮比每次选四档更省心力。',
      en: 'Just ask whether you recalled it — Simple two-button grading saves mental energy.',
    },
  },
  {
    id: 'why-not-what',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '少问「是什么」，多问「为什么 / 如果……会怎样」，能解释因果的卡记得更牢。',
      en: 'Ask “why” and “what if” more than “what” — cards that explain cause and effect stick better.',
    },
  },
  {
    id: 'example-sentence-context',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '背外语或术语时附带一句真实例句，比孤立背词典释义更容易回忆。',
      en: 'Pair new terms with a real example sentence — context beats bare definitions.',
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
    id: 'smart-wide-stage',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '长笔记和思维导图不用硬塞窄框，答题时「智能宽屏」会自动展宽舞台。',
      en: 'No need to squeeze wide notes or mind maps — Smart Auto widens the stage when needed.',
    },
  },
  {
    id: 'tags-over-deep-decks',
    category: { zh: '知识体系', en: 'Knowledge System' },
    text: {
      zh: '用标签按场景或科目归类，通常比建几十层子牌组更好整理。',
      en: 'Group by topic or source with tags — it stays cleaner than nesting dozens of subdecks.',
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
    id: 'pause-new-during-backlog',
    category: { zh: '积压应对', en: 'Backlog' },
    text: {
      zh: '积压太多时先暂停新卡，专心清完旧卡比硬添新内容更稳。',
      en: 'When reviews pile up, pause new cards first — clearing the backlog beats adding more.',
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
    id: 'flag-tricky-cards',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '复习遇到拿不准的卡先打个旗标，回头在卡片库或自定义学习里集中过。',
      en: 'Flag tricky cards while reviewing so you can filter and drill them together later.',
    },
  },
  {
    id: 'prune-the-library',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '删掉永远答不对和一眼就会的卡，留好卡比留多卡重要。',
      en: 'Drop the never-right and the always-easy — good cards beat many cards.',
    },
  },
  {
    id: 'cloze-first',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '挖掉关键词，比整句背诵更省力，也更接近真实回忆。',
      en: 'Hide the key word — it beats memorising whole sentences and mirrors real recall.',
    },
  },
  {
    id: 'streak-restart-no-guilt',
    category: { zh: '复习心态', en: 'Mindset' },
    text: {
      zh: '连续打卡断了不用懊恼，今天重新打开就算接上，别让数字替你焦虑。',
      en: 'Broken streak? Just open today’s deck and start fresh — don’t let guilt get in the way.',
    },
  },
  {
    id: 'library-for-lapses-and-tags',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '在卡片库按失误最多或熟记度最低排序，能最快揪出最该改写的卡。',
      en: 'Sort by Most Lapses or Lowest Mastery in Card Library to spot cards worth rewriting.',
    },
  },
  {
    id: 'both-ways-when-needed',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '需要双向互译或互推的内容，用正反双向卡拆成两张来记更扎实。',
      en: 'Need recall in both directions? Use Basic + Reversed so both directions get tested.',
    },
  },
  {
    id: 'bury-related-or-suspend-leech',
    category: { zh: '卡片质量', en: 'Card Quality' },
    text: {
      zh: '同一笔记衍生的关联卡先搁置到明天，老答错的卡先暂停再重写。',
      en: 'Bury sibling cards until tomorrow, and suspend stubborn cards until you rewrite them.',
    },
  },
  {
    id: 'sync-after-session',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '每天学完点顶部状态胶囊同步到 AnkiWeb，换设备继续学才不断档。',
      en: 'Sync via the top pill when you finish — your progress stays ready across devices.',
    },
  },
  {
    id: 'own-words',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '照抄原句记住的是句子，用自己的话复述才是理解。',
      en: 'Copying a sentence remembers the words — saying it in your own words remembers the idea.',
    },
  },
  {
    id: 'worth-remembering',
    category: { zh: '复习习惯', en: 'Review Habits' },
    text: {
      zh: '只把值得记十年的内容做成卡，卡片库不是收藏夹。',
      en: 'Only card what’s worth remembering for a decade — a library is not a scrapbook.',
    },
  },
  {
    id: 'type-answer-spelling',
    category: { zh: '制卡原则', en: 'Card Making' },
    text: {
      zh: '容易拼错的单词或语法，换成输入拼写核对卡，肌肉记忆会更牢。',
      en: 'For tricky spelling or syntax, try Type-in-the-Answer cards to catch small slips.',
    },
  },
  {
    id: 'stats-true-retention',
    category: { zh: '功能提示', en: 'Studio Tips' },
    text: {
      zh: '别只盯着今天刷了多少张，去学习统计看一眼真实记忆留存率更准。',
      en: 'Counts aren’t everything — check FSRS True Retention in Statistics to gauge real recall.',
    },
  },
];

export function resolveTipLocale(lang: string): TipLocale {
  return String(lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}
