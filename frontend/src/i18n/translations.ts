// ============================================================================
// Anki Modern OS — Internationalization (i18n), Relative Sync Time & Shortcuts
// Supports English ('en', default fallback) and Simplified Chinese ('zh-CN'),
// auto-following Anki client language, plus macOS / Windows / Linux key mapping.
// ============================================================================

export type LanguageOption = 'auto' | 'zh-CN' | 'en';
export type ResolvedLanguage = 'zh-CN' | 'en';
export type OSPlatform = 'mac' | 'win' | 'linux';

export function detectBrowserLanguage(): ResolvedLanguage {
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('zh')) {
      return 'zh-CN';
    }
  }
  return 'en';
}

export function detectOSPlatform(): OSPlatform {
  if (typeof navigator !== 'undefined') {
    const ua = (navigator.userAgent || navigator.platform || '').toLowerCase();
    if (ua.includes('win')) return 'win';
    if (ua.includes('linux')) return 'linux';
  }
  return 'mac';
}

export function resolveLanguage(pref: LanguageOption, ankiResolved?: string): ResolvedLanguage {
  if (pref === 'zh-CN') return 'zh-CN';
  if (pref === 'en') return 'en';
  if (ankiResolved === 'zh-CN' || ankiResolved === 'en') return ankiResolved;
  return detectBrowserLanguage();
}

/**
 * Formats keyboard shortcut strings dynamically for macOS (`Cmd`, `Option`, `Ctrl Opt M`)
 * vs Windows/Linux (`Ctrl`, `Alt`, `Ctrl Alt M`).
 */
export function formatShortcut(shortcut: string, platform: OSPlatform = 'mac'): string {
  if (platform === 'mac') return shortcut;
  return shortcut
    .replace(/\bCmd\b/g, 'Ctrl')
    .replace(/\bOption\b/g, 'Alt')
    .replace(/\bOpt\b/g, 'Alt');
}

/**
 * Item #1: Formats relative time since `lastSyncedTimestamp` (`已同步 (刚刚)` / `已同步 (X分钟前)` / `已同步 (X小时前)` / `尚未云端同步`).
 */
