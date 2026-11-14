# AnkiWeb 上架资料（v1.5.7+ / 出海优化版）

> 上传入口：<https://ankiweb.net/shared/addons> → Edit / Upload
> 表单只有五个字段：Title、Tags、Support Page、Branches、Description。

---

## 1. Title（限 80 字符）

表单对 Title 的说明是「A one-line description, less than 80 characters」，它出现在 AnkiWeb 插件目录的列表页并直接参与站内关键词检索。

英文/国际用户搜索插件时常输入 `modern`、`UI`、`theme`、`dashboard`、`workspace`、`FSRS` 等关键词。相比纯品牌多语言词组，**英文价值主张优先 + 多语言能力提示**能让搜索者在一秒内看懂定位并点击进入。

**推荐（66 字符，高点击率 + 强关键词覆盖）**

```
Anki Studio — Modern UI Workspace, Dashboard & FSRS (16 Languages)
```

<details>
<summary>其他备选（字符数均实测）</summary>

| 方案 | 字符 | 内容 | 取舍 |
|---|---|---|---|
| 多语言词组（旧版） | 72 | `Anki Studio · 工作室 · スタジオ · 스튜디오 · Estudio · Atelier · Werkstatt · Студия` | 缺少英文功能关键词（modern / ui / dashboard / fsrs），列表搜索不易命中 |
| 极简 + 16 语 | 64 | `Anki Studio — Modern Anki Workspace, Dashboard & FSRS (16 Langs)` | 缩写略影响阅读完整度 |
| 极简聚焦版 | 65 | `Anki Studio — Modern Minimalist Workspace, Dashboard & FSRS Stats` | 缺少多语言信号，但纯英文搜索意图更聚焦 |

</details>

## 2. Tags（空格分隔）

```
anki addon ui theme dashboard modern minimalist fsrs scheduler analytics
```

## 3. Support Page（必须以 http 开头）

```
https://github.com/gripet43/anki-studio/issues
```

仓库为 public，链接与描述里的 GitHub raw 图片直链均可匿名访问。**更新 AnkiWeb 文案前请确保对应资产已推送到 GitHub `main` 分支**。

## 4. Branches

只保留默认分支即可。AnkiWeb 会用包内 `manifest.json` 的 `min_point_version`（当前 `260904`）生成下载行，正常情况下页面会显示单行 **26.09.4+**。

---

## 5. Description

AnkiWeb 实测已原生支持标准 Markdown（包括 `##` 二级标题、加粗、行内代码、无序/有序列表、`---` 分隔线、图片与链接）。以下整段代码块可直接全选复制到 AnkiWeb **Description** 输入框。

预览动图由真实编译前端 + Python `BridgeRouter` + 英文模拟牌组渲染合成，再经 [`scripts/build_preview_gif.py`](../scripts/build_preview_gif.py) 量化生成：当前为 **1200×850 / 5 帧 × 2.8s / 14.0s / 613 KB**，内容依次是：

1. **Today Dashboard（浅色）**：日活环形进度、46 天连胜、`USMLE Step 1` / `Japanese Core 2K` 双牌组、26×7 热力图与周节奏
2. **Reviewer（浅色）**：`Cardiology · Cloze Note`（Frank-Starling Law）、彩旗、FSRS 复习间隔按钮
3. **Card Library（浅色）**：452 张卡片网格视图、医学填空 + KaTeX 公式 + 日语卡片混排
4. **FSRS Analytics（深石墨暗黑模式）**：30 天负载预测、成熟度分布、12 周保持率趋势、Strict True Retention
5. **Schedule Relief（浅色弹窗）**：积压平摊 7 天方案（另已在 `docs/assets/screenshots/05-vacation.png` 同步留存同风格 Vacation Mode 高清图）

