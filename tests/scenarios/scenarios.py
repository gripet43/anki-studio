"""测试场景配方。

每个场景代表一类真实用户，而不是一组功能。这样测出来的问题是「这类人会不会
踩到」，而不是「这个按钮能不能点」。

规模刻意控制在单机几十秒内可生成：测试环境要天天能跑，才有价值。
"""

from __future__ import annotations

from builder import DeckSpec, ScenarioSpec

# 公考备考常见标签，用来覆盖层级标签、标签筛选与统计
_EXAM_TAGS = (
    "行测", "申论", "常识判断", "言语理解", "数量关系", "判断推理", "资料分析",
    "易错", "待复习", "高频考点", "时政", "法律", "公文格式", "政治理论",
)

SCENARIOS: dict[str, ScenarioSpec] = {
    # ---------------------------------------------------------------- 空态
    "empty": ScenarioSpec(
        key="empty",
        title="全新用户（空库）",
        description="0 张卡片。验证首屏空态、统计除零、热力图全零、空队列不崩。",
        total_cards=0,
        decks=(),
        notetype_mix={"Basic": 1.0},
        seed=11,
    ),
    # ---------------------------------------------------------------- 新手
    "newbie": ScenarioSpec(
        key="newbie",
        title="轻度新手",
        description="100 张全新卡、单一牌组、纯 Basic。验证新卡队列与首次学习路径。",
        total_cards=100,
        decks=(DeckSpec("公考基础"),),
        notetype_mix={"Basic": 1.0},
        state_mix={"new": 1.0},
        revlog_per_card=(0, 0),
        tag_pool=("行测", "常识判断", "易错"),
        seed=22,
    ),
    # ---------------------------------------------------------------- 备考主力
    "exam": ScenarioSpec(
        key="exam",
        title="备考主力（三层牌组）",
        description=(
            "800 张卡、三层嵌套牌组、Basic + Cloze 混合、30% 新卡、带标签与复习历史。"
            "最接近「认真备考的人」的形态，作为回归主力场景。"
        ),
        total_cards=800,
        decks=(
            DeckSpec("公务员考试", 0.15),
            DeckSpec("公务员考试::行测", 0.35),
            DeckSpec("公务员考试::行测::常识判断", 0.2),
            DeckSpec("公务员考试::行测::资料分析", 0.15),
            DeckSpec("公务员考试::申论", 0.15),
        ),
        notetype_mix={"Basic": 0.8, "Cloze": 0.2},
        state_mix={"new": 0.3, "learning": 0.05, "relearn": 0.05},
        revlog_per_card=(2, 8),
        interval_range=(1, 90),
        overdue_range=(-5, 30),
        tag_pool=_EXAM_TAGS,
        seed=33,
    ),
    # ---------------------------------------------------------------- 积压
    "backlog": ScenarioSpec(
        key="backlog",
        title="积压严重",
        description=(
            "600 张卡几乎全部逾期（最多 180 天）。用来压进度减负、Future Due 峰值、"
            "dailyLoad 与热力图断档。"
        ),
        total_cards=600,
        decks=(
            DeckSpec("公务员考试::行测", 0.6),
            DeckSpec("公务员考试::申论", 0.4),
        ),
        notetype_mix={"Basic": 0.9, "Cloze": 0.1},
        state_mix={"learning": 0.02, "relearn": 0.03, "suspended": 0.05},
        revlog_per_card=(4, 14),
        interval_range=(5, 200),
        # 负值 = 逾期。这里必须全负，否则「积压场景」里一张积压卡都没有，
        # 进度减负与低能量模式都会空跑（曾经就是写成 (20, 180) 的正数）。
        overdue_range=(-180, -20),
        tag_pool=_EXAM_TAGS,
        seed=44,
    ),
    # ---------------------------------------------------------------- 状态混杂
    "mixed": ScenarioSpec(
        key="mixed",
        title="状态混杂",
        description=(
            "400 张卡里暂停/隐藏/旗标后台混排，学习与重学卡同时存在。"
            "专门验证队列语义、徽章颜色与批量操作边界。"
        ),
        total_cards=400,
        decks=(
            DeckSpec("公务员考试::行测", 0.5),
            DeckSpec("公务员考试::面试", 0.5),
        ),
        notetype_mix={"Basic": 0.7, "Cloze": 0.3},
        state_mix={
            "new": 0.15,
            "learning": 0.1,
            "relearn": 0.1,
            "suspended": 0.2,
            "buried": 0.15,
        },
        revlog_per_card=(1, 6),
        interval_range=(1, 60),
        overdue_range=(-15, 45),
        tag_pool=_EXAM_TAGS,
        seed=55,
    ),
    # ---------------------------------------------------------------- 重度
    "power": ScenarioSpec(
        key="power",
        title="重度用户（大库）",
        description=(
            "3000 张卡、8 个牌组、多笔记类型、大量标签与复习历史。"
            "用来暴露分页、查询延迟与前端渲染的规模问题。"
        ),
        total_cards=3000,
        decks=(
            DeckSpec("知识库::法律", 0.15),
            DeckSpec("知识库::经济", 0.12),
            DeckSpec("知识库::历史", 0.12),
            DeckSpec("知识库::地理", 0.1),
            DeckSpec("知识库::科技", 0.1),
            DeckSpec("知识库::公文", 0.13),
            DeckSpec("知识库::面试", 0.13),
            DeckSpec("知识库::错题本", 0.15),
        ),
        notetype_mix={"Basic": 0.6, "Cloze": 0.25, "Basic (and reversed card)": 0.15},
        state_mix={"new": 0.2, "learning": 0.04, "relearn": 0.04, "suspended": 0.06},
        revlog_per_card=(2, 10),
        interval_range=(1, 365),
        overdue_range=(-20, 120),
        tag_pool=_EXAM_TAGS,
        seed=66,
    ),
    # ---------------------------------------------------------------- 媒体
    "media": ScenarioSpec(
        key="media",
        title="媒体素材",
        description=(
            "200 张卡，约三分之一引用真实 PNG/MP3，另含 5 个无人引用的孤立文件。"
            "验证图片渲染、音频按钮、以及 check_media 对未引用文件的识别。"
        ),
        total_cards=200,
        decks=(DeckSpec("素材库"), DeckSpec("素材库::图片遮挡", 0.4)),
        notetype_mix={"Basic": 0.8, "Cloze": 0.2},
        state_mix={"new": 0.25, "relearn": 0.05},
        revlog_per_card=(1, 5),
        tag_pool=("图片", "音频", "遮挡"),
        media_assets=("img_01.png", "img_02.png", "img_03.png", "audio_01.mp3"),
        media_ref_ratio=0.35,
        orphan_media=5,
        seed=77,
    ),
    # ---------------------------------------------------------------- 图片遮挡
    "occlusion": ScenarioSpec(
        key="occlusion",
        title="图片遮挡制卡",
        description=(
            "60 张 Basic 卡全部是 .anki-io-wrap 遮挡结构，每张 1~3 个矩形，"
            "hide-all 与 hide-one 两种模式混排。验证遮罩解析、答案面揭示与编辑回读。"
        ),
        total_cards=60,
        decks=(DeckSpec("图片遮挡"), DeckSpec("图片遮挡::错题", 0.3)),
        notetype_mix={"Basic": 1.0},
        state_mix={"new": 0.3, "relearn": 0.05},
        revlog_per_card=(1, 4),
        tag_pool=("图片", "遮挡", "易错"),
        media_assets=("io_01.png", "io_02.png", "io_03.png"),
        occlusion_ratio=1.0,
        seed=99,
    ),
    # ---------------------------------------------------------------- 原生遮挡
    "io-native": ScenarioSpec(
        key="io-native",
        title="Anki 原生图片遮挡",
        description=(
            "30 条内置 Image Occlusion 笔记，Occlusion 字段为 {{c1::<svg>…</svg>}}，"
            "依赖 canvas + anki.imageOcclusion.setup() 渲染。用于暴露插件对官方遮挡卡的支持缺口。"
        ),
        total_cards=30,
        decks=(DeckSpec("原生遮挡"),),
        notetype_mix={"Image Occlusion": 1.0},
        state_mix={"new": 0.3},
        revlog_per_card=(0, 0),
        media_assets=("io_01.png", "io_02.png"),
        seed=222,
    ),
    # ---------------------------------------------------------------- 极端值
    "edge": ScenarioSpec(
        key="edge",
        title="极端调度值",
        description=(
            "150 张卡注入负数与超大 due（-99999 ~ 1e9）、ivl 含 0 与 2147483647。"
            "验证统计、预测与日均负载既不溢出也不除零。"
        ),
        total_cards=150,
        decks=(DeckSpec("极端数据"),),
        notetype_mix={"Basic": 1.0},
        state_mix={"new": 0.2, "relearn": 0.05},
        revlog_per_card=(1, 4),
        tag_pool=("边界",),
        dirty=frozenset({"extreme_due", "extreme_ivl"}),
        seed=111,
    ),
    # ---------------------------------------------------------------- 脏数据
    "dirty": ScenarioSpec(
        key="dirty",
        title="脏数据",
        description=(
            "120 张卡里混入空卡、重复笔记、缺失媒体引用与超长字段。"
            "专门验证维护工具能否检出并清理，而不是崩溃。"
        ),
        total_cards=120,
        decks=(DeckSpec("脏数据测试"),),
        notetype_mix={"Basic": 0.85, "Cloze": 0.15},
        state_mix={"new": 0.2, "relearn": 0.05},
        revlog_per_card=(0, 3),
        tag_pool=("待清理", "异常"),
        media_assets=("img_ok.png",),
        media_ref_ratio=0.2,
        dirty=frozenset({"empty_cards", "duplicate_notes", "missing_media", "long_fields"}),
        seed=88,
    ),
}

#: 首批生成清单。规模小、跑得快，够验证整条链路。
CORE = ("empty", "newbie", "exam")


def get(key: str) -> ScenarioSpec:
    if key not in SCENARIOS:
        raise KeyError(f"未知场景 {key!r}，可用：{', '.join(sorted(SCENARIOS))}")
    return SCENARIOS[key]