export function formatRelativeSyncLabel(
  lastSyncedTimestamp: number,
  lang: ResolvedLanguage,
  nowMs: number = Date.now()
): string {
  if (!lastSyncedTimestamp || lastSyncedTimestamp <= 0) {
    return lang === 'en' ? 'Not synced' : '尚未云端同步';
  }
  const diffMs = Math.max(0, nowMs - lastSyncedTimestamp);
  const diffMin = Math.floor(diffMs / 60000);
  if (lang === 'en') {
    if (diffMin < 1) return 'Synced (Just now)';
    if (diffMin < 60) return `Synced (${diffMin}m ago)`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Synced (${diffHr}h ago)`;
    const diffDays = Math.floor(diffHr / 24);
    return `Synced (${diffDays}d ago)`;
  }
  if (diffMin < 1) return '已同步 (刚刚)';
  if (diffMin < 60) return `已同步 (${diffMin}分钟前)`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `已同步 (${diffHr}小时前)`;
  const diffDays = Math.floor(diffHr / 24);
  return `已同步 (${diffDays}天前)`;
}

/**
 * Formats relative duration string without prefix (e.g. `刚刚` / `3分钟前` / `从未同步`).
 */
export function formatRelativeTimeString(
  lastSyncedTimestamp: number,
  lang: ResolvedLanguage,
  nowMs: number = Date.now()
): string {
  if (!lastSyncedTimestamp || lastSyncedTimestamp <= 0) {
    return lang === 'en' ? 'Never' : '从未同步';
  }
  const diffMs = Math.max(0, nowMs - lastSyncedTimestamp);
  const diffMin = Math.floor(diffMs / 60000);
  if (lang === 'en') {
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  }
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}天前`;
}

/**
 * Formats detailed ISO-like timestamp with seconds (YYYY-MM-DD HH:mm:ss).
 * Returns empty string if never synced.
 */
export function formatDetailedSyncTimestamp(
  lastSyncedTimestamp: number
): string {
  if (!lastSyncedTimestamp || lastSyncedTimestamp <= 0) {
    return '';
  }
  const dt = new Date(lastSyncedTimestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

/**
 * Item #1: Formats absolute sync timestamp for hover tooltip.
 */
export function formatAbsoluteSyncTooltip(
  lastSyncedTimestamp: number,
  lang: ResolvedLanguage
): string {
  if (!lastSyncedTimestamp || lastSyncedTimestamp <= 0) {
    return lang === 'en'
      ? 'Not synced to AnkiWeb · Click to sync now'
      : '尚未与 AnkiWeb 云端同步 · 点击立即同步';
  }
  const dt = new Date(lastSyncedTimestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  const absStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(
    dt.getHours()
  )}:${pad(dt.getMinutes())}`;
  return lang === 'en'
    ? `Last synced: ${absStr} · Click to sync with AnkiWeb`
    : `上次同步：${absStr} · 点击立即与 AnkiWeb 云端同步`;
}

/**
 * Item #3: Formats YYYY-MM-DD into localized full date + weekday for Heatmap floating tooltip.
 */
export function formatFullDateWithWeekday(dateIso: string, lang: ResolvedLanguage): string {
  if (!dateIso) return '';
  const parts = dateIso.split('-').map((x) => parseInt(x, 10));
  if (parts.length < 3 || parts.some(isNaN)) return dateIso;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  if (lang === 'en') {
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()} (${weekdays[dt.getDay()]})`;
  }
  const weekdaysZh = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${parts[0]}年${parts[1]}月${parts[2]}日 ${weekdaysZh[dt.getDay()]}`;
}

const DICT = {
  'zh-CN': {
    // Sidebar
    quickAddBtn: '快速制卡',
    navStudy: '学习',
    navDashboard: '今日概览',
    navLibrary: '卡片库',
    navStats: '学习统计',
    navDecks: '牌组管理',
    sidebarDecks: '牌组',
    manage: '管理',
    navTheme: '外观与主题',
    navSettings: '设置',
    nativeSwitch: '原生切换',
    streakDays: '连续 {n} 天',
    defaultUser: '学习者',
    defaultDeck: '默认牌组',

    // Dashboard
    pendingTodaySub: '{date} · 今天共 {n} 张待处理',
    noPendingTodaySub: '{date} · 今日待办已全部完成',
    synced: '已同步',
    syncNowAction: '立即同步',
    syncing: '同步中...',
    syncCompleted: '同步成功',
    syncCloudTitle: 'AnkiWeb 云端同步',
    syncStatusProtected: '已是最新',
    syncStatusSyncing: '同步进行中',
    syncDetailLastTime: '上次同步时间',
    syncDetailServer: '云端节点',
    syncDetailServerVal: 'AnkiWeb 官方云 · 状态正常',
    syncDetailFsrs: '本地集合',
    syncDetailFsrsVal: '数据一致 · FSRS 调度已就绪',
    syncDetailShortcut: '快捷操作',
    syncDetailShortcutVal: '轻按 Y 键随时发起云同步',
    syncOpenSettingsLink: '云账号与偏好设置...',
    syncNowButton: '立即同步到 AnkiWeb',
    searchPlaceholder: '搜索...',
    todayProgressTitle: '今日学习进度',
    cardsUnit: '张',
    remainingCards: '还剩 {n} 张',
    allClearedTitle: '恭喜你已完成全部牌组的学习！',
    allClearedSub: '今日共完成 {n} 张卡片复习',
    noDueTodayTitle: '今日暂无到期卡片',
    noDueTodaySub: '可前往卡片库浏览或新建卡片',
    estimatedMinutes: '预计 {n} 分钟',
    dueReviewPill: '待复习 {n}',
    dueNewPill: '新卡 {n}',
    completedPill: '已完成 {n}',
    streakTitle: '连续打卡',
    daysUnit: '天',
    streakSub: '最长 {longest} 天',
    startTodayStudy: '开始今日学习',
    myDecksTitle: '我的牌组',
    decksSummarySub: '{top} 个主牌组 · 共 {total} 个牌组',
    showTopDecksOnly: '仅显示主牌组',
    expandAllDecks: '展开全部 ({n})',
    allDecksManage: '全部牌组管理 ›',
    noDecksTitle: '当前暂无牌组',
    noDecksSub: '点击左侧「牌组管理」新建你的第一个牌组，或按 N 快速制卡',
    masteryLabel: '熟练度',
    noNewCards: '无新卡',
    subDecksCount: ' · 含 {n} 个子牌组',
    heatmapTitle: '学习热力图',
    heatmapSub: '过去 6 个月 · 累计 {n} 次复习',
    less: '少',
    more: '多',
    weekStudied: '本周已学',
    dailyAvg: '日均',
    retentionRate: '记忆正确率',
    weeklyRhythmTitle: '本周复习节奏',
    weeklyRhythmSub: '最近 7 天 · 单位：张',
    weeklyRhythmFooter: '平均 {sec} 秒 / 张 · 最长单次 {min} 分钟',

    // Reviewer & Inline Edit
    reviewCompletedTitle: '本轮复习已完成',
    reviewCompletedSub: 'FSRS 记忆调度已同步写入本地集合数据库',
    undoLastBtn: '撤销最后一张 ({key})',
    congratsTitle: '恭喜完成今日牌组复习！',
    congratsSub: '所有到期卡片均已完成 FSRS 间隔重算，记忆稳定度持续提升',
    sessionStudiedLabel: '本轮完成卡片',
    sessionAccuracyLabel: '记忆正确率',
    sessionAvgTimeLabel: '平均答题耗时',
    backToDashboard: '返回今日概览',
    enterPreviewMode: '自由预览模式（不改调度）',
    previewModeBadge: '纯预览模式 · 不修改 FSRS 进度',
    editCardTitle: '编辑卡片',
    clozeBadge: 'Cloze 挖空模板',
    autoSaved: '已自动保存',
    readAloud: '朗读',
    switchToNative: '切回原生',
    editingFieldTag: '{field} · 编辑中',
    clozeShortcutBtn: '[ ] 挖空 ({key})',
    slashInsertBtn: '/ 插入格式',
    clickToEdit: '点击编辑',
    answerSideBadge: '答案',
    questionSideBadge: '问题',
    pronounceBtn: '发音',
    fsrsPredictHeader: 'FSRS 预测 · 记得后 {ivl}再次出现',
    etymologyBadge: '词源',
    exampleBadge: '例句',
    collocationBadge: '搭配',
    tabRevealHint: '展开下一条提示',
    recallPrompt: '在脑海中回忆释义与用法，点击下方按钮揭晓答案',
    reviewedCountText: '已复习 {reps} 次 · {last}',
    showAnswerBtn: '显示答案',
    rateAgain: '遗忘',
    rateHard: '困难',
    rateGood: '记得',
    rateEasy: '简单',
    cardInfoTitle: '卡片信息',
    deckLabel: '所属牌组',
    tagsLabel: '标签',
    addTagBtn: '+ 添加',
    reviewHistoryLabel: '复习历史',
    suspendCardBtn: '暂停卡片',
    unsuspendCardBtn: '取消暂停',
    buryCardBtn: '搁置卡片 (推迟至明日)',
    unburyCardBtn: '取消搁置',
    deleteCardBtn: '删除卡片',

    // Library & Cmd+K
    libraryTitle: '卡片库',
    librarySub: '{total} 张总卡片 · {decks} 个牌组 · 当前匹配 {matched} 张',
    searchingDb: ' · 正在检索数据库...',
    searchLibraryPlaceholder: '搜索卡片...',
    statusFilterLabel: '状态',
    diffFilterLabel: '难度',
    tagFilterLabel: '标签',
    deckFilterLabel: '牌组',
    resetFilters: '重置筛选',
    matchedCountText: '{n} 张符合条件',
    emptyLibraryTitle: '当前筛选条件下暂无卡片',
    emptyLibrarySub: '你可以点击上方「重置筛选」查看全部卡片，或新建卡片',
    loadMoreCards: '加载更多卡片（已加载 {loaded} / {total} 张）',
    selectedCountBadge: '已选 {n} 张',
    batchSuspend: '暂停',
    batchUnsuspend: '取消暂停',
    batchBury: '搁置至明日',
    batchUnbury: '取消搁置',
    batchAddTag: '加标签',
    batchResetProgress: '重置进度',
    batchMoveDeck: '移动牌组',
    batchDelete: '删除',
    cancel: '取消',
    confirm: '确认',

    // Design System & Preferences
    designSystemTitle: '外观、语言与设计规范',
    designSystemSub: '偏好设置自动持久化至 Anki 插件配置 · 支持浅色 / 深色 / 极黑三套主题',
    languageLabel: '界面语言 (Language)',
    langAuto: '自动跟随 Anki',
    langZh: '简体中文',
    langEn: 'English',
    nicknameLabel: '个人昵称（留空则读取 Anki 账户名）',
    nicknamePlaceholder: '输入自定义称呼...',
    saveNickname: '保存',
    themeLight: '浅色',
    themeDark: '深色',
    themeOled: '极黑',

    // Vacation & Anti-Avalanche Rescue
    vacationBtn: '休假模式',
    vacationActiveBadge: '休假保护中',
    vacationRemainingDays: '剩余 {n} 天',
    vacationModalTitle: '休假模式',
    vacationModalSub: '开启休假后，自动暂停每日新卡投放、顺延到期复习卡，并冻结连续打卡记录。',
    vacationDurationLabel: '休假时长',
    vacationReasonLabel: '休假备注',
    vacationReasonShift: '临时值班',
    vacationReasonTrip: '差旅出行',
    vacationReasonExam: '备考冲刺',
    vacationReasonRest: '身心休整',
    freezeNewCardsLabel: '暂停新卡投放',
    shiftReviewCardsLabel: '顺延到期复习卡片',
    freezeStreakLabel: '冻结连续打卡记录',
    startVacationBtn: '开启休假保护',
    endVacationBtn: '提前结束休假',
    backlogRescueBtn: '进度减负',
    backlogModalTitle: '进度减负',
    backlogModalSub: '通过 FSRS 无损重排将到期卡片平滑分散至未来数天，100% 保留原有记忆间隔。',
    amortizeOptionTitle: '均匀平摊',
    amortizeOptionSub: '将积压卡片按天均匀分散，每日仅增加少量复习负担。',
    shiftOptionTitle: '整体顺延',
    shiftOptionSub: '将今日到期卡片整体推迟指定天数，腾出完整时间窗口。',
    amortizeDaysLabel: '分摊周期',
    perDayEstimateLabel: '预计每日新增',
    executeRescueBtn: '执行平摊方案',
    lowEnergyBtn: '轻量复习',
    lowEnergySub: '精选 15 张最熟悉的到期卡片，用最小精力保持每日学习习惯',
  },
  en: {
    // Sidebar
    quickAddBtn: 'Quick Add',
    navStudy: 'Study',
    navDashboard: 'Dashboard',
    navLibrary: 'Card Library',
    navStats: 'Statistics',
    navDecks: 'Decks',
    sidebarDecks: 'Decks',
    manage: 'Manage',
    navTheme: 'Appearance & I18n',
    navSettings: 'Settings',
    nativeSwitch: 'Native UI',
    streakDays: '{n}d streak',
    defaultUser: 'Learner',
    defaultDeck: 'Default',

    // Dashboard
    pendingTodaySub: '{date} · {n} cards due today',
    noPendingTodaySub: '{date} · All due cards completed',
    synced: 'Synced',
    syncNowAction: 'Sync now',
    syncing: 'Syncing...',
    syncCompleted: 'Sync Complete',
    syncCloudTitle: 'AnkiWeb Cloud Sync',
    syncStatusProtected: 'Up to Date',
    syncStatusSyncing: 'Syncing...',
    syncDetailLastTime: 'Last Synced',
    syncDetailServer: 'Cloud Service',
    syncDetailServerVal: 'AnkiWeb Official · Normal',
    syncDetailFsrs: 'Collection DB',
    syncDetailFsrsVal: 'Consistent · FSRS Ready',
    syncDetailShortcut: 'Shortcut',
    syncDetailShortcutVal: 'Press Y anytime to sync',
    syncOpenSettingsLink: 'Cloud & Sync Preferences...',
    syncNowButton: 'Sync with AnkiWeb Now',
    searchPlaceholder: 'Search...',
    todayProgressTitle: "Today's Progress",
    cardsUnit: 'cards',
    remainingCards: '{n} remaining',
    allClearedTitle: 'Congratulations! All decks completed!',
    allClearedSub: 'Completed {n} cards today',
    noDueTodayTitle: 'No cards due today',
    noDueTodaySub: 'Browse the Card Library or press N to create new cards',
    estimatedMinutes: 'Est. {n} min',
    dueReviewPill: 'Due {n}',
    dueNewPill: 'New {n}',
    completedPill: 'Done {n}',
    streakTitle: 'Daily Streak',
    daysUnit: 'days',
    streakSub: 'Best {longest}d',
    startTodayStudy: 'Study Now',
    myDecksTitle: 'My Decks',
    decksSummarySub: '{top} top decks · {total} total',
    showTopDecksOnly: 'Top Decks Only',
    expandAllDecks: 'Show All ({n})',
    allDecksManage: 'Manage Decks ›',
    noDecksTitle: 'No decks found',
    noDecksSub: 'Go to Decks to create your first deck, or press N to add a card',
    masteryLabel: 'Mastery',
    noNewCards: '0 new',
    subDecksCount: ' · {n} subdecks',
    heatmapTitle: 'Activity Heatmap',
    heatmapSub: 'Past 6 months · {n} total reviews',
    less: 'Less',
    more: 'More',
    weekStudied: 'This Week',
    dailyAvg: 'Daily Avg',
    retentionRate: 'Retention',
    weeklyRhythmTitle: 'Weekly Rhythm',
    weeklyRhythmSub: 'Last 7 days · Cards reviewed',
    weeklyRhythmFooter: 'Avg {sec}s / card · Longest session {min}m',

    // Reviewer & Inline Edit
    reviewCompletedTitle: 'Session Complete',
    reviewCompletedSub: 'FSRS scheduling states have been saved to your collection',
    undoLastBtn: 'Undo Last ({key})',
    congratsTitle: 'All Due Cards Completed!',
    congratsSub: 'Every due card in this deck has been scheduled by FSRS',
    sessionStudiedLabel: 'Cards Reviewed',
    sessionAccuracyLabel: 'Accuracy',
    sessionAvgTimeLabel: 'Avg Time / Card',
    backToDashboard: 'Back to Dashboard',
    enterPreviewMode: 'Preview Mode (No Reschedule)',
    previewModeBadge: 'Preview Mode · FSRS Unchanged',
    editCardTitle: 'Edit Card',
    clozeBadge: 'Cloze Note',
    autoSaved: 'Auto-saved',
    readAloud: 'Audio',
    switchToNative: 'Native UI',
    editingFieldTag: '{field} · Editing',
    clozeShortcutBtn: '[ ] Cloze ({key})',
    slashInsertBtn: '/ Format',
    clickToEdit: 'Click to edit',
    answerSideBadge: 'Answer',
    questionSideBadge: 'Question',
    pronounceBtn: 'Audio',
    fsrsPredictHeader: 'FSRS · Good schedules {ivl}',
    etymologyBadge: 'Origin',
    exampleBadge: 'Example',
    collocationBadge: 'Usage',
    tabRevealHint: 'Reveal next hint',
    recallPrompt: 'Recall the answer in your mind, then click below to reveal',
    reviewedCountText: '{reps} reviews · {last}',
    showAnswerBtn: 'Show Answer',
    rateAgain: 'Again',
    rateHard: 'Hard',
    rateGood: 'Good',
    rateEasy: 'Easy',
    cardInfoTitle: 'Card Inspector',
    deckLabel: 'Deck',
    tagsLabel: 'Tags',
    addTagBtn: '+ Tag',
    reviewHistoryLabel: 'Review Log',
    suspendCardBtn: 'Suspend',
    unsuspendCardBtn: 'Unsuspend',
    buryCardBtn: 'Bury Card',
    unburyCardBtn: 'Unbury',
    deleteCardBtn: 'Delete Card',

    // Library & Cmd+K
    libraryTitle: 'Card Library',
    librarySub: '{total} total · {decks} decks · {matched} matched',
    searchingDb: ' · Querying DB...',
    searchLibraryPlaceholder: 'Search cards...',
    statusFilterLabel: 'Status',
    diffFilterLabel: 'Difficulty',
    tagFilterLabel: 'Tag',
    deckFilterLabel: 'Deck',
    resetFilters: 'Reset',
    matchedCountText: '{n} matched',
    emptyLibraryTitle: 'No cards match current filters',
    emptyLibrarySub: 'Click Reset above to view all cards, or create a new card',
    loadMoreCards: 'Load More ({loaded} / {total} loaded)',
    selectedCountBadge: '{n} selected',
    batchSuspend: 'Suspend',
    batchUnsuspend: 'Unsuspend',
    batchBury: 'Bury',
    batchUnbury: 'Unbury',
    batchAddTag: 'Add Tag',
    batchResetProgress: 'Reset',
    batchMoveDeck: 'Move Deck',
    batchDelete: 'Delete',
    cancel: 'Cancel',
    confirm: 'Confirm',

    // Design System & Preferences
    designSystemTitle: 'Appearance, Language & Design Tokens',
    designSystemSub: 'Preferences persist to Anki Add-on Config · Light / Dark / OLED Black',
    languageLabel: 'Interface Language',
    langAuto: 'Follow Anki Client',
    langZh: '简体中文',
    langEn: 'English',
    nicknameLabel: 'Display Nickname (blank uses Anki Profile name)',
    nicknamePlaceholder: 'Custom display name...',
    saveNickname: 'Save',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeOled: 'OLED Black',

    // Vacation & Anti-Avalanche Rescue
    vacationBtn: 'Vacation Mode',
    vacationActiveBadge: 'Vacation Active',
    vacationRemainingDays: '{n}d left',
    vacationModalTitle: 'Vacation Mode',
    vacationModalSub: 'Pause daily new cards, postpone due reviews, and freeze your active streak during time off.',
    vacationDurationLabel: 'Duration',
    vacationReasonLabel: 'Note',
    vacationReasonShift: 'On-Call Shift',
    vacationReasonTrip: 'Business Trip',
    vacationReasonExam: 'Exam Sprint',
    vacationReasonRest: 'Rest & Recovery',
    freezeNewCardsLabel: 'Pause New Cards',
    shiftReviewCardsLabel: 'Postpone Due Reviews',
    freezeStreakLabel: 'Freeze Daily Streak',
    startVacationBtn: 'Start Vacation',
    endVacationBtn: 'End Vacation Early',
    backlogRescueBtn: 'Schedule Relief',
    backlogModalTitle: 'Schedule Relief',
    backlogModalSub: 'Smoothly redistribute overdue cards across upcoming days while preserving 100% of FSRS memory intervals.',
    amortizeOptionTitle: 'Even Spread',
    amortizeOptionSub: 'Spread overdue cards evenly across multiple days to keep daily sessions light.',
    shiftOptionTitle: 'Shift Forward',
    shiftOptionSub: 'Postpone due cards by a set number of days to clear a clean window.',
    amortizeDaysLabel: 'Spread Horizon',
    perDayEstimateLabel: 'Est. Daily Add',
    executeRescueBtn: 'Apply Reschedule',
    lowEnergyBtn: 'Light Session',
    lowEnergySub: 'Review 15 high-stability due cards to keep your daily habit going with minimal effort',
  },
} as const;

export type TranslationKey = keyof (typeof DICT)['zh-CN'];

export function translate(
  lang: ResolvedLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const table = DICT[lang] || DICT.en;
  let text: string = table[key] || DICT.en[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