```markdown
A calm, Apple HIG–inspired desktop workspace for Anki — with FSRS analytics, Vacation Mode, Schedule Relief, and zero mini-games.

![Anki Studio preview](https://raw.githubusercontent.com/gripet43/anki-studio/main/docs/assets/anki-studio-preview.gif)

## Quick Install

1. Open Anki (**26.09.4 or later**) and go to **Tools → Add-ons → Get Add-ons...**
2. Paste code: `1071937836`
3. Restart Anki.

## Built for Focus, Not Distractions

Most Anki overhauls add mini-games, pets, or cluttered side panels. Anki Studio takes the opposite approach: clean typography, low-friction daily tracking, and burnout protection designed for serious learners.

- **Today Dashboard** — daily progress ring, streak counter, 26×7 study heatmap, deck mastery bars, and weekly rhythm
- **Calm Reviewer & Cloze Support** — spacious card stage, FSRS interval previews (`Again / Hard / Good / Easy`), flags, tags, and MathJax/KaTeX rendering
- **FSRS Analytics & Memory Insights** — 30-day review workload forecast, card maturity breakdown, 12-week retention trend, 24-hour focus window, and strict FSRS True Retention
- **Vacation Mode & Schedule Relief** — freeze new-card caps, snapshot & shift due dates without touching intervals, preserve streaks, spread overdue backlogs over *N* days, or start a curated 10–15 card **Light Session** on low-energy days
- **Card Library & Batch Actions** — filter instantly by status, difficulty, flag, tag, or deck; multi-select to edit, suspend, bury, move, or delete in bulk
- **Rich Card Editor & Script Compatibility** — write Cloze notes, tables, and math formatting natively; template-driven and Image Occlusion cards render faithfully in isolated **Compatibility Mode** (authoring/editing Image Occlusion masks stays in Anki's native editor so card structure is never altered)
- **Light, Dark & True OLED Themes** — 3 display modes × 8 harmonious accent palettes synced cleanly across decks and charts

## Safe by Design: Zero Lock-In

- **100% Native Anki APIs** — every review, reschedule, and note edit runs through Anki's official Python API (`col.update_card` / `col.sched`), keeping **AnkiWeb sync** completely intact
- **Instant Escape Hatch** — switch back to classic Anki anytime in 1 second via 3 built-in paths (`Ctrl+Opt+M` on macOS / `Ctrl+Alt+M` on Windows & Linux, Tools menu, or top-bar toggle)
- **16 Interface Languages** — auto-follows your Anki language (English, 简体中文, 繁體中文, 日本語, 한국어, Deutsch, Français, Español, Italiano, Português (Brasil), Русский, Nederlands, Polski, Türkçe, Tiếng Việt, العربية)

## Privacy & Links

Card contents, deck names, tags, and search queries **never leave your device**. Optional anonymous usage counts (app launches, daily active status, session-size buckets, feature counters) can be turned off anytime in **Settings**.

- **Requires Anki 26.09.4 or later** (macOS, Windows, Linux) · **MIT License**
- GitHub, full changelog & issue tracker: https://github.com/gripet43/anki-studio

---

## 简体中文

Anki Studio 把 Anki 主窗口变成桌面级沉浸式工作区，同时与 AnkiWeb 同步完全兼容。

- **今日概览** — 连续打卡、26×7 学习热力图、牌组掌握度、本周复习节奏
- **牌组配色由强调色派生** — 8 套配色 × 明 / 暗 / 纯黑三种主题
- **休假模式** — 冻结新卡上限、顺延到期日期、连胜冰冻
- **进度减负** — 不改变间隔，把逾期卡平摊到 N 天
- **低能量极简打卡** — 精选 10–15 张的轻量队列
- **富文本制卡** — 挖空、表格、公式（原生图片遮挡卡在兼容/只读模式中正常显示与复习）
- **16 种界面语言**，快捷键自动适配 Cmd / Ctrl
- **三重返回原生界面** — 快捷键、菜单、工具栏按钮
- **卡片库与检索** — 按状态、难度、旗帜、标签或牌组筛选；多选模式下批量编辑、暂停、搁置、移动或删除
- **脚本型卡组兼容** — 选择题模板、图片遮挡等依赖模板脚本的卡片，自动在沙盒兼容模式中渲染
- **学习小贴士** — 牌组旁每日轮播一条制卡与复习原则
- **隐私优先。** 卡片内容、牌组名、标签与搜索词永远不会离开你的设备。可选的匿名使用计数（启动、日活、复习张数区间、功能使用）可在设置中关闭；所有写操作仍走 Anki 官方 API，AnkiWeb 同步不受影响。

**需要 Anki 26.09.4 及以上。** MIT 许可，源码与问题反馈见上方链接。

## 繁體中文

Anki Studio 把 Anki 主視窗變成桌面級沉浸式工作區，同時與 AnkiWeb 同步完全相容。

- **今日概覽** — 連續打卡、26×7 學習熱力圖、牌組掌握度、本週複習節奏
- **牌組配色由強調色派生** — 8 套配色 × 明 / 暗 / 純黑三種主題
- **休假模式** — 凍結新卡上限、順延到期日期、連勝冰凍
- **進度減負** — 不改變間隔，把逾期卡平攤到 N 天
- **低能量極簡打卡** — 精選 10–15 張的輕量佇列
- **富文字製卡** — 挖空、表格、公式（原生圖片遮擋卡於相容／唯讀模式中正常顯示與複習）
- **16 種介面語言**，快速鍵自動適配 Cmd / Ctrl
- **三重返回原生介面** — 快速鍵、選單、工具列按鈕
- **卡片庫與檢索** — 依狀態、難度、旗標、標籤或牌組篩選；在多選模式下批次編輯、暫停、擱置、移動或刪除
- **腳本型牌組相容** — 選擇題模板、圖片遮擋等依賴模板腳本的卡片，自動在沙盒相容模式中渲染
- **學習小提示** — 牌組旁每日輪播一則製卡與複習原則
- **隱私優先。** 卡片內容、牌組名、標籤與搜尋詞永遠不會離開你的裝置。可選的匿名使用計數（啟動、日活、複習張數區間、功能使用）可在設定中關閉；所有寫入操作仍走 Anki 官方 API，AnkiWeb 同步不受影響。

**需要 Anki 26.09.4 以上。** MIT 授權，原始碼與問題回報見上方連結。

## 日本語

Anki Studio は Anki のメインウィンドウをデスクトップ級のワークスペースに置き換えます。AnkiWeb 同期とは完全に互換です。

- **今日の概要** — 連続学習日数、26×7 の学習ヒートマップ、デッキ習熟度、週間リズム
- **デッキの配色はアクセントカラーから生成** — 8 色 × ライト / ダーク / OLED
- **休暇モード** — 新規カード上限の凍結、期日の繰り下げ、連続記録の凍結
- **負担軽減** — 間隔を変えずに期限切れカードを N 日に分散
- **低エネルギー学習** — 10〜15 枚だけの軽量キュー
- **リッチテキストエディタ** — 穴埋め、表、数式（Image Occlusion カードの閲覧・復習は互換表示で対応）
- **16 言語の UI**、ショートカットは Cmd / Ctrl を自動判別
- **ネイティブ Anki に戻る手段が 3 つ** — ホットキー、メニュー、ツールバー
- **カードライブラリと検索** — 状態・難易度・フラグ・タグ・デッキで絞り込み、複数選択で一括編集・一時停止・保留・移動・削除
- **スクリプト型カード互換** — 選択式テンプレートや Image Occlusion など、テンプレートスクリプトに依存するカードをサンドボックス互換モードで描画
- **学習のヒント** — デッキの横に、カード作成と復習の原則を毎日ひとつ
- **プライバシー優先。** カード内容・デッキ名・タグ・検索語が端末外に出ることはありません。任意の匿名利用カウント（起動・日次アクティブ・復習枚数帯・機能利用）は設定でオフにできます。書き込みはすべて Anki 公式 API 経由で、同期に影響しません。

**Anki 26.09.4 以降が必要です。** MIT ライセンス。

## 한국어

Anki Studio는 Anki의 메인 창을 데스크톱급 작업 공간으로 바꿉니다. AnkiWeb 동기화와 완전히 호환됩니다.

- **오늘 개요** — 연속 학습일, 26×7 학습 히트맵, 덱 숙련도, 주간 리듬
- **덱 색상은 강조색에서 생성** — 8가지 팔레트 × 라이트 / 다크 / OLED
- **휴가 모드** — 새 카드 한도 동결, 만기일 미루기, 연속 기록 동결
- **진도 완화** — 간격을 바꾸지 않고 만기 카드를 N일에 분산
- **저에너지 학습** — 10~15장만 골라 주는 가벼운 큐
- **리치 텍스트 편집기** — 빈칸, 표, 수식 (Image Occlusion 카드는 호환 모드로 읽기 전용 표시 및 복습 지원)
- **16개 언어 UI**, 단축키는 Cmd / Ctrl 자동 적용
- **네이티브 Anki로 돌아가는 세 가지 경로** — 단축키, 메뉴, 툴바 버튼
- **카드 라이브러리와 검색** — 상태·난이도·플래그·태그·덱으로 필터링하고, 다중 선택으로 일괄 편집·일시 중지·묻기·이동·삭제
- **스크립트 카드 호환** — 선택형 템플릿, Image Occlusion 등 템플릿 스크립트에 의존하는 카드를 샌드박스 호환 모드로 렌더링
- **학습 팁** — 덱 옆에서 카드 제작과 복습 원칙을 매일 하나씩
- **프라이버시 우선.** 카드 내용, 덱 이름, 태그, 검색어는 기기를 떠나지 않습니다. 선택적 익명 사용 카운트(실행, 일일 활성, 복습 장수 구간, 기능 사용)는 설정에서 끌 수 있습니다. 모든 쓰기는 Anki 공식 API를 사용하므로 동기화에 영향이 없습니다.

**Anki 26.09.4 이상 필요.** MIT 라이선스.

## Deutsch

Anki Studio verwandelt das Hauptfenster von Anki in einen Arbeitsbereich im Desktop-Stil – vollständig kompatibel mit der AnkiWeb-Synchronisierung.

- **Tagesübersicht** — Streak, 26×7-Lern-Heatmap, Stapel-Fortschritt, Wochenrhythmus
- **Stapelfarben aus der Akzentfarbe abgeleitet** — 8 Paletten × Hell / Dunkel / OLED
- **Urlaubsmodus** — Limit für neue Karten einfrieren, Fälligkeiten verschieben, Streak einfrieren
- **Pensum entlasten** — überfällige Karten ohne Änderung der Intervalle auf N Tage verteilen
- **Lernsitzung mit wenig Energie** — eine kuratierte Warteschlange von 10–15 Karten
- **Rich-Text-Editor** — Lücke, Tabellen, Formeln (native Image-Occlusion-Karten werden schreibgeschützt im Kompatibilitätsmodus angezeigt)
- **16 Oberflächensprachen**, Cmd/Ctrl wird automatisch angepasst
- **Drei Wege zurück zum nativen Anki** — Hotkey, Menü, Werkzeugleiste
- **Kartenbibliothek & Suche** — filtern nach Status, Schwierigkeit, Flag, Tag oder Stapel; im Mehrfachauswahl-Modus bearbeiten, aussetzen, zurückstellen, verschieben oder löschen
- **Kompatibilität mit Skript-Karten** — Auswahlvorlagen, Image Occlusion und andere templategesteuerte Karten werden in einem isolierten Kompatibilitätsmodus gerendert
- **Lerntipps** — täglich ein ruhiger Grundsatz zum Kartenmachen und Wiederholen neben deinen Stapeln
- **Datenschutz zuerst.** Karteninhalte, Stapelnamen, Tags und Suchbegriffe verlassen dein Gerät nie. Optionale anonyme Nutzungszähler (Starts, tägliche Aktivität, Kartenbereiche, Funktionsnutzung) lassen sich in den Einstellungen abschalten; alle Schreibvorgänge laufen über Ankis offizielle API, die Synchronisierung bleibt intakt.

**Erfordert Anki 26.09.4 oder neuer.** MIT-Lizenz.

## Français

Anki Studio transforme la fenêtre principale d'Anki en espace de travail de bureau, tout en restant pleinement compatible avec la synchronisation AnkiWeb.

- **Vue du jour** — série de jours, heatmap 26×7, maîtrise des paquets, rythme hebdomadaire
- **Couleurs des paquets dérivées de la couleur d'accent** — 8 palettes × clair / sombre / OLED
- **Mode vacances** — gel des limites de nouvelles cartes, report des échéances, gel de la série
- **Alléger la charge** — répartir les cartes en retard sur N jours sans toucher aux intervalles
- **Session à faible énergie** — une file de 10 à 15 cartes seulement
- **Éditeur de cartes enrichi** — texte à trous, tableaux, formules (les cartes Image Occlusion natives restent compatibles en lecture et révision)
- **16 langues d'interface**, raccourcis Cmd/Ctrl adaptés automatiquement
- **Trois retours vers Anki natif** — raccourci, menu, barre d'outils
- **Bibliothèque et recherche de cartes** — filtrer par statut, difficulté, drapeau, étiquette ou paquet ; en mode sélection multiple, modifier, suspendre, reporter, déplacer ou supprimer
- **Compatibilité des cartes à script** — les modèles à choix multiple, Image Occlusion et autres cartes pilotées par script s'affichent dans un mode compatibilité isolé
- **Conseils d'étude** — chaque jour un principe discret sur la création et la révision des cartes, à côté de vos paquets
- **Priorité à la vie privée.** Le contenu des cartes, les noms de paquets, les étiquettes et les recherches ne quittent jamais votre appareil. Des compteurs d'usage anonymes optionnels (lancements, activité quotidienne, tranches de cartes, usage des fonctions) peuvent être désactivés dans les réglages ; toutes les écritures passent par l'API officielle d'Anki, la synchronisation reste intacte.

**Nécessite Anki 26.09.4 ou supérieur.** Licence MIT.

## Español

Anki Studio convierte la ventana principal de Anki en un espacio de trabajo de escritorio, manteniendo total compatibilidad con la sincronización de AnkiWeb.

- **Vista de hoy** — racha, mapa de calor 26×7, dominio del mazo, ritmo semanal
- **Colores de mazo derivados del color de acento** — 8 paletas × claro / oscuro / OLED
- **Modo vacaciones** — congela límites de tarjetas nuevas, aplaza vencimientos, congela la racha
- **Aliviar carga** — reparte las tarjetas atrasadas en N días sin tocar los intervalos
- **Sesión de baja energía** — una cola de solo 10–15 tarjetas
- **Editor de tarjetas enriquecido** — hueco, tablas, fórmulas (las tarjetas nativas de Image Occlusion se muestran fielmente en modo solo lectura)
- **16 idiomas de interfaz**, con atajos Cmd/Ctrl automáticos
- **Tres formas de volver a Anki nativo** — atajo, menú y botón de la barra
- **Biblioteca y búsqueda de tarjetas** — filtra por estado, dificultad, bandera, etiqueta o mazo; en modo multiselección, edita, suspende, entierra, mueve o elimina en lote
- **Compatibilidad con tarjetas con script** — las plantillas de opción múltiple, Image Occlusion y otras tarjetas basadas en scripts se muestran en un modo de compatibilidad aislado
- **Consejos de estudio** — cada día un principio discreto sobre crear y repasar tarjetas, junto a tus mazos
- **Privacidad primero.** El contenido de las tarjetas, los nombres de mazos, las etiquetas y las búsquedas nunca salen de tu dispositivo. Los contadores de uso anónimos opcionales (inicios, actividad diaria, tramos de tarjetas, uso de funciones) se pueden desactivar en Ajustes; todas las escrituras usan la API oficial de Anki, así que la sincronización no se ve afectada.

**Requiere Anki 26.09.4 o superior.** Licencia MIT.

## Italiano

Anki Studio trasforma la finestra principale di Anki in uno spazio di lavoro desktop, restando pienamente compatibile con la sincronizzazione AnkiWeb.

- **Panoramica di oggi** — serie, mappa di calore 26×7, padronanza dei mazzi, ritmo settimanale
- **Colori dei mazzi derivati dal colore d'accento** — 8 palette × chiaro / scuro / OLED
- **Modalità vacanza** — blocca i limiti delle nuove carte, sposta le scadenze, congela la serie
- **Alleggerisci il carico** — distribuisce le carte scadute su N giorni senza toccare gli intervalli
- **Sessione a bassa energia** — una coda di sole 10–15 carte
- **Editor di carte avanzato** — cloze, tabelle, formule (le carte Image Occlusion native restano visibili e ripassabili in modalità compatibilità)
- **16 lingue dell'interfaccia**, scorciatoie Cmd/Ctrl automatiche
- **Tre modi per tornare ad Anki nativo** — scorciatoia, menu, barra degli strumenti
- **Libreria e ricerca delle carte** — filtra per stato, difficoltà, bandiera, tag o mazzo; in modalità selezione multipla modifica, sospendi, rimanda, sposta o elimina
- **Compatibilità con carte a script** — i modelli a scelta multipla, Image Occlusion e altre carte basate su script vengono visualizzati in una modalità compatibilità isolata
- **Consigli di studio** — ogni giorno un principio discreto su come creare e ripassare le carte, accanto ai tuoi mazzi
- **Privacy prima.** Il contenuto delle carte, i nomi dei mazzi, i tag e le ricerche non lasciano mai il tuo dispositivo. I conteggi d'uso anonimi opzionali (avvii, attività giornaliera, fasce di carte, uso delle funzioni) possono essere disattivati nelle impostazioni; tutte le scritture passano dall'API ufficiale di Anki, la sincronizzazione resta intatta.

**Richiede Anki 26.09.4 o successivo.** Licenza MIT.

## Português (Brasil)

O Anki Studio transforma a janela principal do Anki em um espaço de trabalho de desktop, mantendo total compatibilidade com a sincronização do AnkiWeb.

- **Visão de hoje** — sequência, mapa de calor 26×7, domínio do baralho, ritmo semanal
- **Cores dos baralhos derivadas da cor de destaque** — 8 paletas × claro / escuro / OLED
- **Modo férias** — congela limites de cartões novos, adia vencimentos, congela a sequência
- **Aliviar carga** — distribui cartões atrasados em N dias sem alterar os intervalos
- **Sessão de baixa energia** — uma fila de apenas 10–15 cartões
- **Editor de cartões avançado** — cloze, tabelas, fórmulas (cartões nativos de Image Occlusion são exibidos normalmente para revisão)
- **16 idiomas de interface**, com atalhos Cmd/Ctrl automáticos
- **Três formas de voltar ao Anki nativo** — atalho, menu e botão da barra
- **Biblioteca e busca de cartões** — filtre por status, dificuldade, bandeira, etiqueta ou baralho; no modo de seleção múltipla, edite, suspenda, enterre, mova ou exclua em lote
- **Compatibilidade com cartões com script** — modelos de múltipla escolha, Image Occlusion e outros cartões baseados em scripts são exibidos em um modo de compatibilidade isolado
- **Dicas de estudo** — todos os dias um princípio discreto sobre criar e revisar cartões, ao lado dos seus baralhos
- **Privacidade em primeiro lugar.** O conteúdo dos cartões, nomes de baralhos, etiquetas e buscas nunca saem do seu dispositivo. Contagens de uso anônimas opcionais (inícios, atividade diária, faixas de cartões, uso de recursos) podem ser desativadas nas configurações; todas as gravações usam a API oficial do Anki, então a sincronização continua intacta.

**Requer Anki 26.09.4 ou superior.** Licença MIT.

## Русский

Anki Studio превращает главное окно Anki в полноценное рабочее пространство, полностью совместимое с синхронизацией AnkiWeb.

- **Обзор дня** — серия дней, тепловая карта 26×7, освоение колод, недельный ритм
- **Цвета колод выводятся из акцентного цвета** — 8 палитр × светлая / тёмная / OLED
- **Режим отпуска** — заморозка лимита новых карт, сдвиг сроков, заморозка серии
- **Разгрузка** — распределение просроченных карт на N дней без изменения интервалов
- **Сессия «мало сил»** — очередь всего из 10–15 карт
- **Редактор карт** — пропуск, таблицы, формулы (карточки Image Occlusion отображаются для повторения в режиме совместимости)
- **16 языков интерфейса**, горячие клавиши Cmd/Ctrl подстраиваются автоматически
- **Три способа вернуться в нативный Anki** — горячая клавиша, меню, кнопка на панели
- **Библиотека и поиск карточек** — фильтр по статусу, сложности, флагу, тегу или колоде; в режиме множественного выбора — пакетное редактирование, приостановка, откладывание, перемещение и удаление
- **Совместимость со скриптовыми карточками** — шаблоны с выбором ответа, Image Occlusion и другие карточки на скриптах отображаются в изолированном режиме совместимости
- **Советы по учёбе** — каждый день один короткий принцип о создании и повторении карточек рядом с вашими колодами
- **Приватность прежде всего.** Содержимое карточек, названия колод, теги и поисковые запросы никогда не покидают устройство. Необязательные анонимные счётчики (запуски, дневная активность, диапазоны карточек, использование функций) отключаются в настройках; все записи идут через официальный API Anki, синхронизация не страдает.

**Требуется Anki 26.09.4 или новее.** Лицензия MIT.

## Nederlands

Anki Studio verandert het hoofdvenster van Anki in een desktop-werkruimte, volledig compatibel met AnkiWeb-synchronisatie.

- **Overzicht van vandaag** — reeks, 26×7 heatmap, beheersing per stapel, weekritme
- **Stapelkleuren afgeleid van je accentkleur** — 8 paletten × licht / donker / OLED
- **Vakantiemodus** — limiet voor nieuwe kaarten bevriezen, vervaldata verschuiven, reeks bevriezen
- **Werkdruk verlichten** — achterstallige kaarten over N dagen spreiden zonder intervallen te wijzigen
- **Sessie met weinig energie** — een wachtrij van slechts 10–15 kaarten
- **Rich-text kaarteditor** — invuloefening, tabellen, formules (native Image Occlusion-kaarten werken veilig in lees-/compatibiliteitsmodus)
- **16 interfacetalen**, sneltoetsen passen Cmd/Ctrl automatisch aan
- **Drie manieren terug naar native Anki** — sneltoets, menu, werkbalkknop
- **Kaartenbibliotheek en zoeken** — filter op status, moeilijkheid, vlag, tag of set; bewerk, pauzeer, begraaf, verplaats of verwijder in bulk in de selectiemodus
- **Compatibiliteit met scriptkaarten** — meerkeuzesjablonen, Image Occlusion en andere scriptgestuurde kaarten worden in een geïsoleerde compatibiliteitsmodus weergegeven
- **Leertips** — elke dag een rustig principe over kaarten maken en herhalen naast je sets
- **Privacy voorop.** Kaartinhoud, setnamen, tags en zoekopdrachten verlaten je apparaat nooit. Optionele anonieme gebruiks tellingen (starts, dagelijkse activiteit, kaartbereiken, functiegebruik) zijn uit te schakelen in de instellingen; alle schrijfacties lopen via Anki's officiële API, synchronisatie blijft intact.

**Vereist Anki 26.09.4 of nieuwer.** MIT-licentie.

## Polski

Anki Studio zamienia główne okno Anki w pulpit klasy desktop, zachowując pełną zgodność z synchronizacją AnkiWeb.

- **Przegląd dnia** — seria dni, mapa cieplna 26×7, opanowanie talii, rytm tygodnia
- **Kolory talii pochodzą z koloru akcentu** — 8 palet × jasny / ciemny / OLED
- **Tryb wakacyjny** — zamrożenie limitu nowych kart, przesunięcie terminów, zamrożenie serii
- **Ulżenie obciążeniu** — rozłożenie zaległych kart na N dni bez zmiany interwałów
- **Sesja na małej energii** — kolejka zaledwie 10–15 kart
- **Edytor kart z formatowaniem** — luka, tabele, wzory (natywne karty Image Occlusion działają bez zmian w trybie podglądu i powtórek)
- **16 języków interfejsu**, skróty Cmd/Ctrl dopasowują się automatycznie
- **Trzy drogi powrotu do natywnego Anki** — skrót, menu, przycisk paska
- **Biblioteka i wyszukiwanie kart** — filtruj według statusu, trudności, flagi, tagu lub talii; w trybie wielokrotnego wyboru edytuj, zawieś, odłóż, przenieś lub usuń zbiorczo
- **Zgodność z kartami skryptowymi** — szablony wielokrotnego wyboru, Image Occlusion i inne karty oparte na skryptach są renderowane w izolowanym trybie zgodności
- **Wskazówki do nauki** — codziennie jedna spokojna zasada tworzenia i powtórek obok twoich talii
- **Prywatność przede wszystkim.** Treść kart, nazwy talii, tagi i zapytania nigdy nie opuszczają urządzenia. Opcjonalne anonimowe liczniki użycia (uruchomienia, dzienna aktywność, przedziały kart, użycie funkcji) można wyłączyć w ustawieniach; wszystkie zapisy idą przez oficjalne API Anki, synchronizacja pozostaje nienaruszona.

**Wymaga Anki 26.09.4 lub nowszego.** Licencja MIT.

## Türkçe

Anki Studio, Anki'nin ana penceresini masaüstü düzeyinde bir çalışma alanına dönüştürür ve AnkiWeb senkronizasyonuyla tam uyumludur.

- **Günün özeti** — seri, 26×7 ısı haritası, deste hâkimiyeti, haftalık ritim
- **Deste renkleri vurgu renginden türetilir** — 8 palet × açık / koyu / OLED
- **Tatil modu** — yeni kart limitini dondur, vadeleri ötele, seriyi dondur
- **Yükü hafiflet** — gecikmiş kartları aralıkları değiştirmeden N güne yay
- **Düşük enerji oturumu** — yalnızca 10–15 kartlık bir kuyruk
- **Zengin metin kart editörü** — boşluk doldurma, tablolar, formüller (yerel Image Occlusion kartları uyumluluk modunda sorunsuz görüntülenir)
- **16 arayüz dili**, Cmd/Ctrl kısayolları otomatik uyarlanır
- **Yerel Anki'ye üç dönüş yolu** — kısayol, menü, araç çubuğu düğmesi
- **Kart kitaplığı ve arama** — duruma, zorluğa, bayrağa, etikete veya desteye göre filtreleyin; çoklu seçimde toplu düzenleyin, askıya alın, gömün, taşıyın veya silin
- **Betik kart uyumluluğu** — çoktan seçmeli şablonlar, Image Occlusion ve betiğe dayalı diğer kartlar izole uyumluluk modunda gösterilir
- **Öğrenme ipuçları** — destelerinizin yanında her gün kart oluşturma ve tekrar ilkelerinden biri
- **Önce gizlilik.** Kart içerikleri, deste adları, etiketler ve aramalar cihazınızdan asla çıkmaz. İsteğe bağlı anonim kullanım sayaçları (açılışlar, günlük etkinlik, kart aralıkları, özellik kullanımı) ayarlardan kapatılabilir; tüm yazma işlemleri Anki'nin resmî API'sini kullanır, senkronizasyon bozulmaz.

**Anki 26.09.4 veya üzeri gerekir.** MIT lisansı.

## Tiếng Việt

Anki Studio biến cửa sổ chính của Anki thành không gian làm việc chuẩn desktop, vẫn tương thích hoàn toàn với đồng bộ AnkiWeb.

- **Tổng quan hôm nay** — chuỗi ngày, bản đồ nhiệt 26×7, độ thành thạo bộ thẻ, nhịp tuần
- **Màu bộ thẻ sinh ra từ màu nhấn** — 8 bảng màu × sáng / tối / OLED
- **Chế độ nghỉ phép** — đóng băng giới hạn thẻ mới, dời ngày đến hạn, đóng băng chuỗi ngày
- **Giảm tải** — dàn đều thẻ quá hạn ra N ngày mà không đổi khoảng cách ôn tập
- **Phiên ôn nhẹ** — hàng đợi chỉ 10–15 thẻ
- **Trình soạn thẻ định dạng phong phú** — điền khuyết, bảng, công thức (thẻ Image Occlusion gốc hiển thị và ôn tập bình thường ở chế độ tương thích)
- **16 ngôn ngữ giao diện**, phím tắt tự đổi Cmd / Ctrl
- **Ba cách quay về Anki gốc** — phím tắt, menu, nút trên thanh công cụ
- **Thư viện và tìm kiếm thẻ** — lọc theo trạng thái, độ khó, cờ, thẻ tag hoặc bộ thẻ; ở chế độ chọn nhiều, sửa, tạm dừng, hoãn, di chuyển hoặc xóa hàng loạt
- **Tương thích thẻ dùng script** — mẫu trắc nghiệm, Image Occlusion và các thẻ phụ thuộc script khác được hiển thị trong chế độ tương thích cách ly
- **Mẹo học tập** — mỗi ngày một nguyên tắc nhỏ về tạo và ôn thẻ, ngay cạnh bộ thẻ của bạn
- **Ưu tiên quyền riêng tư.** Nội dung thẻ, tên bộ thẻ, thẻ tag và từ khóa tìm kiếm không bao giờ rời khỏi thiết bị. Số đếm sử dụng ẩn danh tùy chọn (lần mở, hoạt động hằng ngày, khoảng số thẻ, lượt dùng tính năng) có thể tắt trong Cài đặt; mọi thao tác ghi đều qua API chính thức của Anki, đồng bộ không bị ảnh hưởng.

**Yêu cầu Anki 26.09.4 trở lên.** Giấy phép MIT.

## العربية

يحوّل Anki Studio النافذة الرئيسية لـ Anki إلى مساحة عمل بمستوى سطح المكتب، مع بقائه متوافقًا تمامًا مع مزامنة AnkiWeb.

- **نظرة اليوم** — سلسلة الأيام، خريطة حرارية 26×7، إتقان المجموعات، إيقاع الأسبوع
- **ألوان المجموعات مشتقّة من لون التمييز** — 8 لوحات × فاتح / داكن / OLED
- **وضع العطلة** — تجميد حد البطاقات الجديدة، تأجيل تواريخ الاستحقاق، تجميد السلسلة
- **تخفيف العبء** — توزيع البطاقات المتأخرة على N أيام دون تغيير الفواصل
- **جلسة الطاقة المنخفضة** — قائمة من 10–15 بطاقة فقط
- **محرر بطاقات غني** — ملء الفراغ، جداول، معادلات (بطاقات Image Occlusion الأصلية تُعرض وتُراجع بأمان في وضع التوافق)
- **16 لغة واجهة**، مع تكييف اختصارات Cmd / Ctrl تلقائيًا
- **ثلاث طرق للعودة إلى Anki الأصلي** — اختصار، قائمة، زر شريط الأدوات
- **مكتبة البطاقات والبحث** — تصفية حسب الحالة أو الصعوبة أو العلامة أو الوسم أو الرزمة؛ وفي وضع التحديد المتعدد عدّل أو علّق أو ادفن أو انقل أو احذف دفعةً واحدة
- **توافق بطاقات السكربت** — قوالب الاختيار من متعدد وImage Occlusion وغيرها من البطاقات المعتمدة على السكربت تُعرض في وضع توافق معزول
- **نصائح التعلم** — كل يوم مبدأ واحد هادئ عن إنشاء البطاقات ومراجعتها بجانب رزمك
- **الخصوصية أولًا.** محتوى البطاقات وأسماء الرزم والوسوم وعبارات البحث لا تغادر جهازك أبدًا. يمكن إيقاف عدادات الاستخدام المجهولة الاختيارية (التشغيل، النشاط اليومي، نطاقات البطاقات، استخدام الميزات) من الإعدادات؛ وكل عمليات الكتابة تمر عبر واجهة Anki الرسمية، فتبقى المزامنة سليمة.

**يتطلب Anki 26.09.4 أو أحدث.** رخصة MIT.
```

---

## 6. 素材说明

| 文件 | 用途 | 规格 |
|---|---|---|
| [`docs/assets/anki-studio-preview.gif`](assets/anki-studio-preview.gif) | AnkiWeb 与 README 首屏主视觉 | **1200×850、5 帧 × 2.8s（14.0s）、613 KB** |
| [`docs/assets/screenshots/01-dashboard.png`](assets/screenshots/01-dashboard.png) | Dashboard（英文浅色高清图） | 2944×2086 · 486 KB |
| [`docs/assets/screenshots/02-reviewer.png`](assets/screenshots/02-reviewer.png) | Reviewer（英文 Cloze 背面 + FSRS 按钮） | 2944×2086 · 171 KB |
| [`docs/assets/screenshots/03-library.png`](assets/screenshots/03-library.png) | Card Library（452 卡网格 + KaTeX 公式） | 2944×2086 · 494 KB |
| [`docs/assets/screenshots/04-stats-dark.png`](assets/screenshots/04-stats-dark.png) | FSRS Analytics（深石墨暗黑模式） | 2944×2086 · 423 KB |
| [`docs/assets/screenshots/05-relief.png`](assets/screenshots/05-relief.png) | Schedule Relief（积压平摊弹窗） | 2944×2086 · 592 KB |
| [`docs/assets/screenshots/05-vacation.png`](assets/screenshots/05-vacation.png) | Vacation Mode（休假模式弹窗，Reddit/发帖备用） | 2944×2086 · 592 KB |

新版英文 GIF 修复了旧版「1 帧亮、3 帧压暗灰弹窗」的亮度落差问题：改为 **3 张主界面亮屏 + 1 张深石墨 FSRS 统计 + 1 张 Schedule Relief 弹窗**，由 `1380×960` `@2x` 无头 Chrome 对真实 React 前端 + Python `BridgeRouter` 隔离渲染，外加纯白 `#FFFFFF` 底边与 macOS 窗口框，再通过 `scripts/build_preview_gif.py` 以逐帧自适应调色板生成。AnkiWeb 列表建议图片控制在 1.5 MB 以内，当前 **613 KB** 兼具秒开加载速度与清晰文字细节。
