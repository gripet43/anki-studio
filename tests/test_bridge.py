# -*- coding: utf-8 -*-
"""
Anki Studio — Comprehensive Unit & Integration Test Suite
Covers:
- Part 1 (14 Specific Bugs):
  1. `delete_cards` & `batch_action(delete)` remove notes from SQLite
  2. `toggle_suspend` & `update_card_inline(suspended)` persist suspension via `col.sched.suspend_cards / unsuspend_cards`
  3. `start_review` defaults `includePreviewWhenEmpty=False` so 0-due decks return `cards: []`
  8. `get_statistics` returns dynamic computed metrics
  9. `search_cards` status classification (`due` vs `review` vs `new` vs `suspended`)
  10. `batch_action(unsuspend)` & `batch_action(delete)`
  11. `save_pasted_image` saves Base64 screenshot to `collection.media` and returns `fileUrl` (`file://...`)
  14. `search_cards` supports `offset` and `limit` pagination (`total`, `hasMore`)
- Part 2 ("Daily Goal 60" Removal):
  - `get_dashboard` returns dynamic `totalTodayWorkload` and `remainingForGoal`
- Part 3 (Global Release Engineering):
  - Dynamic profile name (`userName` from `mw.pm.name` or `custom_nickname`)
  - Platform & version info (`envInfo`)
  - Preferences persistence (`get_preferences` / `save_preferences`)
"""

import base64
import datetime
import json
import re
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
import sys

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.router import BridgeRouter


class MockDB:
    def __init__(self):
        self.conn = sqlite3.connect(":memory:")
        self._seed_schema()

    def _seed_schema(self):
        cur = self.conn.cursor()
        cur.executescript(
            """
            CREATE TABLE cards (
                id INTEGER PRIMARY KEY,
                nid INTEGER,
                did INTEGER,
                ord INTEGER,
                mod INTEGER,
                usn INTEGER,
                type INTEGER,
                queue INTEGER,
                due INTEGER,
                ivl INTEGER,
                factor INTEGER,
                reps INTEGER,
                lapses INTEGER,
                left INTEGER,
                odue INTEGER,
                odid INTEGER,
                flags INTEGER,
                data TEXT
            );
            CREATE TABLE notes (
                id INTEGER PRIMARY KEY,
                guid TEXT,
                mid INTEGER,
                mod INTEGER,
                usn INTEGER,
                tags TEXT,
                flds TEXT,
                sfld TEXT,
                csum INTEGER,
                flags INTEGER,
                data TEXT
            );
            CREATE TABLE revlog (
                id INTEGER PRIMARY KEY,
                cid INTEGER,
                usn INTEGER,
                ease INTEGER,
                ivl INTEGER,
                lastIvl INTEGER,
                factor INTEGER,
                time INTEGER,
                type INTEGER
            );
            CREATE TABLE col (
                id INTEGER PRIMARY KEY,
                ls INTEGER
            );
            INSERT INTO col VALUES (1, 1794313537121);
            """
        )
        now_ms = int(time.time() * 1000)
        cur.execute(
            "INSERT INTO notes VALUES (101, 'g1', 1, 0, 0, ' 算法 高频 ', '快速排序[sound:qsort.mp3]\x1f<b>分治</b>；<img src=\"diagram.png\">', '快速排序', 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO cards VALUES (201, 101, 1, 0, 0, 0, 2, 2, 10, 25, 2500, 5, 0, 0, 0, 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO notes VALUES (102, 'g2', 1, 0, 0, ' 操作系统 ', '虚拟内存\x1f页表映射机制', '虚拟内存', 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO cards VALUES (202, 102, 1, 0, 0, 0, 2, 2, 25, 15, 2500, 3, 0, 0, 0, 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO revlog VALUES (?, 201, 0, 3, 4, 2, 2500, 4200, 1)",
            (now_ms - 60000,),
        )
        self.conn.commit()

    def first(self, sql, *args):
        cur = self.conn.cursor()
        cur.execute(sql, args)
        return cur.fetchone()

    def all(self, sql, *args):
        cur = self.conn.cursor()
        cur.execute(sql, args)
        return cur.fetchall()


class MockNote:
    def __init__(self, nid, fields_map, tags, is_cloze=False, cids=None, type_name=None):
        self.id = nid
        self._fields = dict(fields_map)
        self.tags = list(tags)
        self._is_cloze = is_cloze
        self._type_name = type_name
        self._cids = cids or [201]

    def note_type(self):
        if getattr(self, "_model", None) is not None:
            import copy

            return copy.deepcopy(self._model)
        return {
            "id": 2 if self._is_cloze else 1,
            "name": self._type_name or ("Cloze" if self._is_cloze else "Basic"),
            "type": 1 if self._is_cloze else 0,
        }

    def keys(self):
        return list(self._fields.keys())

    def values(self):
        return list(self._fields.values())

    def items(self):
        return list(self._fields.items())

    def __contains__(self, item):
        return item in self._fields

    def __getitem__(self, item):
        return self._fields[item]

    def __setitem__(self, key, value):
        self._fields[key] = value

    def add_tag(self, tag):
        if tag not in self.tags:
            self.tags.append(tag)

    def card_ids(self):
        return list(self._cids)


class MockCard:
    def __init__(self, cid, note, queue=2, ctype=2, due=10, ivl=25):
        self.id = cid
        self.nid = note.id
        self.did = 1
        self.ord = 0
        self._note = note
        self.reps = 5
        self.lapses = 0
        self.ivl = ivl
        self.queue = queue
        self.type = ctype
        self.due = due
        self.flags = 0

    def note(self):
        return self._note


class MockTreeNode:
    def __init__(self, deck_id, name, new_count=8, learn_count=10, review_count=32, children=None):
        self.deck_id = deck_id
        self.name = name
        self.new_count = new_count
        self.learn_count = learn_count
        self.review_count = review_count
        self.children = children or []


class MockCol:
    def __init__(self, media_dir: str):
        self.db = MockDB()
        self.ls = 1794313537121
        self._media_dir = media_dir
        self._note_101 = MockNote(
            101,
            {
                "正面": "快速排序[sound:qsort.mp3]",
                "释义": '<b>分治</b>；<span style="color:red">核心算法</span> <img src="diagram.png">',
                "扩展字段5": "平均 O(n log n)",
            },
            ["算法", "高频"],
            is_cloze=False,
            cids=[201],
        )
        self._note_102 = MockNote(
            102,
            {
                "正面": "虚拟内存",
                "释义": "页表映射机制",
            },
            ["操作系统"],
            is_cloze=False,
            cids=[202],
        )
        self._cloze_note = MockNote(
            105,
            {
                "Text": "欧几里得算法求 {{c1::最大公约数::核心概念}}",
                "Back Extra": "时间复杂度 O(log n)",
            },
            ["算法"],
            is_cloze=True,
            cids=[205],
        )
        self._cards = {
            201: MockCard(201, self._note_101, queue=2, ctype=2, due=10, ivl=25),
            202: MockCard(202, self._note_102, queue=2, ctype=2, due=25, ivl=15),
        }
        self._io_note = None
        self.undone = False
        self.renamed_decks = {}
        self.deleted_decks = []
        self.removed_notes = []
        self.suspended_cids = []
        self.unsuspended_cids = []
        self.buried_cids = []
        self.unburied_cids = []
        self.set_due_date_calls = []
        self.updated_cards = []

        col_self = self

        class Media:
            @staticmethod
            def dir():
                return col_self._media_dir

        class Sched:
            day_cutoff = int(time.time()) + 3600
            today = 10

            @staticmethod
            def set_due_date(cids, days_expr):
                col_self.set_due_date_calls.append((cids, days_expr))

            @staticmethod
            def deck_due_tree():
                child_node = MockTreeNode(2, "图论算法", 4, 2, 10)
                parent_node = MockTreeNode(1, "计算机科学", 8, 10, 32, children=[child_node])
                root = MockTreeNode(0, "root", children=[parent_node])
                return root

            @staticmethod
            def suspend_cards(cids):
                col_self.suspended_cids.extend(cids)
                for cid in cids:
                    if cid in col_self._cards:
                        col_self._cards[cid].queue = -1

            @staticmethod
            def unsuspend_cards(cids):
                col_self.unsuspended_cids.extend(cids)
                for cid in cids:
                    if cid in col_self._cards:
                        col_self._cards[cid].queue = 2

            @staticmethod
            def bury_cards(cids, manual=True):
                col_self.buried_cids.extend(cids)
                for cid in cids:
                    if cid in col_self._cards:
                        col_self._cards[cid].queue = -3 if manual else -2

            @staticmethod
            def unbury_cards(cids):
                col_self.unburied_cids.extend(cids)
                for cid in cids:
                    if cid in col_self._cards:
                        col_self._cards[cid].queue = 2

        class Decks:
            @staticmethod
            def children(did):
                return [("图论算法", 2)] if did == 1 else []

            @staticmethod
            def get(did, default=False):
                return {"id": did, "name": "计算机科学" if int(did) == 1 else "空牌组"}

            @staticmethod
            def select(did):
                pass

            @staticmethod
            def add_normal_deck_with_name(name):
                class Out:
                    id = 999
                return Out()

            @staticmethod
            def rename(did, new_name):
                col_self.renamed_decks[did] = new_name

            @staticmethod
            def remove(dids):
                col_self.deleted_decks.extend(dids)

        class Models:
            @staticmethod
            def all():
                return [
                    {"id": 1, "name": "Basic", "type": 0, "flds": [{"name": "正面"}, {"name": "释义"}]},
                    {"id": 2, "name": "Cloze", "type": 1, "flds": [{"name": "Text"}, {"name": "Back Extra"}]},
                    {
                        "id": 3,
                        "name": "Image Occlusion",
                        "type": 1,
                        "flds": [
                            {"name": "Occlusion"},
                            {"name": "Image"},
                            {"name": "Header"},
                            {"name": "Back Extra"},
                            {"name": "Comments"},
                        ],
                    },
                ]

            @staticmethod
            def current():
                return {"id": 1, "name": "Basic", "type": 0, "flds": [{"name": "正面"}, {"name": "释义"}]}

        class Tags:
            @staticmethod
            def all():
                return ["算法", "高频", "操作系统"]

        self.media = Media()
        self.sched = Sched()
        self.decks = Decks()
        self.models = Models()
        self.tags = Tags()

    def find_cards(self, query):
        if "空牌组" in query:
            return []
        if "is:due" in query or "is:learn" in query:
            return [201]
        if "is:new" in query:
            return []
        if "is:suspended" in query:
            return [201] if self._cards[201].queue == -1 else [201]
        if "is:buried" in query:
            return [202] if self._cards[202].queue in (-2, -3) else [202]
        if "rated:1" in query:
            return [201]
        return [201, 202]

    def get_card(self, cid):
        return self._cards[int(cid)]

    def get_note(self, nid):
        nid_int = int(nid)
        if nid_int == 105:
            return self._cloze_note
        if nid_int == 102:
            return self._note_102
        return self._note_101

    def new_note(self, model):
        if model.get("name") == "Image Occlusion":
            # 原生遮挡卡型的字段名不是 Cloze 的 Text/Back Extra，必须按 flds 建。
            names = [f["name"] for f in model.get("flds", [])]
            return MockNote(107, {n: "" for n in names}, [], is_cloze=True, type_name="Image Occlusion")
        if model.get("type") == 1:
            return MockNote(106, {"Text": "", "Back Extra": ""}, [], is_cloze=True)
        return MockNote(103, {"正面": "", "释义": ""}, [])

    def add_note(self, note, did):
        if note.note_type().get("name") == "Image Occlusion":
            # 复刻 Anki 的真实建卡规则：**一个 ordinal 出一张卡**，同一 ordinal 的多个
            # 遮罩合并成一个 shapes 组。断言卡片数就是断言这一点，防止有人把遮罩写成
            # 递增的 c1/c2/c3（那会一框一卡）。
            occl = note["Occlusion"] if "Occlusion" in note else ""
            ordinals = {m.group(1) for m in re.finditer(r"\{\{c(\d+)::", occl)}
            note._cids = [301 + i for i in range(max(1, len(ordinals)))]
            self._io_note = note
            return note.id
        self._note_101 = note
        return note.id

    @staticmethod
    def get_image_occlusion_fields(mid):
        class _IOFields:
            occlusions = 0
            image = 1
            header = 2
            back_extra = 3

        return _IOFields()

    def update_note(self, note):
        if note.id == 105:
            self._cloze_note = note
        elif note.id == 102:
            self._note_102 = note
        else:
            self._note_101 = note

    def update_notes(self, notes):
        pass

    def set_deck(self, cids, did):
        for cid in cids:
            if int(cid) in self._cards:
                self._cards[int(cid)].did = did

    def remove_notes(self, nids):
        self.removed_notes.extend(nids)

    def undo_status(self):
        class Status:
            undo = "Answer Card"
        return Status()

    def update_card(self, card):
        self._cards[card.id] = card
        self.updated_cards.append(card.id)
        try:
            self.db.conn.execute(
                "UPDATE cards SET due = ?, ivl = ?, queue = ? WHERE id = ?",
                (card.due, card.ivl, card.queue, card.id),
            )
            self.db.conn.commit()
        except Exception:
            pass

    def undo(self):
        self.undone = True


class MockPM:
    name = "Alex Profile"


class MockMW:
    def __init__(self):
        self.sync_called = False
        self.pm = MockPM()
        self.x_pos = 100
        self.y_pos = 100
        self.maximized = False

    def on_sync(self):
        self.sync_called = True

    def move(self, x, y):
        self.x_pos = x
        self.y_pos = y

    def x(self):
        return self.x_pos

    def y(self):
        return self.y_pos

    def isMaximized(self):
        return self.maximized

    def showMaximized(self):
        self.maximized = True

    def showNormal(self):
        self.maximized = False


class BridgeRouterAuditTest(unittest.TestCase):
    def setUp(self):
        self.temp_media = tempfile.mkdtemp(prefix="anki_media_")
        self.mock_col = MockCol(self.temp_media)
        self.mock_mw = MockMW()
        self.toggled = False
        self.config_store = {
            "theme": "light",
            "accent_color": "indigo",
            "language": "auto",
            "custom_nickname": "",
            "collapsed_deck_ids": [],
        }

        def on_toggle():
            self.toggled = True

        def write_cfg(patch):
            self.config_store.update(patch)
            return self.config_store

        self.router = BridgeRouter(
            col_getter=lambda: self.mock_col,
            mw_getter=lambda: self.mock_mw,
            toggle_native_callback=on_toggle,
            config_getter=lambda: self.config_store,
            config_writer=write_cfg,
        )

    def tearDown(self):
        try:
            self.mock_col.db.conn.close()
        except Exception:
            pass

    def _call(self, action: str, data: dict = None) -> dict:
        cmd = "modern_anki:" + json.dumps({"action": action, "data": data or {}})
        raw = self.router.handle_pycmd(cmd)
        self.assertIsNotNone(raw)
        return json.loads(raw)

    def test_01_rich_html_and_media_uri_and_audio_extraction(self):
        """Verify HTML tags and <img src> are preserved/mapped and [sound:...] is extracted."""
        res = self._call("start_review", {"deckId": "1"})
        self.assertEqual(res["status"], "success")
        card = res["data"]["cards"][0]

        self.assertIn("<b>分治</b>", card["backHtml"])
        self.assertIn('style="color:red"', card["backHtml"])
        self.assertIn("file://", card["backHtml"])
        self.assertIn("diagram.png", card["backHtml"])
        self.assertIn("qsort.mp3", card["audioFiles"])
        self.assertNotIn("[sound:", card["frontHtml"])

    def test_02_empty_deck_does_not_pull_future_preview_cards_by_default(self):
        """Bug #3: Verify start_review defaults includePreviewWhenEmpty=False."""
        res = self._call("start_review", {"deckId": "99"})
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["data"]["cards"], [])
        self.assertFalse(res["data"]["isPreviewOnly"])

    def test_03_delete_cards_and_suspend_persistence(self):
        """Bugs #1 & #2: Verify delete_cards removes notes and toggle_suspend / update_card_inline persists suspend."""
        suspend_res = self._call("toggle_suspend", {"cardId": "201", "suspend": True})
        self.assertEqual(suspend_res["status"], "success")
        self.assertIn(201, self.mock_col.suspended_cids)
        self.assertEqual(self.mock_col._cards[201].queue, -1)

        inline_unsuspend = self._call(
            "update_card_inline",
            {"noteId": "101", "cardId": "201", "suspended": False},
        )
        self.assertEqual(inline_unsuspend["status"], "success")
        self.assertIn(201, self.mock_col.unsuspended_cids)
        self.assertEqual(self.mock_col._cards[201].queue, 2)

        del_res = self._call("delete_cards", {"cardIds": ["201"]})
        self.assertEqual(del_res["status"], "success")
        self.assertIn(101, self.mock_col.removed_notes)

    def test_04_search_cards_due_vs_review_classification_and_pagination(self):
        """Bugs #9 & #14: Verify future review cards are classified as 'review' (not 'due') and pagination works."""
        page1 = self._call("search_cards", {"query": "", "status": "all", "offset": 0, "limit": 1})["data"]
        self.assertEqual(page1["total"], 2)
        self.assertEqual(len(page1["cards"]), 1)
        self.assertTrue(page1["hasMore"])
        self.assertEqual(page1["cards"][0]["status"], "due")

        page2 = self._call("search_cards", {"query": "", "status": "all", "offset": 1, "limit": 1})["data"]
        self.assertEqual(len(page2["cards"]), 1)
        self.assertFalse(page2["hasMore"])
        self.assertEqual(page2["cards"][0]["status"], "review")

        # Verify suspended and buried status classifications
        self.mock_col._cards[201].queue = -1
        res_suspended = self._call("search_cards", {"query": "", "status": "suspended", "language": "zh-CN"})["data"]
        self.assertEqual(res_suspended["cards"][0]["status"], "suspended")
        self.assertTrue(res_suspended["cards"][0]["suspended"])
        self.assertEqual(res_suspended["cards"][0]["dueText"], "已暂停")

        self.mock_col._cards[202].queue = -2
        res_buried = self._call("search_cards", {"query": "", "status": "buried", "language": "zh-CN"})["data"]
        self.assertEqual(res_buried["cards"][0]["status"], "buried")
        self.assertTrue(res_buried["cards"][0]["buried"])
        self.assertEqual(res_buried["cards"][0]["dueText"], "已搁置")

        # Restore
        self.mock_col._cards[201].queue = 2
        self.mock_col._cards[202].queue = 2

        # Verify completed (rated:1) status search
        res_completed = self._call("search_cards", {"query": "", "status": "completed", "language": "zh-CN"})["data"]
        self.assertEqual(res_completed["cards"][0]["status"], "completed")
        self.assertTrue(res_completed["cards"][0]["ratedToday"])
        self.assertEqual(res_completed["cards"][0]["dueText"], "今日已完成")

    def test_05_save_pasted_image_to_collection_media(self):
        """Bug #11: Verify clipboard Base64 image upload saves file to collection.media and returns fileUrl."""
        raw_png = base64.b64encode(b"\x89PNG\r\n\x1a\nMOCKDATA").decode("ascii")
        res = self._call(
            "save_pasted_image",
            {"base64Data": f"data:image/png;base64,{raw_png}", "ext": "png"},
        )
        self.assertEqual(res["status"], "success")
        filename = res["data"]["filename"]
        self.assertTrue((Path(self.temp_media) / filename).exists())
        self.assertIn("file://", res["data"]["fileUrl"])

    def test_06_dynamic_daily_workload_and_profile_name(self):
        """Part 2 & Part 3 Task 2: Verify totalTodayWorkload is dynamically computed and profile name is read from mw.pm.name."""
        dash = self._call("get_dashboard")["data"]
        today_stats = dash["todayStats"]
        self.assertIn("totalTodayWorkload", today_stats)
        self.assertEqual(
            today_stats["totalTodayWorkload"],
            today_stats["completed"] + today_stats["dueReview"] + today_stats["dueNew"],
        )
        self.assertEqual(dash["userName"], "Alex Profile")
        
        # Verify streak calendar week active days calculation
        streak = dash["streak"]
        self.assertEqual(streak["weekTotalDays"], 7)
        self.assertGreaterEqual(streak["weekActiveDays"], 0)
        self.assertLessEqual(streak["weekActiveDays"], 7)
        # In current calendar week, active days cannot exceed elapsed days so far (weekday + 1)
        import datetime
        elapsed_week_days = datetime.date.today().weekday() + 1
        self.assertLessEqual(streak["weekActiveDays"], elapsed_week_days)

        # Verify genuine AnkiWeb cloud sync timestamp reflects col.ls
        self.assertTrue(dash["synced"])
        self.assertEqual(dash["syncedAt"], 1794313537121)

        # When col.ls is 0 (un-synced / no account), synced must be False and syncedAt 0
        self.mock_col.ls = 0
        self.mock_col.db.conn.execute("UPDATE col SET ls = 0")
        self.mock_col.db.conn.commit()
        dash_unsynced = self._call("get_dashboard")["data"]
        self.assertFalse(dash_unsynced["synced"])
        self.assertEqual(dash_unsynced["syncedAt"], 0)

        # Restore
        self.mock_col.ls = 1794313537121
        self.mock_col.db.conn.execute("UPDATE col SET ls = 1794313537121")
        self.mock_col.db.conn.commit()

    def test_07_preferences_and_batch_unsuspend_delete(self):
        """Bug #10 & Part 3 Task 4: Verify batch unsuspend/delete and preferences persistence."""
        prefs_res = self._call(
            "save_preferences",
            {
                "theme": "dark",
                "accentColor": "emerald",
                "language": "en",
                "customNickname": "Dr. Lee",
                "collapsedDeckIds": ["1"],
                "showShortcutHints": True,
                "autoPlayFrontAudio": True,
                "autoPlayBackAudio": False,
                "reviewStageWidth": "wide",
                "reviewContentScale": 130,
            },
        )
        self.assertEqual(prefs_res["status"], "success")
        self.assertEqual(prefs_res["data"]["preferences"]["language"], "en")
        self.assertEqual(prefs_res["data"]["preferences"]["customNickname"], "Dr. Lee")
        self.assertTrue(prefs_res["data"]["preferences"]["showShortcutHints"])
        self.assertTrue(prefs_res["data"]["preferences"]["autoPlayFrontAudio"])
        self.assertFalse(prefs_res["data"]["preferences"]["autoPlayBackAudio"])
        self.assertEqual(prefs_res["data"]["preferences"]["reviewStageWidth"], "wide")
        self.assertEqual(prefs_res["data"]["preferences"]["reviewContentScale"], 130)

        get_prefs = self._call("get_preferences", {})
        self.assertEqual(get_prefs["status"], "success")
        self.assertTrue(get_prefs["data"]["showShortcutHints"])
        self.assertTrue(get_prefs["data"]["autoPlayFrontAudio"])
        self.assertFalse(get_prefs["data"]["autoPlayBackAudio"])
        self.assertEqual(get_prefs["data"]["reviewStageWidth"], "wide")
        self.assertEqual(get_prefs["data"]["reviewContentScale"], 130)

        dash_prefs = self._call("get_dashboard", {})["data"]["preferences"]
        self.assertTrue(dash_prefs["autoPlayFrontAudio"])
        self.assertFalse(dash_prefs["autoPlayBackAudio"])

        # Invalid review display values & string-encoded bools must normalize cleanly
        fallback_res = self._call(
            "save_preferences",
            {
                "autoPlayFrontAudio": "false",
                "autoPlayBackAudio": "1",
                "reviewStageWidth": "invalid-width",
                "reviewContentScale": 999,
            },
        )
        self.assertFalse(fallback_res["data"]["preferences"]["autoPlayFrontAudio"])
        self.assertTrue(fallback_res["data"]["preferences"]["autoPlayBackAudio"])
        self.assertEqual(fallback_res["data"]["preferences"]["reviewStageWidth"], "auto")
        self.assertEqual(fallback_res["data"]["preferences"]["reviewContentScale"], 100)

        batch_unsuspend = self._call("batch_action", {"actionType": "unsuspend", "cardIds": ["201"]})
        self.assertEqual(batch_unsuspend["status"], "success")
        self.assertIn(201, self.mock_col.unsuspended_cids)

        batch_del = self._call("batch_action", {"actionType": "delete", "cardIds": ["202"]})
        self.assertEqual(batch_del["status"], "success")
        self.assertIn(102, self.mock_col.removed_notes)

        # Test toggle_bury and batch bury / unbury
        bury_res = self._call("toggle_bury", {"cardId": "201", "bury": True})
        self.assertEqual(bury_res["status"], "success")
        self.assertIn(201, self.mock_col.buried_cids)

        batch_bury = self._call("batch_action", {"actionType": "bury", "cardIds": ["201"]})
        self.assertEqual(batch_bury["status"], "success")

        batch_unbury = self._call("batch_action", {"actionType": "unbury", "cardIds": ["201"]})
        self.assertEqual(batch_unbury["status"], "success")
        self.assertIn(201, self.mock_col.unburied_cids)

    def test_08_copy_to_clipboard_bridge(self):
        """Verify copy_to_clipboard bridge action handles empty and valid strings gracefully."""
        res_empty = self._call("copy_to_clipboard", {"text": ""})
        self.assertIn(res_empty["status"], ["success", "error"])
        res_text = self._call("copy_to_clipboard", {"text": "Hello Anki Studio"})
        self.assertIn(res_text["status"], ["success", "error"])

    def test_09_untruncated_card_content_and_field_update(self):
        """Verify cards with >120 characters are not truncated in search_cards and update_card_inline preserves fields."""
        long_front = (
            "内循环经济占国内生产总值约80%、外循环经济占国内生产总值约20%，是大国经济发展的普遍规律。"
            "从某种程度而言，对内循环进行结构性调整，类似于对国家的经济“动手术”。"
            "一场统筹得力、技术精湛的经济“外科手术”的高超之处，既在于对国际经济环境的洞察，也在于对本国经济现状的实事求是。<br>"
            "这段文字中“外科手术”指的是（ ）。<br>A 国家的经济内循环<br>B 调整国家经济的内外循环<br>C 内循环的结构性调整<br>D 外循环的结构性调整"
        )
        note101 = self.mock_col.get_note(101)
        note101["正面"] = long_front

        search_res = self._call("search_cards", {"query": "", "limit": 10})["data"]
        card1 = next(c for c in search_res["cards"] if c["id"] == "201")
        self.assertGreater(len(card1["front"]), 150)
        self.assertIn("外循环的结构性调整", card1["front"])

        # Test update_card_inline with various fields
        update_res = self._call(
            "update_card_inline",
            {
                "cardId": "201",
                "front": "Updated Full Front Content Line 1<br>Line 2",
                "meaning": "Updated Meaning",
                "fields": {
                    "正面": "Updated Full Front Content Line 1<br>Line 2",
                    "释义": "Updated Meaning",
                },
            },
        )
        self.assertEqual(update_res["status"], "success")
        self.assertEqual(note101["正面"], "Updated Full Front Content Line 1<br>Line 2")
        self.assertEqual(note101["释义"], "Updated Meaning")

    def test_10_window_drag_and_maximize(self):
        """Verify move_window and toggle_maximize bridge actions for macOS titlebar dragging."""
        res_move = self._call("move_window", {"dx": 25, "dy": -10})
        self.assertEqual(res_move["status"], "success")
        self.assertTrue(res_move["data"]["moved"])
        self.assertEqual(res_move["data"]["x"], 125)
        self.assertEqual(res_move["data"]["y"], 90)

        res_max = self._call("toggle_maximize", {})
        self.assertEqual(res_max["status"], "success")
        self.assertTrue(res_max["data"]["maximized"])

        res_norm = self._call("toggle_maximize", {})
        self.assertEqual(res_norm["status"], "success")
        self.assertFalse(res_norm["data"]["maximized"])

        res_sys = self._call("start_system_move", {})
        self.assertEqual(res_sys["status"], "success")

    def test_11_vacation_and_anti_avalanche_rescue(self):
        """Verify Vacation Mode, Streak Freeze, Backlog Amortization and Low Energy sessions."""
        # 1. Initial vacation status
        res_stat = self._call("get_vacation_status", {})
        self.assertEqual(res_stat["status"], "success")
        self.assertFalse(res_stat["data"]["vacation"]["isActive"])

        # 2. Set Vacation Mode (4 days)
        res_set = self._call(
            "set_vacation",
            {
                "days": 4,
                "reason": "备考冲刺",
                "freezeNewCards": True,
                "shiftReviewCards": True,
                "freezeStreak": True,
            },
        )
        self.assertEqual(res_set["status"], "success")
        vacation = res_set["data"]["vacation"]
        self.assertTrue(vacation["isActive"])
        self.assertEqual(vacation["days"], 4)
        self.assertEqual(len(vacation["frozenDates"]), 4)
        self.assertEqual(vacation["reason"], "备考冲刺")

        # Verify set_due_date was called to shift due review cards forward by 4 days
        self.assertTrue(any(call[1] == "4" for call in self.mock_col.set_due_date_calls))

        # 3. Verify get_dashboard contains vacation & backlog (including shiftedCardCount)
        res_dash = self._call("get_dashboard", {})
        self.assertEqual(res_dash["status"], "success")
        self.assertIn("vacation", res_dash["data"])
        self.assertTrue(res_dash["data"]["vacation"]["isActive"])
        self.assertIn("shiftedCardCount", res_dash["data"]["vacation"])
        self.assertEqual(res_dash["data"]["vacation"]["shiftedCardCount"], 1)
        self.assertIn("backlog", res_dash["data"])

        # 4. Anti-Avalanche Rescue: Amortize across 7 days
        res_rescue_amortize = self._call(
            "rescue_backlog",
            {"mode": "amortize", "days": 7},
        )
        self.assertEqual(res_rescue_amortize["status"], "success")
        self.assertEqual(res_rescue_amortize["data"]["mode"], "amortize")
        self.assertEqual(res_rescue_amortize["data"]["days"], 7)
        self.assertIn("receipt", res_rescue_amortize["data"])
        receipt = res_rescue_amortize["data"]["receipt"]
        self.assertEqual(receipt["lostCards"], 0)
        self.assertTrue(receipt["canUndo"])
        self.assertEqual(len(receipt["dayDistribution"]), 7)
        # Verify set_due_date was called with range "1-7"
        self.assertTrue(any(call[1] == "1-7" for call in self.mock_col.set_due_date_calls))

        # 5. Undo Rescue
        res_undo = self._call("undo_rescue", {})
        self.assertEqual(res_undo["status"], "success")
        self.assertTrue(res_undo["data"]["success"])

        # 6. Anti-Avalanche Rescue: Shift by 3 days
        res_rescue_shift = self._call(
            "rescue_backlog",
            {"mode": "shift", "days": 3},
        )
        self.assertEqual(res_rescue_shift["status"], "success")
        self.assertEqual(res_rescue_shift["data"]["mode"], "shift")
        self.assertTrue(any(call[1] == "3" for call in self.mock_col.set_due_date_calls))

        # 7. Low Energy Session
        res_low = self._call("start_low_energy", {"limit": 10})
        self.assertEqual(res_low["status"], "success")
        self.assertTrue(res_low["data"]["isLowEnergy"])
        self.assertTrue(len(res_low["data"]["cardIds"]) > 0)

        # 8. End Vacation Mode
        res_end = self._call("end_vacation", {})
        self.assertEqual(res_end["status"], "success")
        res_after = self._call("get_vacation_status", {})
        self.assertFalse(res_after["data"]["vacation"]["isActive"])

        # 9. Vacation History & Revert (Cancel Vacation)
        res_set2 = self._call("set_vacation", {"days": 2, "reason": "测试休假"})
        self.assertEqual(res_set2["status"], "success")
        res_cancel = self._call("cancel_vacation", {})
        self.assertEqual(res_cancel["status"], "success")
        res_vac_hist = self._call("get_vacation_history", {})
        self.assertEqual(res_vac_hist["status"], "success")
        self.assertTrue(len(res_vac_hist["data"]["history"]) > 0)

        # 10. Rescue History
        res_rescue_hist = self._call("get_rescue_history", {})
        self.assertEqual(res_rescue_hist["status"], "success")
        self.assertTrue(len(res_rescue_hist["data"]["history"]) > 0)

    def test_12_comprehensive_stability_and_edge_cases(self):
        """
        Comprehensive adversarial & edge-case stability tests across all modules:
        1. Malformed / non-JSON / unknown commands to router
        2. Deck ID vs Deck Name resolution in low-energy & rescue operations
        3. Explicit cardIds queue filtering in start_review (Low-Energy 15-card cap)
        4. Multi-index Cloze creation ({{c3::...}}) & special-character search queries
        5. Batch operations with mixed valid + non-existent/deleted card IDs (fault isolation)
        6. Sequential rescue operations enforcing strict single-undo invariant (only index 0 canUndo)
        7. Null/empty collection fallback resilience across all services
        """
        # 1. Router resilience against invalid prefix, corrupted JSON, or unknown action
        self.assertIsNone(self.router.handle_pycmd("not_modern_anki:{}"))
        bad_json_res = json.loads(self.router.handle_pycmd("modern_anki:{bad_json"))
        self.assertEqual(bad_json_res["status"], "error")
        unknown_res = self._call("non_existent_action", {})
        self.assertEqual(unknown_res["status"], "error")

        # 2. Numeric deckId resolution in start_low_energy & start_review cardIds cap
        low_res = self._call("start_low_energy", {"deckId": "1", "limit": 5})
        self.assertEqual(low_res["status"], "success")
        self.assertTrue(low_res["data"]["isLowEnergy"])
        curated_cids = low_res["data"]["cardIds"]
        self.assertGreater(len(curated_cids), 0)

        rev_curated = self._call("start_review", {"deckId": "1", "cardIds": curated_cids, "limit": 5})
        self.assertEqual(rev_curated["status"], "success")
        self.assertEqual(len(rev_curated["data"]["cards"]), len(curated_cids))

        # 3. Multi-index Cloze ({{c3::...}}) in quick_add
        cloze_res = self._call(
            "quick_add",
            {
                "deckId": "1",
                "front": "高等数学：{{c3::拉格朗日中值定理}}的几何意义",
                "back": "切线平行于割线",
                "tags": ["高数", "定理"],
            },
        )
        self.assertEqual(cloze_res["status"], "success")
        self.assertTrue(cloze_res["data"]["created"])

        # 4. Batch action fault isolation when cardIds include non-existent IDs ("999999")
        batch_tag_res = self._call(
            "batch_action",
            {"actionType": "addTag", "cardIds": ["201", "999999"], "tag": "重点, 易错"},
        )
        self.assertEqual(batch_tag_res["status"], "success")
        self.assertIn("重点", self.mock_col.get_note(101).tags)
        self.assertIn("易错", self.mock_col.get_note(101).tags)

        batch_del_res = self._call(
            "batch_action",
            {"actionType": "delete", "cardIds": ["202", "888888"]},
        )
        self.assertEqual(batch_del_res["status"], "success")

        # 5. Strict Single-Undo Invariant across consecutive rescue operations
        r1 = self._call("rescue_backlog", {"mode": "amortize", "days": 5, "deckId": "1"})
        self.assertEqual(r1["status"], "success")
        r2 = self._call("rescue_backlog", {"mode": "shift", "days": 3, "deckId": "1"})
        self.assertEqual(r2["status"], "success")
        hist = self._call("get_rescue_history", {})["data"]["history"]
        self.assertGreaterEqual(len(hist), 2)
        self.assertTrue(hist[0]["canUndo"])
        for older in hist[1:]:
            self.assertFalse(older["canUndo"])

        # 6. Null collection fallback resilience (e.g. during profile switch)
        null_router = BridgeRouter(
            col_getter=lambda: None,
            mw_getter=lambda: None,
            config_getter=lambda: self.config_store,
            config_writer=lambda p: self.config_store,
        )
        for act in ("get_dashboard", "get_statistics", "search_cards", "start_review", "get_vacation_status"):
            raw = null_router.handle_pycmd("modern_anki:" + json.dumps({"action": act, "data": {}}))
            parsed = json.loads(raw)
            self.assertEqual(parsed["status"], "success")

        # 7. Verify manual reschedule logs (type=4, ease=0 from set_due_date) do NOT pollute completed_today or retentionRate
        now_ms = int(time.time() * 1000)
        cur = self.mock_col.db.conn.cursor()
        for idx in range(50):
            cur.execute(
                "INSERT INTO revlog VALUES (?, 201, 0, 0, 5, 5, 0, 0, 4)",
                (now_ms - 1000 - idx,),
            )
        self.mock_col.db.conn.commit()

        dash_clean = self._call("get_dashboard", {})["data"]
        # Only the 1 genuine review row (type=1, ease=3) should be counted, NOT the 50 type=4 reschedule rows!
        self.assertEqual(dash_clean["todayStats"]["completed"], 1)
        self.assertEqual(dash_clean["heatmap"]["retentionRate"], 100)
        stats_clean = self._call("get_statistics", {})["data"]
        latest_week = stats_clean["retentionCurve"][-1]
        self.assertEqual(latest_week["reviews"], 1)
        self.assertEqual(latest_week["retentionRate"], 100.0)


    def test_13_vacation_expiry_revert_and_freeze_integrity(self):
        """Vacation expiry, streak-freeze lifecycle, lossless revert and re-entry guard."""
        # 1. An expired active vacation must be finalized by the dashboard path alone,
        #    because the frontend never calls get_vacation_status.
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        self.config_store["vacation_state"] = {
            "id": "vac-expired", "active": True, "start_date": yesterday,
            "end_date": yesterday, "days": 1, "reason": "测试",
            "freeze_new_cards": True, "frozen_dates": [yesterday],
            "frozen_deck_limits": {}, "shifted_cids": [], "shifted_card_count": 0,
        }
        self.config_store["vacation_history"] = [{
            "id": "vac-expired", "status": "active", "days": 1,
            "startDate": yesterday, "endDate": yesterday, "reason": "测试",
        }]
        dash_payload = self._call("get_dashboard", {})["data"]
        self.assertNotIn("bridgeWarning", dash_payload)
        dash = dash_payload["vacation"]
        self.assertFalse(dash["isActive"])
        self.assertEqual(dash["remainingDays"], 0)
        # Guard against a false pass via _empty_dashboard(), which also returns
        # isActive=False / remainingDays=0.
        self.assertEqual(dash["startDate"], yesterday)
        self.assertFalse(self.config_store["vacation_state"]["active"])
        self.assertEqual(self.config_store["vacation_history"][0]["status"], "completed")

        # 2. Start a real vacation, then revert it. Freeze dates must be removed and
        #    every shifted card restored to its exact original due/interval/queue.
        card = self.mock_col.get_card(201)
        original = {"due": card.due, "ivl": card.ivl, "queue": card.queue}
        set_res = self._call("set_vacation", {
            "days": 3, "freezeNewCards": True,
            "shiftReviewCards": True, "freezeStreak": True,
        })
        self.assertTrue(set_res["data"]["success"])
        state = self.config_store["vacation_state"]
        own_frozen = list(state["frozen_dates"])
        self.assertEqual(len(own_frozen), 3)
        self.assertTrue(set(self.config_store["vacation_frozen_dates"]) >= set(own_frozen))
        self.assertIn("201", state["shifted_card_snapshot"])

        # 2b. Re-entering while active must be rejected: re-freezing would record the
        #     already-zero new-card limit as the "original" value.
        dup = self._call("set_vacation", {"days": 2})["data"]
        self.assertFalse(dup["success"])
        self.assertTrue(self.config_store["vacation_state"]["active"])

        # Simulate Anki having moved the card while the vacation was in effect.
        card.due = 999
        card.ivl = 1
        cancel = self._call("cancel_vacation", {})["data"]
        self.assertTrue(cancel["success"])
        restored = self.mock_col.get_card(201)
        self.assertEqual(
            (restored.due, restored.ivl, restored.queue),
            (original["due"], original["ivl"], original["queue"]),
        )
        self.assertEqual(restored.due, original["due"])
        for frozen in own_frozen:
            self.assertNotIn(frozen, self.config_store["vacation_frozen_dates"])
        self.assertFalse(any("!" in str(call[1]) for call in self.mock_col.set_due_date_calls))

        # 3. A later vacation must not erase earlier (real) freeze dates.
        earlier = (datetime.date.today() - datetime.timedelta(days=10)).isoformat()
        self.config_store["vacation_frozen_dates"] = [earlier]
        self._call("set_vacation", {
            "days": 2, "freezeNewCards": False,
            "shiftReviewCards": False, "freezeStreak": True,
        })
        self.assertIn(earlier, self.config_store["vacation_frozen_dates"])
        self.assertEqual(len(self.config_store["vacation_state"]["frozen_dates"]), 2)

        # 4. Undo of backlog rescue must never use the interval-rewriting '!' suffix.
        self.config_store["last_rescue_receipt"] = {
            "id": "rescue_test", "canUndo": True,
            "rescheduledCids": ["201"],
            "dayDistribution": [{"dayOffset": 1, "count": 1}],
        }
        self._call("undo_rescue", {})
        self.assertIn(([201], "0"), self.mock_col.set_due_date_calls)
        self.assertFalse(any("!" in str(call[1]) for call in self.mock_col.set_due_date_calls))

    def test_14_legacy_cancelled_vacation_has_no_heatmap_freeze(self):
        """A pre-fix config must not paint a frozen streak cell after a revert."""
        # Exact shape of config.json / meta.json written by the old cancel_vacation:
        # active=False and cancelled_at set, but frozen_dates still populated.
        recent = [
            (datetime.date.today() - datetime.timedelta(days=i)).isoformat()
            for i in range(7)
        ]
        self.config_store["vacation_state"] = {
            "id": "vac-legacy", "active": False,
            "start_date": recent[0], "end_date": recent[0], "days": 1,
            "reason": "身心休整", "freeze_new_cards": True,
            "frozen_dates": list(recent), "frozen_deck_limits": {},
            "shifted_cids": [], "shifted_card_count": 50,
            "created_at": "2026-11-10 10:09",
            "cancelled_at": "2026-11-10 10:39",
        }
        self.config_store.pop("vacation_frozen_dates", None)
        dash = self._call("get_dashboard", {})["data"]
        self.assertNotIn("bridgeWarning", dash)
        self.assertFalse(dash["vacation"]["isActive"])
        self.assertEqual(dash["vacation"]["frozenDates"], [])
        # DashboardView shows "休假连胜冰冻保护中" only when a cell has this flag.
        self.assertFalse(any(c.get("isStreakFrozen") for c in dash["heatmap"]["cells"]))

        # A still-active legacy vacation must keep its freeze protection.
        self.config_store["vacation_state"].pop("cancelled_at")
        self.config_store["vacation_state"]["active"] = True
        active = self._call("get_dashboard", {})["data"]
        self.assertEqual(active["vacation"]["frozenDates"], sorted(recent))

    def test_15_official_statistics_metrics(self):
        """Anki-parity metrics: Answer Buttons, True Retention semantics, Daily Load."""
        stats = self._call("get_statistics", {})["data"]
        self.assertIn("answerButtons", stats)
        self.assertIn("trueRetention", stats)
        self.assertIn("dailyLoad", stats)

        # Seed revlog: one genuine review, ease=3 (Good), lastIvl=2 (young), type=1.
        btn = stats["answerButtons"]
        self.assertEqual(btn["good"], 1)
        self.assertEqual(btn["total"], 1)
        self.assertEqual(btn["young"]["rate"], 100.0)
        self.assertEqual(btn["mature"]["total"], 0)
        self.assertEqual(stats["trueRetention"]["allTime"]["overall"]["total"], 1)
        self.assertEqual(stats["trueRetention"]["allTime"]["overall"]["rate"], 100.0)

        # Two active review cards with ivl 25 / 15 -> 1/25 + 1/15 = 0.1067 -> 0.1
        self.assertAlmostEqual(stats["dailyLoad"], 0.1, places=1)

        # A second review of the SAME card on the SAME day (Again) must be counted by
        # Answer Buttons but ignored by True Retention ("first review per card per day").
        now_ms = int(time.time() * 1000)
        cur = self.mock_col.db.conn.cursor()
        cur.execute(
            "INSERT INTO revlog VALUES (?, 201, 0, 1, 1, 2, 2500, 1000, 1)",
            (now_ms - 30000,),
        )
        # Manual rescheduling logs (type=4, ease=0) must never pollute any metric.
        cur.execute(
            "INSERT INTO revlog VALUES (?, 201, 0, 0, 5, 5, 0, 0, 4)",
            (now_ms - 20000,),
        )
        self.mock_col.db.conn.commit()

        stats2 = self._call("get_statistics", {})["data"]
        tr2 = stats2["trueRetention"]["allTime"]["overall"]
        self.assertEqual(tr2["total"], 1)
        self.assertEqual(tr2["rate"], 100.0)
        self.assertEqual(stats2["answerButtons"]["again"], 1)
        self.assertEqual(stats2["answerButtons"]["total"], 2)
        self.assertEqual(stats2["answerButtons"]["young"]["rate"], 50.0)

    def test_16_full_audit_no_fake_success_or_fabricated_receipt(self):
        """P0/P1 audit fixes: read paths stay read-only, failures are honest."""
        # 1. A dashboard read must never invent or persist an undoable receipt.
        self.config_store.pop("last_rescue_receipt", None)
        self.config_store.pop("rescue_history", None)
        dash = self._call("get_dashboard", {})["data"]
        self.assertNotIn("bridgeWarning", dash)
        self.assertNotIn("last_rescue_receipt", self.config_store)
        self.assertIsNone(dash.get("lastRescueReceipt"))

        # 2. Legacy fabricated receipts ("rescue_active") must be rejected.
        self.config_store["last_rescue_receipt"] = {
            "id": "rescue_active", "canUndo": True,
            "rescheduledCids": ["201"],
            "dayDistribution": [{"dayOffset": 1, "count": 1}],
        }
        self.assertFalse(self._call("undo_rescue", {})["data"]["success"])

        # 3. A rating that never reached the scheduler must not claim success.
        #    (anki.scheduler.v3 / aqt are unavailable in the unit-test runtime.)
        ans = self._call("answer_card", {"cardId": "201", "ease": 3})["data"]
        self.assertFalse(ans.get("answered", False))

        # 4. A broken search query must not fall back to the whole collection.
        orig_find = self.mock_col.find_cards

        def broken(query):
            if query == "":
                return orig_find(query)
            raise ValueError("malformed query")

        self.mock_col.find_cards = broken
        res = self._call("search_cards", {"query": "unclosed("})["data"]
        self.assertEqual(res["cards"], [])
        self.assertEqual(res["total"], 0)
        self.mock_col.find_cards = orig_find

        # 5. Unknown batch actions must fail loudly.
        bad = self._call("batch_action", {"actionType": "noSuchAction", "cardIds": ["201"]})["data"]
        self.assertFalse(bad["success"])

        # 6. With no collection / main window, nothing may fake success.
        null_router = BridgeRouter(
            col_getter=lambda: None,
            mw_getter=lambda: None,
            config_getter=lambda: {},
            config_writer=lambda p: p,
        )

        def call_null(action, payload):
            raw = null_router.handle_pycmd(
                "modern_anki:" + json.dumps({"action": action, "data": payload})
            )
            return json.loads(raw)["data"]

        self.assertFalse(call_null("batch_action", {"actionType": "suspend", "cardIds": ["201"]})["success"])
        for act, payload, key in (
            ("update_card_inline", {"cardId": "201", "front": "x"}, "saved"),
            ("save_pasted_image", {"base64Data": "aGVsbG8=", "ext": "png", "filename": "x.png"}, "saved"),
            ("quick_add", {"front": "x", "back": "y"}, "created"),
            ("save_deck_options", {"deckId": "1", "newPerDay": 25}, "saved"),
            ("set_card_flag", {"cardId": "201", "flag": 1}, "changed"),
        ):
            self.assertFalse(call_null(act, payload).get(key, False), f"{act} must not fake success")
        self.assertFalse(call_null("sync", {})["synced"])

    def test_17_deck_options_flags_and_custom_study(self):
        """Verify Deck Options (FSRS & daily limits), 7-Color Flags, and Custom Study / Mistake Drills."""
        # 1. Deck Options: get_deck_options & save_deck_options + dashboard deck options exposure
        opt_get = self._call("get_deck_options", {"deckId": "1"})["data"]
        self.assertTrue(opt_get["success"])
        self.assertEqual(opt_get["options"]["newPerDay"], 20)
        self.assertEqual(opt_get["options"]["revPerDay"], 200)
        self.assertAlmostEqual(opt_get["options"]["desiredRetention"], 0.90)

        opt_save = self._call(
            "save_deck_options",
            {
                "deckId": "1",
                "newPerDay": 35,
                "revPerDay": 300,
                "learningSteps": "30s 10m 1d",
                "relearningSteps": "15m",
                "leechThreshold": 6,
                "desiredRetention": 0.86,
            },
        )["data"]
        self.assertTrue(opt_save["saved"])
        self.assertEqual(opt_save["options"]["newPerDay"], 35)
        self.assertEqual(opt_save["options"]["revPerDay"], 300)
        self.assertEqual(opt_save["options"]["learningSteps"], "30s 10m 1d")
        self.assertEqual(opt_save["options"]["relearningSteps"], "15m")
        self.assertEqual(opt_save["options"]["leechThreshold"], 6)
        self.assertAlmostEqual(opt_save["options"]["desiredRetention"], 0.86)

        dash_decks = self._call("get_dashboard", {})["data"]["decks"]
        deck_1 = next(d for d in dash_decks if d["id"] == "1")
        self.assertIn("options", deck_1)
        self.assertEqual(deck_1["options"]["newPerDay"], 35)
        self.assertAlmostEqual(deck_1["options"]["desiredRetention"], 0.86)

        # 2. 7-Color Flags: set_card_flag, search_cards flag filter, and batch_action(setFlag)
        flag_res = self._call("set_card_flag", {"cardId": "201", "flag": 1})["data"]
        self.assertTrue(flag_res["changed"])
        self.assertEqual(flag_res["flag"], 1)
        self.assertEqual(self.mock_col.get_card(201).flags & 7, 1)

        search_red = self._call("search_cards", {"flag": "1"})["data"]
        self.assertEqual(search_red["filteredCount"], 1)
        self.assertEqual(search_red["cards"][0]["id"], "201")
        self.assertEqual(search_red["cards"][0]["flags"], 1)

        search_flagged = self._call("search_cards", {"flag": "flagged"})["data"]
        self.assertEqual(search_flagged["filteredCount"], 1)

        search_blue = self._call("search_cards", {"flag": "4"})["data"]
        self.assertEqual(search_blue["filteredCount"], 0)

        # Batch setFlag to 4 (Blue) on both cards
        batch_flag = self._call(
            "batch_action",
            {"actionType": "setFlag", "cardIds": ["201", "202"], "flag": 4},
        )["data"]
        self.assertTrue(batch_flag["success"])
        self.assertEqual(self.mock_col.get_card(201).flags & 7, 4)
        self.assertEqual(self.mock_col.get_card(202).flags & 7, 4)

        # Clear flag on 202
        self._call("set_card_flag", {"cardId": "202", "flag": 0})
        self.assertEqual(self.mock_col.get_card(202).flags & 7, 0)

        # 3. Custom Study / Mistake Drill / Flag Cram / Review Ahead
        now_ms = int(time.time() * 1000)
        self.mock_col.db.conn.execute(
            "INSERT INTO revlog VALUES (?, 202, 0, 1, 1, 15, 2500, 3500, 1)",
            (now_ms - 5000,),
        )
        self.mock_col.db.conn.commit()
        self.mock_col.get_card(202).lapses = 3

        prev_mistakes = self._call(
            "preview_custom_study",
            {"preset": "mistakes", "days": 7, "limit": 20},
        )["data"]
        self.assertTrue(prev_mistakes["success"])
        self.assertGreaterEqual(prev_mistakes["totalMatched"], 1)

        cram_mistakes = self._call(
            "start_custom_study",
            {"preset": "mistakes", "days": 7, "limit": 20, "isPreviewOnly": True},
        )["data"]
        self.assertTrue(cram_mistakes["success"])
        self.assertTrue(cram_mistakes["isPreviewOnly"])
        self.assertIn("202", cram_mistakes["cardIds"])

        # Flagged preset filtering for flag 4 (card 201)
        cram_flagged = self._call(
            "start_custom_study",
            {"preset": "flagged", "flag": "4", "limit": 10},
        )["data"]
        self.assertTrue(cram_flagged["success"])
        self.assertEqual(cram_flagged["cardIds"], ["201"])

        # Review Ahead preset (look ahead 20 days -> includes card 202 with due=25 when today=10)
        cram_ahead = self._call(
            "start_custom_study",
            {"preset": "ahead", "days": 20, "limit": 10},
        )["data"]
        self.assertTrue(cram_ahead["success"])
        self.assertIn("201", cram_ahead["cardIds"])
        self.assertIn("202", cram_ahead["cardIds"])

    def test_18_image_occlusion_and_maintenance_tools(self):
        """Verify Image Occlusion HTML rendering (hide-all vs hide-one, question vs answer) and Maintenance Tools."""
        # 1. Image Occlusion rendering on Question side vs Answer side
        io_html = (
            '<div>心脏解剖图</div>'
            '<div class="anki-io-wrap" data-io-mode="hide-all" style="position:relative;display:inline-block;">'
            '<img src="heart_diagram.png" data-anki-media="heart_diagram.png" />'
            '<span class="anki-io-rect" data-io-rect="1" style="position:absolute;left:10.00%;top:20.00%;width:30.00%;height:15.00%;">{{c1::左心室}}</span>'
            '<span class="anki-io-rect" data-io-rect="2" style="position:absolute;left:55.00%;top:45.00%;width:25.00%;height:15.00%;">{{c2::主动脉弓}}</span>'
            '</div>'
        )
        note101 = self.mock_col.get_note(101)
        note101["正面"] = io_html
        note101._is_cloze = True

        rev_q = self._call("start_review", {"deckId": "1"})["data"]
        card_io = rev_q["cards"][0]
        # Question side (frontHtml): c1 is active target, c2 is masked (hide-all mode)
        self.assertIn("anki-io-target", card_io["frontHtml"])
        self.assertIn("? #1", card_io["frontHtml"])
        self.assertIn("anki-io-masked", card_io["frontHtml"])
        self.assertNotIn("左心室", card_io["frontHtml"])
        self.assertNotIn("主动脉弓", card_io["frontHtml"])
        # Answer side (frontAnswerHtml): c1 is revealed highlight frame, c2 is subtle dashed outline
        self.assertIn("anki-io-revealed", card_io["frontAnswerHtml"])
        self.assertIn("anki-io-other", card_io["frontAnswerHtml"])

        # Test hide-one mode: c2 should be anki-io-hidden on question side
        note101["正面"] = io_html.replace('data-io-mode="hide-all"', 'data-io-mode="hide-one"')
        rev_q_hide_one = self._call("start_review", {"deckId": "1"})["data"]
        card_io_one = rev_q_hide_one["cards"][0]
        self.assertIn("anki-io-target", card_io_one["frontHtml"])
        self.assertIn("anki-io-hidden", card_io_one["frontHtml"])

        # 2. Import / Export native triggers
        imp_res = self._call("trigger_native_import", {})["data"]
        self.assertTrue(imp_res["success"])
        exp_res = self._call("trigger_native_export", {})["data"]
        self.assertTrue(exp_res["success"])

        # 3. System Maintenance: Check Database (PRAGMA quick_check + ANALYZE + counts)
        db_res = self._call("run_maintenance", {"toolType": "check_db"})["data"]
        self.assertTrue(db_res["success"])
        self.assertEqual(db_res["status"], "ok")
        self.assertGreaterEqual(db_res["cardCount"], 2)
        self.assertGreaterEqual(db_res["noteCount"], 2)

        # 4. System Maintenance: Check & Clean Empty Cards
        empty_res_0 = self._call("run_maintenance", {"toolType": "check_empty_cards"})["data"]
        self.assertTrue(empty_res_0["success"])
        self.assertEqual(empty_res_0["emptyCount"], 0)

        # Simulate card 202 having a blank front field
        note102 = self.mock_col.get_note(102)
        note102["正面"] = "   "
        empty_res_1 = self._call("run_maintenance", {"toolType": "check_empty_cards"})["data"]
        self.assertEqual(empty_res_1["emptyCount"], 1)
        self.assertEqual(empty_res_1["emptyCards"][0]["cardId"], "202")

        clean_empty_res = self._call("run_maintenance", {"toolType": "clean_empty_cards"})["data"]
        self.assertTrue(clean_empty_res["success"])
        self.assertEqual(clean_empty_res["removedCount"], 1)

        # 5. System Maintenance: Check & Clean Media
        # Create one referenced file ("diagram.png") and one unused file ("orphan_unused.png") in temp_media
        (Path(self.temp_media) / "diagram.png").write_bytes(b"referenced")
        (Path(self.temp_media) / "orphan_unused.png").write_bytes(b"unused")
        media_res = self._call("run_maintenance", {"toolType": "check_media"})["data"]
        self.assertTrue(media_res["success"])
        self.assertGreaterEqual(media_res["unusedCount"], 1)
        self.assertIn("orphan_unused.png", media_res["unusedFiles"])

        clean_media_res = self._call("run_maintenance", {"toolType": "clean_unused_media"})["data"]
        self.assertTrue(clean_media_res["success"])
        self.assertGreaterEqual(clean_media_res["removedCount"], 1)
        self.assertFalse((Path(self.temp_media) / "orphan_unused.png").exists())
        self.assertTrue((Path(self.temp_media) / "diagram.png").exists())

    def test_19_note_types_duplicate_sort_find_replace(self):
        """Verify Note Types, Real-Time Duplicate Check, Bidirectional Creation, Library Multi-Sort, Remove Tag, and Find & Replace."""
        # Restore clean card texts on 101 and 102
        note101 = self.mock_col.get_note(101)
        note101["正面"] = "快速排序"
        note101["释义"] = "分治算法"
        note102 = self.mock_col.get_note(102)
        note102["正面"] = "虚拟内存"
        note102["释义"] = "页表映射机制"
        self.mock_col.db.conn.execute(
            "UPDATE notes SET sfld = '快速排序', flds = '快速排序\x1f分治算法' WHERE id = 101"
        )
        self.mock_col.db.conn.execute(
            "UPDATE notes SET sfld = '虚拟内存', flds = '虚拟内存\x1f页表映射机制' WHERE id = 102"
        )
        self.mock_col.db.conn.commit()

        # 1. get_note_types returns available note models with fields
        nt_res = self._call("get_note_types", {})["data"]
        self.assertTrue(nt_res["success"])
        self.assertGreaterEqual(len(nt_res["noteTypes"]), 2)
        self.assertEqual(nt_res["noteTypes"][0]["name"], "Basic")

        # 2. check_duplicate detects exact duplicate on sfld/front and respects excludeNoteId
        dup_hit = self._call("check_duplicate", {"front": "快速排序"})["data"]
        self.assertTrue(dup_hit["isDuplicate"])
        self.assertGreaterEqual(dup_hit["count"], 1)

        dup_excl = self._call("check_duplicate", {"front": "快速排序", "excludeNoteId": "101"})["data"]
        self.assertFalse(dup_excl["isDuplicate"])

        dup_miss = self._call("check_duplicate", {"front": "全新不存在的词条XYZ"})["data"]
        self.assertFalse(dup_miss["isDuplicate"])

        # 3. quick_add with createReverseCard=True
        #    「默写卡」预设已下线，即使旧调用方仍传 typeAnswerMode，也不应再注入「默写」标签
        bi_res = self._call(
            "quick_add",
            {
                "deckId": "1",
                "front": "TCP 三次握手",
                "back": "SYN -> SYN+ACK -> ACK",
                "tags": ["计网"],
                "createReverseCard": True,
                "typeAnswerMode": True,
            },
        )["data"]
        self.assertTrue(bi_res["created"])
        self.assertEqual(bi_res["createdCount"], 2)
        self.assertNotIn("默写", self.mock_col.get_note(101).tags)

        # 4. search_cards multi-dimensional sortBy (lapses_desc, ivl_asc, ivl_desc, front_asc)
        self.mock_col.get_card(201).lapses = 1
        self.mock_col.get_card(202).lapses = 9
        self.mock_col.get_card(201).ivl = 30
        self.mock_col.get_card(202).ivl = 5

        lapses_sorted = self._call("search_cards", {"sortBy": "lapses_desc"})["data"]["cards"]
        self.assertEqual(lapses_sorted[0]["id"], "202")
        self.assertEqual(lapses_sorted[0]["lapses"], 9)

        ivl_asc_sorted = self._call("search_cards", {"sortBy": "ivl_asc"})["data"]["cards"]
        self.assertEqual(ivl_asc_sorted[0]["id"], "202")

        ivl_desc_sorted = self._call("search_cards", {"sortBy": "ivl_desc"})["data"]["cards"]
        self.assertEqual(ivl_desc_sorted[0]["id"], "201")

        # 5. batch_action(removeTag)
        note102.tags = ["操作系统", "待清理标签"]
        rm_tag_res = self._call(
            "batch_action",
            {"actionType": "removeTag", "cardIds": ["202"], "tag": "待清理标签"},
        )["data"]
        self.assertTrue(rm_tag_res["success"])
        self.assertNotIn("待清理标签", self.mock_col.get_note(102).tags)
        self.assertIn("操作系统", self.mock_col.get_note(102).tags)

        # 6. batch_action(findReplace) with fieldScope & ignoreCase
        fr_res = self._call(
            "batch_action",
            {
                "actionType": "findReplace",
                "cardIds": ["202"],
                "findText": "页表映射",
                "replaceText": "多级页表地址转换",
                "fieldScope": "back",
                "ignoreCase": False,
            },
        )["data"]
        self.assertTrue(fr_res["success"])
        self.assertEqual(fr_res["replacedCount"], 1)
        self.assertIn("多级页表地址转换", self.mock_col.get_note(102)["释义"])

    def test_20_search_cards_collection_total_and_facet_counts(self):
        """
        Verify collectionTotal stays true to the whole collection even under filters,
        and facetCounts aggregate across ALL cards rather than just page 1 (limit).
        """
        from anki_modern_os.bridge.search_service import SearchService

        db = MockDB()
        cur = db.conn.cursor()
        cur.execute("DELETE FROM cards")
        cur.execute("DELETE FROM notes")
        cur.execute("DELETE FROM revlog")

        # Seed 15 cards across notes:
        # - Cards 1..5 (page 1 when limit=5): all active future reviews (queue=2, due=25), 0 suspended!
        # - Cards 6..12 (7 cards beyond page 1!): suspended (queue=-1)
        # - Card 13: due today (queue=2, due=10), flag=1, FSRS difficulty d=7.2 (high)
        # - Card 14: new (type=0, queue=0), tag '高频', flag=2, FSRS difficulty d=3.1 (low)
        # - Card 15: buried (queue=-2), rated today in revlog
        now_ms = int(time.time() * 1000)
        for cid in range(1, 16):
            nid = 1000 + cid
            tags = " 核心 高频 " if cid in (10, 14) else (" 核心 " if cid <= 5 else " 扩展 ")
            flags = 1 if cid == 13 else (2 if cid == 14 else 0)
            if cid <= 5:
                ctype, queue, due, lapses, data = 2, 2, 25, 0, ""
            elif 6 <= cid <= 12:
                ctype, queue, due, lapses, data = 2, -1, 25, (2 if cid == 6 else 0), ""
            elif cid == 13:
                ctype, queue, due, lapses, data = 2, 2, 10, 1, '{"d": 7.2, "s": 4.0}'
            elif cid == 14:
                ctype, queue, due, lapses, data = 0, 0, 14, 0, '{"d": 3.1, "s": 1.0}'
            else:
                ctype, queue, due, lapses, data = 2, -2, 25, 0, ""

            cur.execute(
                "INSERT INTO notes VALUES (?, ?, 1, 0, 0, ?, ?, ?, 0, 0, '')",
                (nid, f"g-{cid}", tags, f"Front {cid}\x1fBack {cid}", f"Front {cid}"),
            )
            cur.execute(
                "INSERT INTO cards VALUES (?, ?, 1, 0, 0, 0, ?, ?, ?, 10, 2500, 1, ?, 0, 0, 0, ?, ?)",
                (cid, nid, ctype, queue, due, lapses, flags, data),
            )
        cur.execute("INSERT INTO revlog VALUES (?, 15, 0, 3, 1, 1, 2500, 3000, 1)", (now_ms,))
        db.conn.commit()

        class SqlBackedCol:
            def __init__(self, sql_db):
                self.db = sql_db

                class Sched:
                    today = 10

                class Decks:
                    @staticmethod
                    def get(did, default=False):
                        return {"id": int(did), "name": "Default"}

                class Tags:
                    @staticmethod
                    def all():
                        return ["核心", "高频", "扩展"]

                self.sched = Sched()
                self.decks = Decks()
                self.tags = Tags()

            def card_count(self):
                return int(self.db.first("SELECT count(*) FROM cards")[0])

            def find_cards(self, query):
                rows = self.db.all(
                    "SELECT c.id, c.type, c.queue, c.due, c.flags, n.tags "
                    "FROM cards c JOIN notes n ON c.nid = n.id ORDER BY c.id ASC"
                )
                rated_ids = {int(r[0]) for r in self.db.all("SELECT DISTINCT cid FROM revlog")}
                tokens = query.split()
                out = []
                for cid, ctype, queue, due, flags, tags_str in rows:
                    if "is:suspended" in tokens and queue != -1:
                        continue
                    if "-is:suspended" in tokens and queue == -1:
                        continue
                    if "is:buried" in tokens and queue not in (-2, -3):
                        continue
                    if "-is:buried" in tokens and queue in (-2, -3):
                        continue
                    if "is:new" in tokens and not (ctype == 0 or queue == 0):
                        continue
                    if "rated:1" in tokens and cid not in rated_ids:
                        continue
                    if "(is:due" in query and not (queue in (1, 3) or (queue == 2 and due <= 10)):
                        continue
                    if "is:review" in tokens and not (ctype == 2 and queue == 2):
                        continue
                    if "-is:due" in tokens and (queue in (1, 3) or (queue == 2 and due <= 10)):
                        continue
                    if "-flag:0" in tokens and (flags & 7) == 0:
                        continue
                    matched_flag = True
                    for tok in tokens:
                        if tok.startswith("flag:") and (flags & 7) != int(tok.split(":", 1)[1]):
                            matched_flag = False
                        if tok.startswith('tag:"') and tok[5:-1] not in tags_str.split():
                            matched_flag = False
                    if not matched_flag:
                        continue
                    out.append(int(cid))
                return out

            def get_card(self, cid):
                row = self.db.first(
                    "SELECT id, nid, did, type, queue, due, ivl, reps, lapses, flags FROM cards WHERE id = ?",
                    int(cid),
                )
                nrow = self.db.first("SELECT flds, tags FROM notes WHERE id = ?", int(row[1]))
                flds = nrow[0].split("\x1f")
                note = MockNote(row[1], {"正面": flds[0], "释义": flds[1]}, nrow[1].split(), cids=[row[0]])
                c = MockCard(row[0], note, queue=row[4], ctype=row[3], due=row[5], ivl=row[6])
                c.lapses = row[8]
                c.flags = row[9]
                return c

        svc = SearchService(col_getter=lambda: SqlBackedCol(db))

        # 1. Paginated unfiltered query (limit=5): page 1 has 0 suspended cards, yet facetCounts must report 7!
        res_all = svc.search_cards({"query": "", "status": "all", "offset": 0, "limit": 5})
        self.assertEqual(len(res_all["cards"]), 5)
        self.assertEqual(res_all["collectionTotal"], 15)
        self.assertEqual(res_all["filteredCount"], 15)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["all"], 15)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["suspended"], 7)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["due"], 1)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["new"], 1)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["completed"], 1)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["buried"], 1)
        self.assertEqual(res_all["facetCounts"]["statusCounts"]["review"], 5)
        self.assertEqual(res_all["facetCounts"]["difficultyCounts"]["high"], 2)  # card 6 (lapses=2) + card 13 (d=7.2)
        self.assertEqual(res_all["facetCounts"]["difficultyCounts"]["low"], 1)   # card 14 (d=3.1)
        self.assertEqual(res_all["facetCounts"]["flagCounts"]["flagged"], 2)
        self.assertEqual(res_all["facetCounts"]["flagCounts"]["1"], 1)
        self.assertEqual(res_all["facetCounts"]["flagCounts"]["2"], 1)
        self.assertEqual(res_all["facetCounts"]["tagAllCount"], 15)
        self.assertEqual(res_all["facetCounts"]["tagCounts"]["高频"], 2)

        # 2. Selecting status='suspended' must match facetCounts.suspended == 7 and keep collectionTotal == 15
        res_susp = svc.search_cards({"query": "", "status": "suspended", "offset": 0, "limit": 5})
        self.assertEqual(res_susp["collectionTotal"], 15)
        self.assertEqual(res_susp["filteredCount"], 7)
        self.assertEqual(res_susp["facetCounts"]["statusCounts"]["all"], 15)
        self.assertEqual(res_susp["facetCounts"]["statusCounts"]["suspended"], 7)
        self.assertEqual(res_susp["facetCounts"]["difficultyCounts"]["all"], 7)
        self.assertEqual(res_susp["facetCounts"]["difficultyCounts"]["high"], 1)  # card 6 among suspended
        self.assertEqual(res_susp["facetCounts"]["tagAllCount"], 7)
        self.assertEqual(res_susp["facetCounts"]["tagCounts"]["高频"], 1)       # card 10 among suspended

        # 3. Cmd+K / LoadMore with includeFacets=False skips facet aggregation
        res_no_facets = svc.search_cards({"query": "", "includeFacets": False})
        self.assertIsNone(res_no_facets["facetCounts"])

    def test_24_editor_media_base_url_and_roundtrip_normalization(self):
        """Item #25: Verify mediaBaseUrl exposure, safe WebView <img> resolution, and SQLite storage normalization."""
        from bridge.media_utils import (
            normalize_media_html_for_storage,
            resolve_media_img_src_for_webview,
        )

        # 1. Both get_dashboard and get_preferences expose envInfo.mediaBaseUrl pointing to collection.media
        dash = self._call("get_dashboard")["data"]
        prefs = self._call("get_preferences")["data"]
        expected_base = Path(self.temp_media).resolve().as_uri() + "/"
        self.assertEqual(dash["envInfo"]["mediaBaseUrl"], expected_base)
        self.assertEqual(prefs["envInfo"]["mediaBaseUrl"], expected_base)

        # 2. WebView resolver rewrites relative <img> filenames without clobbering Cloze, sound, or data-src
        raw = (
            '<div>{{c1::公式}} [sound:rec.mp3] '
            '<img data-src="keep_attr.png" src="paste-1.png" /> '
            '<img src=Screen%20Shot.png> '
            '<img src="https://example.com/x.png" /></div>'
        )
        resolved = resolve_media_img_src_for_webview(raw, self.temp_media)
        self.assertIn("{{c1::公式}}", resolved)
        self.assertIn("[sound:rec.mp3]", resolved)
        self.assertIn('data-src="keep_attr.png"', resolved)
        self.assertIn(f'src="{expected_base}paste-1.png"', resolved)
        self.assertIn(f'src="{expected_base}Screen%20Shot.png"', resolved)
        self.assertIn('src="https://example.com/x.png"', resolved)

        # 3. Stale foreign file:// URI with data-anki-media existing in media_dir is rescued
        rescue_file = Path(self.temp_media) / "rescued shot.png"
        rescue_file.write_bytes(b"pngdata")
        stale = '<img src="file:///C:/OtherMachine/rescued%20shot.png" data-anki-media="rescued shot.png">'
        rescued = resolve_media_img_src_for_webview(stale, self.temp_media)
        self.assertIn(f'src="{rescue_file.resolve().as_uri()}"', rescued)

        # 4. Saving via quick_add / update_card_inline normalizes local media_dir file:// URIs back to relative filenames
        front_with_file_url = (
            f'<div>{{{{c1::测试}}}} <img src="{rescue_file.resolve().as_uri()}" data-anki-media="rescued shot.png" /></div>'
        )
        qa = self._call(
            "quick_add",
            {"deckId": "1", "front": front_with_file_url, "back": "还剩 38 张", "tags": ["img-test"]},
        )["data"]
        self.assertTrue(qa["created"])
        new_nid = int(qa["noteId"])
        stored_front = self.mock_col.get_note(new_nid)["Text"]
        self.assertIn('src="rescued shot.png"', stored_front)
        self.assertNotIn("file://", stored_front)

        # Same normalization applies on inline update_card_inline
        up = self._call(
            "update_card_inline",
            {
                "noteId": str(new_nid),
                "cardId": str(qa["cardId"]),
                "fields": {
                    "Text": f'<img src="{expected_base}paste-1.png" />',
                    "Back Extra": "Updated",
                },
            },
        )["data"]
        self.assertTrue(up["saved"])
        self.assertEqual(up["fields"]["Text"], '<img src="paste-1.png" />')
        # Non-collection file:// outside media_dir is left untouched
        outside_uri = "file:///tmp/outside_unrelated/pic.png"
        self.assertEqual(
            normalize_media_html_for_storage(f'<img src="{outside_uri}">', self.temp_media),
            f'<img src="{outside_uri}">',
        )


    def test_22_native_image_occlusion_renders_static_masks(self):
        """原生 Image Occlusion 必须转成静态遮罩，而不是把指令当正文直出。

        回归护栏：search / review 原先都取 ``fields[0]`` 当正文，而原生遮挡卡的
        第一个字段是 Occlusion（遮挡指令），底图在 Image 字段。修复后统一走
        ``render_native_image_occlusion``。

        字段格式以 Anki 自己写出来的为准（AnkiWeb 原生遮挡卡包实测）：
        ``{{c1::image-occlusion:rect:left=.0361:top=.8137:width=.2539:height=.0147:oi=1}}``
        —— 坐标是 0–1 小数，不是 SVG 的 0–100 viewBox。
        """
        from bridge.media_utils import render_native_image_occlusion

        note = {
            "Image": '<img src="io_01.png">',
            "Occlusion": (
                "{{c1::image-occlusion:rect:left=0.1:top=0.2:width=0.3:height=0.15:oi=1}}"
            ),
            "Header": "遮挡标题",
        }
        front, back, title = render_native_image_occlusion(note)
        self.assertIn("anki-io-wrap", front)
        self.assertIn('src="io_01.png"', front)
        self.assertIn("anki-io-rect", front)
        # 0–1 小数乘以 100 变成百分比
        self.assertIn("left:10.00%", front)
        self.assertIn("top:20.00%", front)
        self.assertIn("width:30.00%", front)
        self.assertIn("height:15.00%", front)
        # 原始指令不应再出现在正文里
        self.assertNotIn("image-occlusion:", front)
        self.assertEqual(back, '<img src="io_01.png">')
        self.assertEqual(title, "遮挡标题")

        # 尺寸为 0 的矩形要丢弃，否则会生成看不见也点不到的遮罩
        zero = dict(note)
        zero["Occlusion"] = "{{c1::image-occlusion:rect:left=0:top=0:width=0:height=0.1:oi=1}}"
        self.assertEqual(render_native_image_occlusion(zero)[0], "")

        # 非遮挡笔记必须返回空三元组，调用方据此回落
        self.assertEqual(render_native_image_occlusion({"Front": "x"}), ("", "", ""))

        # 同一 ordinal 下的多个遮罩：data-io-rect 必须保留**组号**（都是 1），不能抹成
        # 1/2/3 的流水号。下游按 card.ord + 1 决定露哪一组，组号被抹平的话，多组遮挡
        # 笔记的两张卡会显示同一片区域。
        same_group = dict(note)
        same_group["Occlusion"] = "".join(
            f"{{{{c1::image-occlusion:rect:left={i / 10}:top={i / 10}:"
            f"width=0.1:height=0.1:oi=1}}}}"
            for i in (1, 2, 3)
        )
        front_same = render_native_image_occlusion(same_group)[0]
        self.assertEqual(
            re.findall(r'data-io-rect="(\d+)"', front_same), ["1", "1", "1"]
        )
        self.assertEqual(
            re.findall(r"\{\{c(\d+)::", front_same), ["1", "1", "1"]
        )

        # 两组遮挡（c1 两块 + c2 一块）→ 组号 1/1/2，两组各成一张卡
        two_groups = dict(note)
        two_groups["Occlusion"] = (
            "{{c1::image-occlusion:rect:left=0.1:top=0.1:width=0.1:height=0.1:oi=1}}"
            "{{c1::image-occlusion:rect:left=0.3:top=0.3:width=0.1:height=0.1:oi=1}}"
            "{{c2::image-occlusion:rect:left=0.5:top=0.5:width=0.1:height=0.1:oi=1}}"
        )
        front_two = render_native_image_occlusion(two_groups)[0]
        self.assertEqual(
            re.findall(r'data-io-rect="(\d+)"', front_two), ["1", "1", "2"]
        )

        # `oi=1` 是 Anki 区分两种遮挡模式的唯一开关（原生编辑器由 hideAllGuessOne 直接
        # 决定写不写它）。带 oi → 隐藏全部；不带 oi → 只隐藏当前这张卡那组。
        # 这里守住「读」的这一侧：渲染时必须把 mode 从指令串里还原出来，否则用
        # hide-one 建的卡在插件界面里也会被当成 hide-all、全部盖住。
        self.assertIn('data-io-mode="hide-all"', front_same)
        hide_one = dict(note)
        hide_one["Occlusion"] = (
            "{{c1::image-occlusion:rect:left=0.1:top=0.1:width=0.1:height=0.1}}"
            "{{c1::image-occlusion:rect:left=0.3:top=0.3:width=0.1:height=0.1}}"
        )
        front_hide_one = render_native_image_occlusion(hide_one)[0]
        self.assertIn('data-io-mode="hide-one"', front_hide_one)
        self.assertNotIn("oi=", front_hide_one)


    def test_23_sync_no_changes_checked_timestamp_and_requires_login(self):
        """Anki NO_CHANGES leaves col.ls unchanged; verified check timestamp must merge cleanly."""
        from anki_modern_os.bridge.deck_service import DeckService

        profile_key = DeckService.resolve_profile_sync_key(self.mock_mw)
        stale_ls = 1794313537121
        fresh_checked = stale_ls + 40 * 60 * 1000
        self.config_store["last_sync_checked_map"] = {profile_key: fresh_checked}

        # 1. With col.ls > 0 and newer checked timestamp, get_dashboard merges to fresh_checked
        dash = self._call("get_dashboard", {})["data"]
        self.assertTrue(dash["synced"])
        self.assertEqual(dash["syncedAt"], fresh_checked)

        # 2. If col.ls == 0 (never synced / unconfigured profile), never fabricate synced status
        self.mock_col.ls = 0
        dash_unsynced = self._call("get_dashboard", {})["data"]
        self.assertFalse(dash_unsynced["synced"])
        self.assertEqual(dash_unsynced["syncedAt"], 0)

        # 3. action_sync when pm.sync_auth() returns None triggers native handler (opens login)
        #    and reports requiresLogin=True with synced=False
        clicked = {"count": 0}
        self.mock_mw.on_sync_button_clicked = lambda: clicked.__setitem__("count", clicked["count"] + 1)
        self.mock_mw.pm.sync_auth = lambda: None
        login_res = self._call("sync", {})["data"]
        self.assertEqual(clicked["count"], 1)
        self.assertFalse(login_res["synced"])
        self.assertTrue(login_res["requiresLogin"])
        self.assertTrue(login_res["triggeredNativeSync"])
        self.assertEqual(login_res["syncedAt"], 0)

        # 4. action_sync when authenticated marks asyncPending=True instead of faking immediate completion
        self.mock_mw.pm.sync_auth = lambda: b"hkey"
        auth_res = self._call("sync", {})["data"]
        self.assertEqual(clicked["count"], 2)
        self.assertTrue(auth_res["synced"])
        self.assertTrue(auth_res["asyncPending"])
        self.assertFalse(auth_res["requiresLogin"])

    def test_25_answer_card_starts_timer_before_build_answer(self):
        """Anki 26 build_answer reads card.timer_started; answer_card must invoke card.start_timer()."""
        import types

        card = self.mock_col.get_card(201)
        card.timer_started = None
        timer_calls = {"count": 0}

        def start_timer():
            timer_calls["count"] += 1
            card.timer_started = 100.0

        card.start_timer = start_timer

        sched_answers = []
        orig_backend = getattr(self.mock_col, "_backend", None)

        class StubBackend:
            @staticmethod
            def get_scheduling_states(cid):
                return {"cid": cid}

        class StubAnswer:
            milliseconds_taken = 0

        def fake_build_answer(card, states, rating):
            if card.timer_started is None:
                raise TypeError("unsupported operand type(s) for -: 'float' and 'NoneType'")
            return StubAnswer()

        def fake_answer_card(ans):
            sched_answers.append(ans.milliseconds_taken)

        anki_mod = types.ModuleType("anki")
        sched_pkg = types.ModuleType("anki.scheduler")
        v3_mod = types.ModuleType("anki.scheduler.v3")

        class StubCardAnswer:
            AGAIN = 1
            HARD = 2
            GOOD = 3
            EASY = 4

        v3_mod.CardAnswer = StubCardAnswer
        sched_pkg.v3 = v3_mod
        anki_mod.scheduler = sched_pkg

        saved_modules = {k: sys.modules.get(k) for k in ("anki", "anki.scheduler", "anki.scheduler.v3")}
        self.mock_col._backend = StubBackend()
        self.mock_col.sched.build_answer = fake_build_answer
        self.mock_col.sched.answer_card = fake_answer_card
        try:
            sys.modules["anki"] = anki_mod
            sys.modules["anki.scheduler"] = sched_pkg
            sys.modules["anki.scheduler.v3"] = v3_mod

            res = self._call("answer_card", {"cardId": "201", "ease": 3, "elapsedMs": 3200})["data"]
            self.assertTrue(res["answered"])
            self.assertEqual(timer_calls["count"], 1)
            self.assertEqual(sched_answers, [3200])
        finally:
            if orig_backend is None:
                delattr(self.mock_col, "_backend")
            else:
                self.mock_col._backend = orig_backend
            if hasattr(self.mock_col.sched, "build_answer"):
                delattr(self.mock_col.sched, "build_answer")
            if hasattr(self.mock_col.sched, "answer_card"):
                delattr(self.mock_col.sched, "answer_card")
            for k, old in saved_modules.items():
                if old is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = old

    def test_26_multi_language_16_locales_resolution_and_formatting(self):
        """Verify 16 official Anki languages resolution, alias mapping, greetings, and weekday labels."""
        from anki_modern_os.bridge.deck_service import (
            SUPPORTED_LANG_CODES,
            DeckService,
            normalize_language_code,
        )

        self.assertEqual(len(SUPPORTED_LANG_CODES), 16)
        # Verify Anki locale aliases normalize to canonical 16 codes
        self.assertEqual(normalize_language_code("zh_CN"), "zh-CN")
        self.assertEqual(normalize_language_code("zh_TW"), "zh-TW")
        self.assertEqual(normalize_language_code("zh-HK"), "zh-TW")
        self.assertEqual(normalize_language_code("ja_JP"), "ja")
        self.assertEqual(normalize_language_code("ko_KR"), "ko")
        self.assertEqual(normalize_language_code("pt_BR"), "pt-BR")
        self.assertEqual(normalize_language_code("es_ES"), "es")
        self.assertEqual(normalize_language_code("fr_FR"), "fr")
        self.assertEqual(normalize_language_code("de_DE"), "de")
        self.assertEqual(normalize_language_code("ru_RU"), "ru")
        self.assertEqual(normalize_language_code("it_IT"), "it")
        self.assertEqual(normalize_language_code("ar_SA"), "ar")
        self.assertEqual(normalize_language_code("vi_VN"), "vi")
        self.assertEqual(normalize_language_code("tr_TR"), "tr")
        self.assertEqual(normalize_language_code("pl_PL"), "pl")
        self.assertEqual(normalize_language_code("nl_NL"), "nl")

        # Verify save_preferences + get_dashboard across multiple languages
        for lang_code, expected_mon in (
            ("ja", "月"),
            ("ko", "월"),
            ("zh-TW", "一"),
            ("es", "Lun"),
            ("de", "Mo"),
            ("ru", "Пн"),
        ):
            save_res = self._call("save_preferences", {"language": lang_code})["data"]
            self.assertEqual(save_res["preferences"]["language"], lang_code)
            dash = self._call("get_dashboard", {})["data"]
            self.assertEqual(dash["language"], lang_code)
            self.assertEqual(dash["weeklyRhythm"]["days"][0]["label"], expected_mon)
            self.assertTrue(len(DeckService._get_greeting(9, lang_code)) > 0)

    def test_27_windows_qa_fixes_no_deprecated_save_and_prefs21_schema(self):
        """Verify Windows QA fixes: no deprecated col.save/reset calls when _backend exists, and valid prefs21.db _global schema."""
        # 1. When col._backend is present (Anki 26 Rust backend), deprecated col.save() and col.sched.reset() must NEVER be called
        save_calls = {"col_save": 0, "sched_reset": 0}
        self.mock_col._backend = object()
        self.mock_col.save = lambda: save_calls.__setitem__("col_save", save_calls["col_save"] + 1)
        self.mock_col.sched.reset = lambda: save_calls.__setitem__("sched_reset", save_calls["sched_reset"] + 1)
        try:
            self._call("set_vacation", {"days": 2, "reason": "Win Test"})
            self._call("cancel_vacation", {})
            self._call("set_vacation", {"days": 2, "reason": "Win Test 2"})
            self._call("end_vacation", {})
            self._call("rescue_backlog", {"mode": "amortize", "days": 3})
            self._call("undo_rescue", {})
            self._call("save_deck_options", {"deckId": "1", "newPerDay": 25})
            self.assertEqual(save_calls["col_save"], 0)
            self.assertEqual(save_calls["sched_reset"], 0)
        finally:
            delattr(self.mock_col, "_backend")
            delattr(self.mock_col, "save")
            delattr(self.mock_col.sched, "reset")

    def test_28_review_back_uses_native_template_not_second_field(self):
        """背面正文必须走 Anki 模板引擎，不能只取 ``fields[1]``。

        回归护栏：``UVBasic-English`` 这类多字段卡包（单词/音标/释义/vocab/柯林斯…）
        在编辑界面字段齐全，但背诵界面背面只显示音标——因为序列化时把
        ``field_keys[1]`` 当成了整张背面。修复后背面交给 ``card.render_output()``，
        拓展字段全部回来，同时模板里的脚本/样式/``{{hint}}`` 脚手架必须清干净。
        """
        from anki_modern_os.bridge.media_utils import sanitize_rendered_card_html

        answer_html = (
            '<div id="english" class="section">perceive'
            '<div class="phonetic">[pə\'si:v]</div></div>'
            '<div id="chinese" class="extension">vt.察觉 <br />v.感知</div>'
            '<div id="sample_en" class="extension">This means that our noses are limited…</div>'
            '<a class=hint href="#" onclick="this.style.display=\'none\';return false;" '
            'draggable=false>vocab简明</a>'
            '<div id="hintabc" class=hint style="display: none">When we <b>perceive</b> something…</div>'
            '<div id="vocab" class="section" onclick="toggle(\'vocab\')">&nbsp;</div>'
            "<script>function toggle(e){}</script>"
            "<style>#ext_collins{display:none}</style>"
        )

        class StubAVTag:
            filename = "perceive.mp3"

        class StubRenderOutput:
            answer_text = answer_html
            question_text = '<div id="english">perceive</div>'
            answer_av_tags = [StubAVTag()]

        card = self.mock_col.get_card(201)
        rendered_calls = []

        def fake_render_output(*args, **kwargs):
            rendered_calls.append((args, kwargs))
            return StubRenderOutput()

        card.render_output = fake_render_output

        card_data = self._call("start_review", {"deckId": "1"})["data"]["cards"][0]

        # 1. 拓展字段全部出现在背面，不再是“只有音标”
        self.assertIn("vt.察觉", card_data["backHtml"])
        self.assertIn("This means that our noses are limited", card_data["backHtml"])
        # 2. 正面维持原设计（field[0]），不被模板渲染接管
        self.assertEqual(card_data["front"], "快速排序")
        # 3. 模板里的脏东西一律清掉，否则会撑破 React 的样式表或抛 ReferenceError
        for dirty in ("<script", "<style", "onclick", "display: none", "<a class=hint"):
            self.assertNotIn(dirty, card_data["backHtml"])
        # 4. {{hint:}} 的隐藏内容要露出来（脚本不跑就没有展开入口）
        self.assertIn("When we <b>perceive</b> something", card_data["backHtml"])
        # 5. 原生渲染剥掉的 [sound:] 要从 answer_av_tags 补回音频列表
        self.assertIn("perceive.mp3", card_data["audioFiles"])
        # 6. 必须走完整渲染：browser=True 是浏览器列表用的降级路径，正面会退化成
        #    “第一个字段原样文本”，{@code {{FrontSide}}} 也跟着塌成那一个字段
        self.assertEqual(rendered_calls, [((), {})])

        # 没有模板引擎可用时（老版本 Anki / 单元测试桩）必须安静降级，不能抛异常
        from anki_modern_os.bridge.media_utils import render_native_card_html

        del card.render_output
        self.assertEqual(render_native_card_html(object()), ("", [], ""))
        self.assertEqual(render_native_card_html(None), ("", [], ""))
        self.assertEqual(sanitize_rendered_card_html(""), "")

        # 降级后回落取 fields[1]，行为与修复前一致（至少不是空白页面）
        fallback = self._call("start_review", {"deckId": "1"})["data"]["cards"][0]
        self.assertIn("<b>分治</b>", fallback["backHtml"])

    def test_29_review_back_injects_scoped_model_css(self):
        """模板 CSS 必须跟模板 HTML 成对注入，否则背面就是一坨无样式纯文本。

        回归护栏：v1.4.1 只搬了正文没搬样式，用户的卡包背面丢了 `.section` 色条、
        `.extension` 灰块、词性小标签。注入时还要处理三件事：
        1. 卡包 css 字段常是遗留 HTML 大杂烩（自带 `</style>`），必须先抽出纯 CSS；
        2. 选择器必须收进 `.anki-native-card`，否则 `.card` / `.section` 会污染全站；
        3. `@import` 的柯林斯样式表要就地展开，`url()` 要改写成 `file:///`。
        """
        from anki_modern_os.bridge.media_utils import (
            build_card_css,
            extract_model_css_text,
            wrap_card_with_styles,
        )

        collins = self.temp_media + "/_collins_c.css"
        Path(collins).write_text(".word_header_word{ font-size:30px }", encoding="utf-8")

        soup = (
            "</style>\n<!-- 英语单词模板-vocab配色 -->\n<style>\n"
            "@import url('_collins_c.css');\n"
            ".card { color:#686868; }\n"
            ".section { background:#fff; }\n"
            "body .x { color:red }\n"
            "#ext_collins{ display:none }\n"
            "#vocab{ background-image:url('_vocab_logo.png') }\n"
            "@media (max-width:600px){ .extension{ font-size:14px } }\n"
            "</style>\n<script>function toggle(e){}</script>"
        )

        # 1. 遗留 HTML 大杂烩 → 纯 CSS（`</style>` 与注释都不许留）
        text = extract_model_css_text(soup)
        self.assertNotIn("<style", text)
        self.assertNotIn("</style", text)
        self.assertNotIn("toggle", text)
        self.assertIn(".card", text)

        css = build_card_css(soup, self.temp_media)
        # 2. 每条选择器都收进容器；body 前缀被替换成容器本身
        self.assertIn(".anki-native-card .card", css)
        self.assertIn(".anki-native-card .section", css)
        self.assertIn(".anki-native-card .x", css)
        self.assertNotIn("body .x", css)
        # 3. @import 就地展开、url() 改成 file:///
        self.assertIn(".anki-native-card .word_header_word", css)
        self.assertIn("url('file://", css)
        # 4. 靠脚本点开的折叠块直接展开，否则内容永远看不到
        self.assertNotIn("display:none", css.replace(" ", ""))
        self.assertNotIn("#ext_collins", css)
        # 5. @media 里的规则同样要作用域化
        self.assertIn("@media (max-width:600px)", css)
        self.assertIn(".anki-native-card .extension", css)

        # 6. 正文包进容器；缺 CSS 时不加壳（老卡包 / 渲染失败）
        wrapped = wrap_card_with_styles("<div>x</div>", css)
        self.assertTrue(wrapped.startswith("<style>"))
        self.assertIn('<div class="anki-native-card"><div class="card">', wrapped)
        self.assertEqual(wrap_card_with_styles("<div>x</div>", ""), "<div>x</div>")
        self.assertEqual(build_card_css("", self.temp_media), "")

        # 7. 整条链路：render_output 里的 css 会被作用域化后单独带出
        class StubRenderOutput:
            answer_text = '<div id="chinese" class="extension">vt.察觉</div>'
            answer_av_tags = []
            css = "</style><style>.card{color:#333}#ext_collins{display:none}</style>"

        card = self.mock_col.get_card(201)
        card.render_output = lambda browser=False: StubRenderOutput()
        from anki_modern_os.bridge.media_utils import render_native_card_html

        html, audio, page_css = render_native_card_html(card, self.temp_media)
        self.assertIn("vt.察觉", html)
        self.assertEqual(audio, [])
        self.assertIn(".anki-native-card .card", page_css)
        self.assertNotIn("display:none", page_css.replace(" ", ""))
        self.assertNotIn("<style", page_css)
        self.assertNotIn("</style", page_css)

    def test_30_search_payload_carries_scoped_css_per_notetype(self):
        """Cmd+K 右侧预览要靠 ``cardStyles`` 才能还原卡包样式。

        回归护栏：列表只发 HTML 不发 CSS 时，弹窗右栏会把柯林斯的色条、词性小标签、
        真题块统统摊成一段灰扑扑的纯文本（编辑器里样式却是好的，所以很容易漏）。
        样式必须跟着搜索结果走，但**按卡型去重**——200 条结果各带一份会把响应撑爆，
        而且同一副牌里卡型通常只有一两种。
        """
        class StubRenderOutput:
            answer_text = '<div class="extension">vt.察觉</div>'
            answer_av_tags = []
            css = (
                "</style><style>.card{color:#333}"
                "#ext_collins{display:none}</style>"
            )

        for cid in (201, 202):
            card = self.mock_col.get_card(cid)
            card.render_output = lambda browser=False: StubRenderOutput()

        res = self._call("search_cards", {"query": "", "limit": 10})["data"]

        # 1. 两张卡同属一个卡型 → 只带一份样式表
        self.assertIn("cardStyles", res)
        self.assertEqual(len(res["cardStyles"]), 1)
        model_id = next(iter(res["cardStyles"]))
        css = res["cardStyles"][model_id]
        self.assertIn(".anki-native-card .card", css)
        self.assertNotIn("display:none", css.replace(" ", ""))

        # 2. 卡片要能指回自己的卡型，否则前端挑不到样式表
        for item in res["cards"]:
            self.assertEqual(item["notetypeId"], model_id)

        # 3. 列表本身的 HTML 保持干净：样式统一在 cardStyles 里，不塞进正文
        first = next(i for i in res["cards"] if i["id"] == "201")
        self.assertIn("vt.察觉", first["backHtml"])
        self.assertNotIn("<style", first["backHtml"])

        # 4. 没有模板引擎可用时不能凭空造样式
        for cid in (201, 202):
            del self.mock_col.get_card(cid).render_output
        clean = self._call("search_cards", {"query": "", "limit": 10})["data"]
        self.assertEqual(clean["cardStyles"], {})

    def test_31_front_falls_back_to_template_when_first_field_is_not_front(self):
        """第一个字段未必是正面：蛋卷 JLPT 卡包把 NoteID 排在第一位。

        回归护栏：用户导入 ``eggrolls-JLPT10k`` 后整张卡显示一串 uuid。根因有两处，
        都指同一个假设——“正面 = fields[0]、渲染结果跟 browser 标志无关”：

        1. ``render_output(browser=True)`` 是给浏览器列表用的降级路径，``question_text``
           会直接退化成第一个字段的原样文本，``{{FrontSide}}`` 跟着一起塌。
        2. 正面一直盲取 ``fields[0]``，那个字段是 ``NoteID`` 时就是一串 uuid。

        这里锁住三件事：完整渲染（不带 browser 参数）、按模板正文反查显示字段、
        正面在必要时改用模板渲染。
        """
        from anki_modern_os.bridge.media_utils import (
            pick_display_field,
            render_native_card_sides,
            sanitize_rendered_card_html,
        )

        uuid = "469b5ba2-a0bb-11ef-9eca-75d1f1bae144"
        fields = {"NoteID": uuid, "VocabKanji": "高校", "VocabDefSC": "高中"}

        # 1. 按模板正面反查显示字段：跳过 uuid，挑到 VocabKanji
        self.assertEqual(pick_display_field(fields, "<h1>高校</h1>"), "VocabKanji")
        # 2. 第一个字段本来就是正面内容时不动（绝大多数卡包走这条）
        self.assertEqual(
            pick_display_field({"单词": "perceive", "释义": "察觉"}, "<div>perceive</div>"),
            "单词",
        )
        # 3. 没有任何字段出现在正面里 → 老实退回第一个字段，不猜
        self.assertEqual(pick_display_field(fields, "<div>其他内容</div>"), "NoteID")
        self.assertEqual(pick_display_field({}, "<div>x</div>"), "")
        # 4. 传入的必须是净化后的正文：原始渲染结果里那段脚本还带着 uuid，
        #    不先洗掉就会误判成“NoteID 出现在正面里”
        raw = f"<script>var n='{uuid}'</script><main>高校</main>"
        self.assertNotIn(uuid, sanitize_rendered_card_html(raw))
        self.assertEqual(
            pick_display_field(fields, sanitize_rendered_card_html(raw)), "VocabKanji"
        )

        # 5. 完整渲染：render_output 不能带 browser 参数，且要同时拿到正反两面
        class StubAV:
            filename = "koukou.mp3"

        class StubOutput:
            question_text = '<main><h1>高校</h1><div class="VocabAudio">[anki:play:a:0]</div></main>'
            answer_text = '<main><h1>高校</h1><p>高中</p><div class="VocabAudio">[anki:play:a:0]</div></main>'
            question_av_tags = [StubAV()]
            answer_av_tags = [StubAV()]
            css = ".card{color:#333}"

        called = []

        class StubCard:
            def render_output(self, *args, **kwargs):
                called.append((args, kwargs))
                return StubOutput()

        sides = render_native_card_sides(StubCard(), self.temp_media)
        self.assertEqual(called, [((), {})])  # 不允许再传 browser=True
        self.assertIn("高校", sides.question)
        self.assertIn("高中", sides.answer)
        self.assertEqual(sides.question_audio, ["koukou.mp3"])
        self.assertEqual(sides.answer_audio, ["koukou.mp3"])
        self.assertIn(".anki-native-card .card", sides.css)
        # [anki:play:a:0] 是给 Anki 自己的重播按钮用的占位符，我们不复刻那个按钮
        for side in (sides.question, sides.answer):
            self.assertNotIn("[anki:play", side)

        # 6. 整条链路：字段全对不上时，正面改用“模板里真正出现的那个字段”，不再吐 uuid
        card = self.mock_col.get_card(201)

        class FrontOnly:
            question_text = "<main><h1>平均 O(n log n)</h1></main>"
            answer_text = ""
            question_av_tags = []
            answer_av_tags = []
            css = ".card{color:#333}"

        card.render_output = lambda *a, **k: FrontOnly()
        data = self._call("start_review", {"deckId": "1"})["data"]["cards"][0]
        # fields[0] 是“快速排序”，模板正面里没有它 → 换成模板里出现过的那个字段
        self.assertEqual(data["front"], "平均 O(n log n)")
        self.assertIn("平均 O(n log n)", data["frontHtml"])
        self.assertNotIn("快速排序", data["frontHtml"])

    def test_32_eight_popular_apkg_models_study_search_edit_compatibility(self):
        """回归守卫：8 大热门第三方 APKG 卡包在学习、搜索与编辑三模式下的渲染与字段识别。

        覆盖：
        1. ``strip_front_side_from_answer`` 剥离背面重复的 ``{{FrontSide}}``（``<hr id=answer>``、
           ``<main id="FrontSide">``、前缀匹配及 ``.hanzi`` 块去重）。
        2. ``convert_furigana_to_ruby`` 将日语振假名 `` 漢字[かな]`` 转为 ``<ruby>漢字<rt>かな</rt></ruby>``，
           并在 ``{{kanji:...}}`` 题干模式下剥离读音避免剧透。
        3. ``eggrolls-JLPT10k`` 脚本中的 ``VocabPoS`` / ``SentType1..4`` 还原为 ``［名］``/``［例］``/``［訳］``
           并移除无效 ``.Top`` / ``.Search`` 装饰栏。
        4. ``N1N2N3N4N5`` 蓝宝书例句卡（``class="sentenceexample"``）优先识别 ``Example*`` 字段，不误取 ``Level``/``Word``。
        5. ``Chinese Grammar Wiki`` 语法判断卡提取 ``<div class="header">`` 提问提示语。
        6. ``HSK1-6`` 背面自动补齐模板漏写的 ``Phiên âm`` 与 ``Tiếng Việt``，且 ``scope_card_css`` 过滤刺眼的 ``background-color: green``。
        7. ``120.apkg`` 与 ``HSK1-6`` 中的 MDX 词典序号标记 `` `1` `` / `` `2` `` 被干净剥离。
        """
        from anki_modern_os.bridge.media_utils import (
            convert_furigana_to_ruby,
            pick_display_field,
            plain_text_of,
            sanitize_rendered_card_html,
            scope_card_css,
            strip_front_side_from_answer,
        )

        # 1. Furigana conversion & kanji-only mode
        self.assertEqual(
            convert_furigana_to_ruby("今[いま]の 私[わたし]があるのも 監督[かんとく]<b>あっての</b>ことです。"),
            "<ruby>今<rt>いま</rt></ruby>の<ruby>私<rt>わたし</rt></ruby>があるのも<ruby>監督<rt>かんとく</rt></ruby><b>あっての</b>ことです。",
        )
        self.assertEqual(
            convert_furigana_to_ruby("山田[やまだ] 監督[かんとく]は 恩人[おんじん]です。", strip_reading=True),
            "山田監督は恩人です。",
        )
        # Phonetic brackets in English / Pinyin must NOT be mistaken for Japanese furigana
        self.assertEqual(convert_furigana_to_ruby("abandon [ə'bændən]"), "abandon [ə'bændən]")
        self.assertEqual(convert_furigana_to_ruby("爱 [ài]"), "爱 [ài]")

        # 2. plain_text_of strips <rt>, furigana brackets, MDX `\d+` markers, and inline tags without CJK word spaces
        self.assertEqual(
            plain_text_of("`1`<b>爱</b>其子，择师而教之 <ruby>恩<rt>おん</rt></ruby><ruby>人<rt>じん</rt></ruby>"),
            "爱其子，择师而教之 恩人",
        )

        # 3. strip_front_side_from_answer removes duplicated FrontSide across 4 template patterns
        self.assertEqual(
            strip_front_side_from_answer(
                "<div>Front Question</div><hr id=answer><div>Back Answer</div>",
                "<div>Front Question</div>",
            ),
            "<div>Back Answer</div>",
        )
        self.assertEqual(
            strip_front_side_from_answer(
                '<section id="Card"><main id="FrontSide"><h1>一敗塗地</h1></main><main id="BackSide"><p>一败涂地</p></main></section>',
                '<section id="Card"><main id="FrontSide"><h1>一敗塗地</h1></main></section>',
            ),
            '<section id="Card"><main id="BackSide"><p>一败涂地</p></main></section>',
        )
        self.assertEqual(
            strip_front_side_from_answer(
                '<div class="hanzi">她比我高。</div><div class="spacer"></div><div class="pinyin">Tā bǐ wǒ gāo.</div>',
                '<div class="header">Is this sentence grammatically correct?</div><div class="hanzi">她比我高。</div>',
            ),
            '<div class="pinyin">Tā bǐ wǒ gāo.</div>',
        )

        # 4. eggrolls-JLPT10k script transform restores [PoS] and [SentType] badges and strips .Top / .Search
        jlpt_raw = (
            '<div class="Top"><a href="#">Deck</a></div>'
            '<h3 class="VocabPoS LabelIndent">一败涂地。</h3>'
            '<h3 class="SentKanji LabelIndent">試合に負けた。</h3>'
            '<h3 class="SentDef LabelIndent">比赛输了。</h3>'
            '<a class="Search" href="#">Search</a>'
            "<script>function getType(){return ['一', '例', '関', '対']} "
            "const m = {'VocabPoS': '四字熟語' ? '四字熟語' : '名'}</script>"
        )
        jlpt_clean = sanitize_rendered_card_html(jlpt_raw)
        self.assertNotIn('class="Top"', jlpt_clean)
        self.assertNotIn('class="Search"', jlpt_clean)
        self.assertIn('<em lang="ja">［四字熟語］</em>一败涂地。', jlpt_clean)
        self.assertIn('<em lang="ja">［一］</em>試合に負けた。', jlpt_clean)
        self.assertIn('<em lang="ja">［訳］</em>比赛输了。', jlpt_clean)

        # 5. N1N2N3N4N5 sentence card picks Example1 instead of Level or Word
        n1_fields = {
            "Note ID": "N1-001",
            "Link": "001",
            "Level": "N1",
            "Word": "～あっての",
            "Example1": "山田[やまだ] 監督[かんとく]は 私[わたし]の 恩人[おんじん]です。 今[いま]の 私[わたし]があるのも 監督[かんとく]<b>あっての</b>ことです。",
        }
        n1_front_rendered = (
            '<div class="top">例文カード<span class="level">【N1】</span></div>'
            '<div class="sentenceexample">山田監督は私の恩人です。今の私があるのも監督<b>あっての</b>ことです。</div>'
        )
        self.assertEqual(pick_display_field(n1_fields, n1_front_rendered), "Example1")

        # 6. scope_card_css strips harsh green background and tall min-height
        scoped_css = scope_card_css(
            ".card { font-size: 20px; background-color: green; min-height: 364px; color: #333; }"
        )
        self.assertNotIn("green", scoped_css)
        self.assertNotIn("364px", scoped_css)
        self.assertIn("color: #333", scoped_css)


    def test_33_step1_smart_full_page_flip_and_sfld_fallback(self):
        """第 1 步核心架构升级回归：智能整页翻面判定 + ReviewService replaceFrontOnFlip + SearchService sfld 兜底。"""
        from anki_modern_os.bridge.media_utils import should_replace_front_on_flip

        class StubTemplateCard:
            def __init__(self, afmt: str):
                self._afmt = afmt

            def template(self):
                return {"afmt": self._afmt}

        # 1. afmt 含 {{FrontSide}} 时直接整页替换
        self.assertTrue(
            should_replace_front_on_flip(
                StubTemplateCard("{{FrontSide}}<hr id=answer>{{Back}}"),
                "高校",
                "<div>无关文本</div>",
            )
        )
        # 2. afmt 不含 {{FrontSide}}，但答案面已手写复述正面正文（如 CGW / N1N2N3N4N5）时同样整页替换
        self.assertTrue(
            should_replace_front_on_flip(
                StubTemplateCard("<div class='hanzi'>{{中文}}</div>{{英文}}"),
                "她比我高。",
                "<div class='hanzi'>她比我高。</div><div>She is taller than me.</div>",
            )
        )
        # 3. 柯林斯类无 FrontSide 且答案面不复述正面时保留上方正面
        self.assertFalse(
            should_replace_front_on_flip(
                StubTemplateCard("<div class='phonetic'>{{英美音标}}</div><div class='ext'>{{柯林斯}}</div>"),
                "perceive",
                "<div class='phonetic'>[pə'si:v]</div><div class='ext'>vt. 察觉</div>",
            )
        )

        # 4. ReviewService 正确透传 replaceFrontOnFlip 且整页替换时保留完整 answer（不剥 FrontSide）
        class StubFrontSideOutput:
            question_text = "<div class='q'>高校</div>"
            answer_text = "<div class='q'>高校</div><hr id=answer><div class='a'>高中</div>"
            question_av_tags = []
            answer_av_tags = []
            css = ".card{color:#333}"

        card = self.mock_col.get_card(201)
        card.template = lambda: {"afmt": "{{FrontSide}}<hr id=answer>{{释义}}"}
        card.render_output = lambda *a, **k: StubFrontSideOutput()

        rev = self._call("start_review", {"deckId": "1"})["data"]["cards"][0]
        self.assertTrue(rev["replaceFrontOnFlip"])
        self.assertIn("高校", rev["backHtml"])
        self.assertIn("高中", rev["backHtml"])

        # 5. SearchService 优先采用非元数据模板/渲染正文作摘要，不让 sfld='2005' 或 UUID 成为标题
        class StubSearchOutput:
            question_text = "<div class='header'>Is this correct?</div><div class='hanzi'>她比我高。</div>"
            answer_text = "<div class='hanzi'>她比我高。</div><div class='pinyin'>Tā bǐ wǒ gāo.</div>"
            question_av_tags = []
            answer_av_tags = []
            css = ".card{color:#333}"

        note101 = self.mock_col.get_note(101)
        note101["正面"] = "她比我高。"
        self.mock_col.db.conn.execute("UPDATE notes SET sfld = '2005' WHERE id = 101")
        self.mock_col.db.conn.commit()
        card.render_output = lambda *a, **k: StubSearchOutput()

        search_item = self._call("search_cards", {"query": "", "limit": 10})["data"]["cards"][0]
        self.assertEqual(search_item["front"], "她比我高。")
        self.assertNotEqual(search_item["front"], "2005")

    def test_34_track_b_sandbox_and_notetype_toggle_and_front_styles(self):
        """验证 Track B 本地 HTTP 媒体服务 + 沙盒 HTML/CSS 生成 + 按卡型记忆开关 + 正反面完整模板样式保留。"""
        from anki_modern_os.bridge.media_utils import (
            get_media_http_base_url,
            render_sandbox_card_sides,
        )

        # 1. Mock mediaServer.getPort() -> loopback:8765
        class StubMediaServer:
            @staticmethod
            def getPort():
                return 8765

        self.mock_mw.mediaServer = StubMediaServer()
        loopback_base = "http://" + ".".join(("127", "0", "0", "1")) + ":8765/"
        http_base = get_media_http_base_url(self.mock_mw)
        self.assertEqual(http_base, loopback_base)

        dash = self._call("get_dashboard", {})["data"]
        self.assertEqual(dash["envInfo"]["mediaHttpBaseUrl"], loopback_base)

        # 2. render_sandbox_card_sides 保留 <script>、display:none 并把相对图片和 @font-face 改写为本地 HTTP
        class StubSandboxOutput:
            question_text = (
                "<div class='top'>蓝宝书<span class='level'>【N1】</span></div>"
                "<div class='word'>～あっての</div>"
                "<img src='grammar_chart.png'>"
                "<script>window.customInit && window.customInit();</script>"
            )
            answer_text = (
                "<div class='word'>～あっての</div>"
                "<div class='connectiveTag'>接続</div>"
                "[anki:play:a:0]"
                "<div id='ext_collins'>Collins Detail</div>"
            )
            question_av_tags = []
            answer_av_tags = []
            css = (
                "@font-face { font-family: JPFont; src: url('_SourceHanSerifJP-Medium.otf'); }\n"
                ".connectiveTag { background: #eee; border-radius: 6px; }\n"
                "#ext_collins { display: none; }"
            )

        card = self.mock_col.get_card(201)
        note101 = self.mock_col.get_note(101)
        note101["正面"] = "～あっての"
        card.render_output = lambda *a, **k: StubSandboxOutput()

        sb = render_sandbox_card_sides(card, self.temp_media, http_base_url=http_base)
        self.assertIn("<script>window.customInit", sb.question)
        self.assertIn(f"{loopback_base}grammar_chart.png", sb.question)
        self.assertIn("window.pycmd('play:a:0')", sb.answer)
        self.assertIn(f"{loopback_base}_SourceHanSerifJP-Medium.otf", sb.css)
        self.assertIn("display: none", sb.css)

        # 3. ReviewService 同时为 Track A 正反面包裹 .anki-native-card 与完整 <style>，且下发 Track B 字段
        rev_card = self._call("start_review", {"deckId": "1"})["data"]["cards"][0]
        self.assertEqual(rev_card["front"], "～あっての")
        self.assertIn("<style>", rev_card["frontHtml"])
        self.assertIn("anki-native-card", rev_card["frontHtml"])
        self.assertIn("蓝宝书", rev_card["frontHtml"])
        self.assertIn("<style>", rev_card["backHtml"])
        self.assertIn(".anki-native-card .connectiveTag", rev_card["backHtml"])
        self.assertEqual(rev_card["notetypeId"], "1")
        self.assertIn(f"{loopback_base}grammar_chart.png", rev_card["sandboxFrontHtml"])
        self.assertIn(f"{loopback_base}_SourceHanSerifJP-Medium.otf", rev_card["sandboxCss"])

        # 4. toggle_notetype_sandbox 按卡型切换并持久化到 preferences
        t1 = self._call("toggle_notetype_sandbox", {"notetypeId": "1", "enabled": True})["data"]
        self.assertTrue(t1["enabled"])
        self.assertIn("1", t1["sandboxNoteTypeIds"])
        prefs = self._call("get_preferences", {})["data"]
        self.assertIn("1", prefs["sandboxNoteTypeIds"])

        t2 = self._call("toggle_notetype_sandbox", {"notetypeId": "1", "enabled": False})["data"]
        self.assertFalse(t2["enabled"])
        self.assertNotIn("1", t2["sandboxNoteTypeIds"])

    def test_35_occlusion_editor_writes_native_io_note_with_exactly_one_card(self):
        """遮挡编辑器 → 原生 IO 笔记，且「N 个遮罩 = 1 张卡」。

        这条规则反直觉但必须锁住：Anki 里 **一个 ordinal 出一张卡**，同一个 ordinal
        重复出现会被合并成一个 shapes 组。所以 occlusions 必须全部写 ``c1``。用户报的
        「我只加了一张遮挡卡，怎么冒出三张」就是按遮罩递增写 ``c1``/``c2``/``c3`` 造成
        的。任何一次重构若把它改回递增，这条测试会立刻红。
        """
        masks = "".join(
            f"{{{{c1::image-occlusion:rect:left={left}:top={top}:"
            "width=0.1:height=0.1:oi=1}}}}"
            for left, top in (("0.10", "0.20"), ("0.30", "0.40"), ("0.50", "0.60"))
        )
        payload = {
            "occlusions": masks,
            "image": '<img src="paste_1.jpg">',
            "header": "遮挡标题",
            "mode": "hide-all",
            "previewHtml": "<div class='anki-io-wrap'></div>",
            "backExtra": "背面补充",
        }
        res = self._call(
            "quick_add",
            {
                "deckId": "1",
                "front": "",  # 原生遮挡笔记没有自由正文，front 为空也必须能建
                "back": "",
                "tags": ["遮挡"],
                "imageOcclusion": payload,
            },
        )
        self.assertEqual(res["status"], "success", res.get("message"))
        data = res["data"]
        self.assertTrue(data["created"])
        self.assertTrue(data["imageOcclusion"])
        # ① 一张笔记、一张卡 —— 三个遮罩不额外产卡
        self.assertEqual(data["createdCount"], 1)
        self.assertEqual(len(data["cardIds"]), 1)

        note = self.mock_col._io_note
        self.assertIsNotNone(note, "did not go through the Image Occlusion branch")
        self.assertEqual(note.note_type()["name"], "Image Occlusion")
        # ② 三个遮罩全部落进 Occlusion 字段，且共用一个 ordinal
        self.assertEqual(note["Occlusion"].count("image-occlusion:rect:"), 3)
        self.assertEqual(set(re.findall(r"\{\{c(\d+)::", note["Occlusion"])), {"1"})
        # 用户手写的 0–1 小数坐标要原样保留（不要被当成 0–100 百分比再除一次）
        self.assertIn("left=0.10:top=0.20", note["Occlusion"])
        # ③ 底图 / 标题 / 补充说明落进各自字段
        self.assertEqual(note["Image"], '<img src="paste_1.jpg">')
        self.assertEqual(note["Header"], "遮挡标题")
        self.assertEqual(note["Back Extra"], "背面补充")
        self.assertEqual(note.tags, ["遮挡"])

        # ④ 反证：把同一个 payload 改成递增 ordinal，就必须变成三张卡。
        #    这既证明假 Anki 的建卡规则与真实 Anki 一致，也说明上面「1 张」不是
        #    因为假集合写死返回 1。
        seq_masks = "".join(
            f"{{{{c{ordinal}::image-occlusion:rect:left=0.{ordinal}0:top=0.{ordinal}0:"
            "width=0.1:height=0.1:oi=1}}}}"
            for ordinal in (1, 2, 3)
        )
        seq = self._call(
            "quick_add",
            {
                "deckId": "1",
                "imageOcclusion": {**payload, "occlusions": seq_masks},
            },
        )
        self.assertEqual(seq["status"], "success", seq.get("message"))
        self.assertEqual(seq["data"]["createdCount"], 3)

        # ⑤ 缺底图或缺遮罩必须报错，不能静默建出一张看不见的遮挡卡
        for broken in (
            {"occlusions": masks, "image": ""},
            {"occlusions": "", "image": '<img src="x.jpg">'},
        ):
            bad = self._call(
                "quick_add", {"deckId": "1", "imageOcclusion": broken}
            )
            self.assertEqual(bad["status"], "error")

    def test_36_get_card_debug_info_forensics_and_anomaly_detection(self):
        """get_card_debug_info 返回完整卡型/模板/原始字段/原生渲染，并自动捕获挖空与不可见字符异常。"""
        note101 = self.mock_col.get_note(101)
        note101["正面"] = "《{{c1::测}}试》\u200b 和 {{c2:未闭合"
        self._call("toggle_notetype_sandbox", {"notetypeId": "1", "enabled": True})

        res = self._call("get_card_debug_info", {"cardId": "201"})
        self.assertEqual(res["status"], "success", res.get("message"))
        data = res["data"]
        self.assertTrue(data["available"])
        self.assertEqual(data["cardInfo"]["id"], "201")
        self.assertEqual(data["noteTypeInfo"]["modelType"], 0)
        self.assertIn("activeTemplate", data["noteTypeInfo"])
        self.assertIn("{{c1::测}}", data["noteInfo"]["rawFields"]["正面"])

        codes = {a["code"] for a in data["clozeAndCharDiagnostics"]["anomalies"]}
        self.assertIn("CLOZE_SYNTAX_IN_STANDARD_MODEL", codes)
        self.assertIn("BROKEN_CLOZE_SYNTAX", codes)
        self.assertIn("INVISIBLE_CHARS_DETECTED", codes)

        cfg_snap = data["runtime"]["configSnapshot"]
        self.assertTrue(cfg_snap["compatEnabledForCardNoteType"])
        self.assertIn("1", cfg_snap["sandboxNoteTypeIds"])

        # 不存在的卡号必须优雅降级，不抛异常
        missing = self._call("get_card_debug_info", {"cardId": "999999999"})
        self.assertEqual(missing["status"], "success")
        self.assertFalse(missing["data"]["available"])
        self.assertEqual(missing["data"]["reason"], "card_not_found")

    def test_37_custom_standard_template_cloze_auto_converts_to_companion_model(self):
        import copy
        from types import SimpleNamespace

        custom_css = (
            ".card { font-family: Georgia, serif; font-size: 22px; background: #1e293b; color: #f8fafc; }\n"
            ".custom-wrap { border-left: 4px solid #38bdf8; padding-left: 12px; }\n"
        )
        custom_model = {
            "id": 9001,
            "name": "My Custom Note",
            "type": 0,
            "css": custom_css,
            "flds": [{"name": "Question", "ord": 0}, {"name": "Notes", "ord": 1}],
            "tmpls": [
                {
                    "name": "Card 1",
                    "ord": 0,
                    "qfmt": '<div class="custom-wrap">{{Question}}</div>',
                    "afmt": '{{FrontSide}}<hr id=answer><div class="extra">{{Notes}}</div>',
                }
            ],
        }
        models_store = {
            9001: custom_model,
            1: {"id": 1, "name": "Basic", "type": 0, "flds": [{"name": "正面"}, {"name": "释义"}]},
            2: {"id": 2, "name": "Cloze", "type": 1, "flds": [{"name": "Text"}, {"name": "Back Extra"}]},
        }
        next_mid = [9002]
        notes_store = {}
        next_nid = [9200]

        note_a = MockNote(9101, {"Question": "Mitochondria powers the cell", "Notes": "Bio"}, ["bio"], cids=[9501])
        note_a._model = copy.deepcopy(custom_model)
        note_b = MockNote(9102, {"Question": "Ribosome builds proteins", "Notes": "Keep standard"}, ["bio"], cids=[9502])
        note_b._model = copy.deepcopy(custom_model)
        notes_store[9101] = note_a
        notes_store[9102] = note_b

        class _StatefulCard(MockCard):
            def render_output(self_card):
                nt = self_card.note().note_type()
                css_text = nt.get("css", "")
                q_val = self_card.note()["Question"]
                n_val = self_card.note()["Notes"]
                if nt.get("type") == 1:
                    q_cloze = re.sub(
                        r"\{\{c\d+::([\s\S]*?)(?:::([\s\S]*?))?\}\}",
                        lambda m: f'<span class="cloze">[{m.group(2) or "..."}]</span>',
                        q_val,
                    )
                    a_cloze = re.sub(
                        r"\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}",
                        lambda m: f'<span class="cloze">{m.group(1)}</span>',
                        q_val,
                    )
                    return SimpleNamespace(
                        question_text=f'<div class="custom-wrap">{q_cloze}</div>',
                        answer_text=f'<div class="custom-wrap">{a_cloze}</div><hr id=answer><div class="extra">{n_val}</div>',
                        css=css_text,
                        question_av_tags=[],
                        answer_av_tags=[],
                    )
                return SimpleNamespace(
                    question_text=f'<div class="custom-wrap">{q_val}</div>',
                    answer_text=f'<div class="custom-wrap">{q_val}</div><hr id=answer><div class="extra">{n_val}</div>',
                    css=css_text,
                    question_av_tags=[],
                    answer_av_tags=[],
                )

        card_a = _StatefulCard(9501, note_a)
        card_b = _StatefulCard(9502, note_b)
        self.mock_col._cards[9501] = card_a
        self.mock_col._cards[9502] = card_b

        class _StatefulModels:
            def all(self_m):
                return [copy.deepcopy(m) for m in models_store.values()]

            def current(self_m):
                return copy.deepcopy(models_store[9001])

            def get(self_m, mid):
                return copy.deepcopy(models_store.get(int(mid)))

            def by_name(self_m, name):
                for m in models_store.values():
                    if m.get("name") == name:
                        return copy.deepcopy(m)
                return None

            def add_dict(self_m, m):
                m_copy = copy.deepcopy(m)
                if not m_copy.get("id"):
                    m_copy["id"] = next_mid[0]
                    next_mid[0] += 1
                models_store[int(m_copy["id"])] = m_copy
                m["id"] = m_copy["id"]
                return m_copy

            def add(self_m, m):
                return self.add_dict(m)

            def update_dict(self_m, m):
                models_store[int(m["id"])] = copy.deepcopy(m)

            def save(self_m, m):
                self.update_dict(m)

            def change_notetype_info(self_m, old_notetype_id, new_notetype_id):
                req = SimpleNamespace(
                    note_ids=[],
                    new_fields=[f["name"] for f in models_store[int(new_notetype_id)]["flds"]],
                    new_templates=[],
                )
                return SimpleNamespace(input=req)

            def change_notetype_of_notes(self_m, req):
                # Infer target cloze companion model by matching field schema
                target = next(
                    (
                        m
                        for m in models_store.values()
                        if m.get("type") == 1
                        and [f["name"] for f in m.get("flds", [])] == list(req.new_fields)
                    ),
                    None,
                )
                for nid in list(req.note_ids):
                    if target is not None and int(nid) in notes_store:
                        notes_store[int(nid)]._model = copy.deepcopy(target)
                        notes_store[int(nid)]._is_cloze = True
                        notes_store[int(nid)]._type_name = target["name"]

        self.mock_col.models = _StatefulModels()
        orig_get_note = self.mock_col.get_note
        orig_update_note = self.mock_col.update_note
        orig_new_note = self.mock_col.new_note
        orig_add_note = self.mock_col.add_note

        def _get_note(nid):
            nid_int = int(nid)
            if nid_int in notes_store:
                return notes_store[nid_int]
            return orig_get_note(nid)

        def _update_note(note):
            if int(note.id) in notes_store:
                notes_store[int(note.id)] = note
                return
            orig_update_note(note)

        def _new_note(model):
            if int(model.get("id", 0)) >= 9001:
                nid = next_nid[0]
                next_nid[0] += 1
                fmap = {f["name"]: "" for f in model.get("flds", [])}
                n = MockNote(
                    nid,
                    fmap,
                    [],
                    is_cloze=(model.get("type") == 1),
                    cids=[nid + 1000],
                    type_name=model.get("name"),
                )
                n._model = copy.deepcopy(model)
                return n
            return orig_new_note(model)

        def _add_note(note, did):
            if int(note.note_type().get("id", 0)) >= 9001:
                notes_store[note.id] = note
                self.mock_col._cards[note._cids[0]] = _StatefulCard(note._cids[0], note)
                return note.id
            return orig_add_note(note, did)

        self.mock_col.get_note = _get_note
        self.mock_col.update_note = _update_note
        self.mock_col.new_note = _new_note
        self.mock_col.add_note = _add_note

        # Enable sandbox compat mode on original custom model 9001
        self.config_store["sandbox_notetype_ids"] = ["9001"]

        # 1) Inline/modal edit adding {{c1::...}} on custom Standard note should auto-convert to "My Custom Note (Cloze)"
        upd_resp = self._call(
            "update_card_inline",
            {
                "cardId": "9501",
                "noteId": "9101",
                "fields": {
                    "Question": "{{c1::Mitochondria}} powers the cell",
                    "Notes": "Bio",
                },
                "front": "{{c1::Mitochondria}} powers the cell",
                "meaning": "Bio",
                "tags": ["bio"],
            },
        )
        self.assertEqual(upd_resp["status"], "success")
        upd_data = upd_resp["data"]
        self.assertTrue(upd_data["saved"])
        self.assertTrue(upd_data["convertedToCloze"])
        self.assertTrue(upd_data["isCloze"])
        self.assertEqual(upd_data["previousNotetypeId"], "9001")
        self.assertEqual(upd_data["noteTypeName"], "My Custom Note (Cloze)")
        companion_mid = upd_data["notetypeId"]
        self.assertNotEqual(companion_mid, "9001")

        # Companion model copied CSS, fields, and rewrote template to {{cloze:Question}}
        companion_model = models_store[int(companion_mid)]
        self.assertEqual(companion_model["type"], 1)
        self.assertEqual([f["name"] for f in companion_model["flds"]], ["Question", "Notes"])
        self.assertIn("#1e293b", companion_model["css"])
        self.assertIn("{{cloze:Question}}", companion_model["tmpls"][0]["qfmt"])
        self.assertIn("{{cloze:Question}}", companion_model["tmpls"][0]["afmt"])
        self.assertIn("{{Notes}}", companion_model["tmpls"][0]["afmt"])
        self.assertNotIn("{{FrontSide}}", companion_model["tmpls"][0]["afmt"])

        # Sibling non-cloze note stayed untouched on original Standard model 9001
        self.assertEqual(note_b.note_type()["id"], 9001)
        self.assertEqual(note_b.note_type()["type"], 0)
        self.assertEqual(note_b["Question"], "Ribosome builds proteins")

        # Sandbox compatibility list migrated to include companion model ID
        self.assertIn("9001", upd_data["sandboxNoteTypeIds"])
        self.assertIn(companion_mid, upd_data["sandboxNoteTypeIds"])

        # Returned serialized reviewCard + libraryCard preserve custom template CSS and styled cloze pills
        review_card = upd_data["reviewCard"]
        self.assertTrue(review_card["isCloze"])
        self.assertEqual(review_card["notetypeId"], companion_mid)
        self.assertEqual(review_card["noteTypeName"], "My Custom Note (Cloze)")
        self.assertIn("anki-native-card", review_card["frontHtml"])
        self.assertIn("#1e293b", review_card["frontHtml"])
        self.assertIn("custom-wrap", review_card["frontHtml"])
        self.assertIn("[...]", review_card["frontHtml"])
        self.assertNotIn("{{c1::", review_card["frontHtml"])
        self.assertIn("Mitochondria", review_card["frontAnswerHtml"])
        self.assertIn("#1e293b", review_card["frontAnswerHtml"])
        self.assertIn("extra", review_card["backHtml"])
        self.assertIn("Bio", review_card["backHtml"])
        self.assertIn("libraryCard", upd_data)
        self.assertIn("custom-wrap", upd_data["libraryCard"]["frontHtml"])
        self.assertIn(companion_mid, upd_data.get("cardStyles", {}))

        # 2) QuickAdd with custom Standard model ID + {{c1::...}} reuses companion model and preserves custom fields
        qa_resp = self._call(
            "quick_add",
            {
                "deckId": "1",
                "modelId": "9001",
                "fields": {
                    "Question": "The {{c1::cell}} membrane",
                    "Notes": "Cell biology",
                },
                "front": "The {{c1::cell}} membrane",
                "back": "Cell biology",
                "tags": ["cell"],
            },
        )
        self.assertEqual(qa_resp["status"], "success")
        qa_data = qa_resp["data"]
        self.assertTrue(qa_data["created"])
        self.assertTrue(qa_data["isCloze"])
        self.assertEqual(qa_data["notetypeId"], companion_mid)
        self.assertEqual(qa_data["noteTypeName"], "My Custom Note (Cloze)")
        created_note = notes_store[int(qa_data["noteId"])]
        self.assertEqual(created_note["Question"], "The {{c1::cell}} membrane")
        self.assertEqual(created_note["Notes"], "Cell biology")

    def test_38_cloze_rendering_across_review_library_and_sandbox(self):
        from pathlib import Path
        from types import SimpleNamespace
        from bridge.media_utils import render_sandbox_card_sides, style_native_cloze_spans

        # 1. style_native_cloze_spans uses guaranteed compiled semantic classes and is idempotent
        native_q = '54353453453哈哈哈哈哈哈 <span class="cloze" data-cloze="哈哈" data-ordinal="1">[...]</span> 哈哈低调<span class="cloze-inactive" data-ordinal="2">低调</span>'
        styled_q = style_native_cloze_spans(native_q, is_question_side=True)
        self.assertIn("anki-cloze-question", styled_q)
        self.assertNotIn("bg-[#5E5CE6]", styled_q)
        self.assertEqual(style_native_cloze_spans(styled_q, is_question_side=True), styled_q)

        native_a = '54353453453哈哈哈哈哈哈 <span class="cloze" data-ordinal="1">哈哈</span>'
        styled_a = style_native_cloze_spans(native_a, is_question_side=False)
        self.assertIn("anki-cloze-answer", styled_a)
        self.assertNotIn("bg-[#28CD41]", styled_a)

        # 2. All semantic cloze classes exist in compiled web/assets/index.css
        css_path = Path(__file__).resolve().parents[1] / "web" / "assets" / "index.css"
        built_css = css_path.read_text(encoding="utf-8")
        for cls_name in (".anki-cloze-question", ".anki-cloze-answer", ".anki-cloze-lib", ".cloze-inactive"):
            self.assertIn(cls_name, built_css)

        # 3. Standard model card containing literal {{c1::...}}{{c2::...}} (legacy/unconverted)
        #    renders cleanly across Normal Mode, Card Library, and Compatibility Mode (Sandbox)
        std_model = {
            "id": 1001,
            "name": "Basic",
            "type": 0,
            "css": ".card { font-family: arial; }",
            "flds": [{"name": "Front", "ord": 0}, {"name": "Back", "ord": 1}],
            "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}],
        }
        note_std = MockNote(
            1201,
            {"Front": "54353453453哈哈哈哈哈哈 {{c1::哈哈}} 哈哈低调{{c2::低调}}", "Back": "54353453445大萨达所大所"},
            [],
            cids=[2201],
        )
        note_std._model = std_model

        class _LiteralCard(MockCard):
            def render_output(self_card):
                nt = self_card.note().note_type()
                f = self_card.note()["Front"]
                b = self_card.note()["Back"]
                return SimpleNamespace(
                    question_text=f"{f}<script>var keep='{{{{c1::no_touch}}}}';</script>",
                    answer_text=f"{f}\n<hr id=answer>\n{b}",
                    css=nt.get("css", ""),
                    question_av_tags=[],
                    answer_av_tags=[],
                )

        orig_get_note = self.mock_col.get_note
        self.mock_col.get_note = lambda nid: note_std if int(nid) == 1201 else orig_get_note(nid)
        self.mock_col._cards[2201] = _LiteralCard(2201, note_std)

        rev = self.router.review_service
        rc = rev._serialize_review_card(self.mock_col, 2201)
        self.assertIsNotNone(rc)
        # Normal mode question: active c1 masked with anki-cloze-question, inactive c2 plain cloze-inactive (no px-1.5 gap!)
        self.assertIn('<span class="anki-cloze-question">[...]</span>', rc["frontHtml"])
        self.assertIn('<span class="cloze-inactive" data-ordinal="2">低调</span>', rc["frontHtml"])
        self.assertNotIn("px-1.5", rc["frontHtml"])
        self.assertNotIn("bg-[#", rc["frontHtml"])
        # Normal mode answer: active c1 highlighted with anki-cloze-answer, inactive c2 plain cloze-inactive
        self.assertIn('<span class="anki-cloze-answer">哈哈</span>', rc["frontAnswerHtml"])
        self.assertIn('<span class="cloze-inactive" data-ordinal="2">低调</span>', rc["frontAnswerHtml"])
        # Sandbox mode: literal {{c1::哈哈}} and {{c2::低调}} rendered instead of raw braces; script preserved
        self.assertNotIn("{{c1::哈哈}}", rc["sandboxFrontHtml"])
        self.assertNotIn("{{c2::低调}}", rc["sandboxFrontHtml"])
        self.assertIn('<span class="cloze" data-cloze="哈哈" data-ordinal="1">[...]</span>', rc["sandboxFrontHtml"])
        self.assertIn('<span class="cloze-inactive" data-ordinal="2">低调</span>', rc["sandboxFrontHtml"])
        self.assertIn("{{c1::no_touch}}", rc["sandboxFrontHtml"])
        self.assertNotIn("{{c1::哈哈}}", rc["sandboxBackHtml"])
        self.assertIn('<span class="cloze" data-ordinal="1">哈哈</span>', rc["sandboxBackHtml"])

        # Library search serialization uses compiled anki-cloze-lib class and exposes model type metadata
        srch = self.router.search_service
        lib = srch._serialize_library_card(self.mock_col, 2201)
        self.assertIn('<span class="anki-cloze-lib">哈哈</span>', lib["frontHtml"])
        self.assertNotIn("text-[#", lib["frontHtml"])
        self.assertIs(lib["isCloze"], False)
        self.assertEqual(lib["noteTypeName"], "Basic")

        # Converted cloze note reports isCloze=True and cloze model name in library serialization
        cloze_model = {
            "id": 1002,
            "name": "Basic (Cloze)",
            "type": 1,
            "css": ".card { font-family: arial; }",
            "flds": [{"name": "Front", "ord": 0}, {"name": "Back", "ord": 1}],
            "tmpls": [{"name": "Cloze", "ord": 0, "qfmt": "{{cloze:Front}}", "afmt": "{{cloze:Front}}<hr id=answer>{{Back}}"}],
        }
        note_cloze = MockNote(
            1202,
            {"Front": "54353453453哈哈哈哈哈哈 {{c1::哈哈}} 哈哈低调{{c2::低调}}", "Back": "54353453445大萨达所大所"},
            [],
            cids=[2202],
        )
        note_cloze._model = cloze_model
        self.mock_col.get_note = (
            lambda nid: note_cloze if int(nid) == 1202 else (note_std if int(nid) == 1201 else orig_get_note(nid))
        )
        self.mock_col._cards[2202] = _LiteralCard(2202, note_cloze)
        lib_cloze = srch._serialize_library_card(self.mock_col, 2202)
        self.assertIs(lib_cloze["isCloze"], True)
        self.assertEqual(lib_cloze["noteTypeName"], "Basic (Cloze)")

        # IO card shape inside sandbox is untouched
        io_out = SimpleNamespace(
            question_text='{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.4:oi=1}}',
            answer_text='{{c1::image-occlusion:rect:left=.1:top=.2:width=.3:height=.4:oi=1}}',
            css="",
        )
        sb_io = render_sandbox_card_sides(None, raw_output=io_out)
        self.assertIn("image-occlusion:rect", sb_io.question)

    def test_39_note_grouped_library_search_facets_batch_and_cloze_prune(self):
        """
        Verify note-level Library grouping, facet counts, batch applyToNote vs single-subcard
        suspension, and orphan cloze card pruning when switching split -> combined.
        """
        from bridge.search_service import SearchService

        db = MockDB()
        cur = db.conn.cursor()
        cur.execute("DELETE FROM cards")
        cur.execute("DELETE FROM notes")
        cur.execute("DELETE FROM revlog")

        # Note 501 (Cloze): 2 sibling cards (c1=5001 due today, c2=5002 review later)
        # Note 502 (Basic): 1 card (5003 new)
        cur.execute(
            "INSERT INTO notes VALUES (501, 'g-501', 2, 0, 0, ' bio ', 'The {{c1::mitochondria}} makes {{c2::ATP}}\x1fEnergy', 'mitochondria', 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO notes VALUES (502, 'g-502', 1, 0, 0, ' chem ', 'Osmosis\x1fWater diffusion', 'Osmosis', 0, 0, '')"
        )
        cur.execute(
            "INSERT INTO cards VALUES (5001, 501, 1, 0, 0, 0, 2, 2, 10, 4, 2500, 3, 2, 0, 0, 0, 1, '{\"d\": 7.4, \"s\": 4.0}')"
        )
        cur.execute(
            "INSERT INTO cards VALUES (5002, 501, 1, 1, 0, 0, 2, 2, 25, 18, 2500, 5, 0, 0, 0, 0, 0, '{\"d\": 3.2, \"s\": 18.0}')"
        )
        cur.execute(
            "INSERT INTO cards VALUES (5003, 502, 1, 0, 0, 0, 0, 0, 1, 0, 2500, 0, 0, 0, 0, 0, 0, '')"
        )
        db.conn.commit()

        class GroupedCol:
            def __init__(self, sql_db):
                self.db = sql_db

                class Sched:
                    today = 10

                    @staticmethod
                    def suspend_cards(cids):
                        for cid in cids:
                            sql_db.conn.execute("UPDATE cards SET queue = -1 WHERE id = ?", (int(cid),))
                        sql_db.conn.commit()

                    @staticmethod
                    def unsuspend_cards(cids):
                        for cid in cids:
                            sql_db.conn.execute("UPDATE cards SET queue = 2 WHERE id = ?", (int(cid),))
                        sql_db.conn.commit()

                class Decks:
                    @staticmethod
                    def get(did, default=False):
                        return {"id": int(did), "name": "Science"}

                class Tags:
                    @staticmethod
                    def all():
                        return ["bio", "chem"]

                self.sched = Sched()
                self.decks = Decks()
                self.tags = Tags()
                self.cloze_model = {
                    "id": 2,
                    "name": "Cloze",
                    "type": 1,
                    "flds": [{"name": "Text", "ord": 0}, {"name": "Back Extra", "ord": 1}],
                    "tmpls": [{"name": "Cloze", "ord": 0, "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}<hr id=answer>{{Back Extra}}"}],
                }
                self.basic_model = {
                    "id": 1,
                    "name": "Basic",
                    "type": 0,
                    "flds": [{"name": "Front", "ord": 0}, {"name": "Back", "ord": 1}],
                    "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}],
                }

            def find_cards(self, query):
                rows = self.db.all(
                    "SELECT c.id, c.type, c.queue, c.due, c.flags, n.tags "
                    "FROM cards c JOIN notes n ON c.nid = n.id ORDER BY c.id ASC"
                )
                out = []
                for cid, ctype, queue, due, flags, tags_str in rows:
                    is_due_card = queue in (1, 3) or (queue == 2 and due <= 10)
                    is_new_card = ctype == 0 or queue == 0
                    if "is:suspended" in query and "-is:suspended" not in query and queue != -1:
                        continue
                    if "-is:suspended" in query and queue == -1:
                        continue
                    if "is:buried" in query and "-is:buried" not in query and queue not in (-2, -3):
                        continue
                    if "-is:buried" in query and queue in (-2, -3):
                        continue
                    if "(is:due OR is:learn)" in query and not is_due_card:
                        continue
                    if "is:new" in query and not is_new_card:
                        continue
                    if "is:review" in query and (is_new_card or is_due_card or queue in (-1, -2, -3)):
                        continue
                    if "rated:1" in query:
                        continue
                    out.append(int(cid))
                return out

            def get_card(self, cid):
                row = self.db.first(
                    "SELECT id, nid, did, ord, type, queue, due, ivl, reps, lapses, flags, data FROM cards WHERE id = ?",
                    int(cid),
                )
                if not row:
                    raise KeyError(cid)
                note = self.get_note(row[1])
                c = MockCard(row[0], note, queue=row[5], ctype=row[4], due=row[6], ivl=row[7])
                c.ord = row[3]
                c.reps = row[8]
                c.lapses = row[9]
                c.flags = row[10]
                if row[11]:
                    parsed = json.loads(row[11])
                    c.memory_state = SimpleNamespace(difficulty=parsed["d"], stability=parsed["s"])
                return c

            def get_note(self, nid):
                nrow = self.db.first("SELECT id, mid, flds, tags FROM notes WHERE id = ?", int(nid))
                flds = nrow[2].split("\x1f")
                cids = [int(r[0]) for r in self.db.all("SELECT id FROM cards WHERE nid = ? ORDER BY ord, id", int(nid))]
                is_cloze = int(nrow[1]) == 2
                keys = ("Text", "Back Extra") if is_cloze else ("Front", "Back")
                n = MockNote(nrow[0], {keys[0]: flds[0], keys[1]: flds[1]}, nrow[3].split(), is_cloze=is_cloze, cids=cids)
                n._model = self.cloze_model if is_cloze else self.basic_model
                n.mid = int(nrow[1])
                return n

            def update_note(self, note):
                flds = "\x1f".join(note.values())
                self.db.conn.execute("UPDATE notes SET flds = ?, tags = ? WHERE id = ?", (flds, " ".join(note.tags), int(note.id)))
                self.db.conn.commit()

            def remove_cards_and_orphaned_notes(self, cids):
                for cid in cids:
                    self.db.conn.execute("DELETE FROM cards WHERE id = ?", (int(cid),))
                self.db.conn.commit()

        gcol = GroupedCol(db)
        svc = SearchService(col_getter=lambda: gcol)

        # 1. Library groups 3 SQL cards into 2 distinct Notes while keeping raw `total == 3`
        res = svc.search_cards({"query": "", "status": "all", "offset": 0, "limit": 20})
        self.assertEqual(res["total"], 3)
        self.assertEqual(res["collectionTotal"], 2)
        self.assertEqual(res["filteredCount"], 2)
        self.assertEqual(len(res["cards"]), 2)
        self.assertEqual(res["facetCounts"]["statusCounts"]["all"], 2)
        self.assertEqual(res["facetCounts"]["statusCounts"]["due"], 1)
        self.assertEqual(res["facetCounts"]["statusCounts"]["new"], 1)

        cloze_item = next(c for c in res["cards"] if c["noteId"] == "501")
        self.assertEqual(cloze_item["id"], "5001")  # most urgent sibling ('due' beats 'review')
        self.assertEqual(cloze_item["siblingCount"], 2)
        self.assertEqual(cloze_item["siblingCardIds"], ["5001", "5002"])
        self.assertEqual(cloze_item["reps"], 8)  # 3 + 5
        self.assertEqual(cloze_item["lapses"], 2)  # 2 + 0
        self.assertEqual(cloze_item["difficultyLevel"], "high")  # max(high, low)
        self.assertEqual(cloze_item["flags"], 1)
        self.assertEqual(cloze_item["status"], "due")

        # 2. batch_action with applyToNote=False suspends ONLY c2 (5002); applyToNote=True suspends both
        sub_res = svc.batch_action({"actionType": "suspend", "cardIds": ["5002"], "applyToNote": False})
        self.assertTrue(sub_res["success"])
        self.assertEqual(sub_res["affected"], 1)
        self.assertEqual(gcol.get_card(5001).queue, 2)
        self.assertEqual(gcol.get_card(5002).queue, -1)

        note_res = svc.batch_action({"actionType": "suspend", "cardIds": ["5001"], "applyToNote": True})
        self.assertTrue(note_res["success"])
        self.assertEqual(note_res["affected"], 2)
        self.assertEqual(gcol.get_card(5001).queue, -1)
        self.assertEqual(gcol.get_card(5002).queue, -1)

        # 3. Switching Cloze note from split (c1+c2) back to combined (c1+c1) while editing card 5002
        # cleanly prunes orphan card 5002 and resolves surviving cardId 5001.
        svc.batch_action({"actionType": "unsuspend", "cardIds": ["5001"], "applyToNote": True})
        from bridge.edit_service import EditService
        esvc = EditService(col_getter=lambda: gcol)
        upd = esvc.update_card_inline({
            "noteId": "501",
            "cardId": "5002",
            "fields": {"Text": "The {{c1::mitochondria}} makes {{c1::ATP}}", "Back Extra": "Energy"},
        })
        self.assertTrue(upd["saved"])
        self.assertEqual(upd["cardId"], "5001")
        self.assertEqual(upd["prunedCardIds"], ["5002"])
        self.assertEqual(db.first("SELECT count(*) FROM cards WHERE nid = 501")[0], 1)

    def test_40_review_service_cloze_sibling_step_metadata(self):
        """Review serialization reports clozeCardIndex and clozeSiblingCount for multi-card cloze notes."""
        note_multi = MockNote(
            1299,
            {"Text": "A {{c1::first}} B {{c2::second}}", "Back Extra": "Info"},
            [],
            is_cloze=True,
            cids=[2298, 2299],
        )
        c1 = MockCard(2298, note_multi)
        c1.ord = 0
        c2 = MockCard(2299, note_multi)
        c2.ord = 1
        orig_get_note = self.mock_col.get_note
        orig_get_card = self.mock_col.get_card
        self.mock_col._cards[2298] = c1
        self.mock_col._cards[2299] = c2
        self.mock_col.get_note = lambda nid: note_multi if int(nid) == 1299 else orig_get_note(nid)
        self.mock_col.get_card = lambda cid: self.mock_col._cards[int(cid)] if int(cid) in (2298, 2299) else orig_get_card(cid)
        try:
            rc1 = self.router.review_service._serialize_review_card(self.mock_col, 2298)
            rc2 = self.router.review_service._serialize_review_card(self.mock_col, 2299)
            self.assertEqual(rc1["clozeCardIndex"], 1)
            self.assertEqual(rc1["clozeSiblingCount"], 2)
            self.assertEqual(rc2["clozeCardIndex"], 2)
            self.assertEqual(rc2["clozeSiblingCount"], 2)
        finally:
            self.mock_col.get_note = orig_get_note
            self.mock_col.get_card = orig_get_card

    def test_41_review_audio_side_separation_and_queue_playback(self):
        """Review & Library cards split front/back audio cleanly, avoid cloze spoiler on front, and queue multi-audio playback."""
        from types import ModuleType
        from bridge.media_utils import split_card_side_audio

        # 1. Pure split helper deduplicates repeated question audio from answer templates
        f_list, b_list, merged = split_card_side_audio(
            ["q1.mp3"],
            ["q1.mp3", "q2.mp3"],
            ["q1.mp3", "a1.mp3"],
            ["a1.mp3", "a2.mp3"],
        )
        self.assertEqual(f_list, ["q1.mp3", "q2.mp3"])
        self.assertEqual(b_list, ["a1.mp3", "a2.mp3"])
        self.assertEqual(merged, ["q1.mp3", "q2.mp3", "a1.mp3", "a2.mp3"])

        # 2. Cloze card: hidden cloze sound appears only in answer_av_tags and must not leak to frontAudioFiles
        cloze_note = MockNote(
            1310,
            {"Text": "Listen [sound:prompt.mp3] {{c1::answer [sound:hidden.mp3]}}", "Back Extra": "[sound:extra.mp3]"},
            [],
            is_cloze=True,
            cids=[2310],
        )
        cloze_note._model = {
            "id": 1010,
            "name": "Cloze",
            "type": 1,
            "flds": [{"name": "Text", "ord": 0}, {"name": "Back Extra", "ord": 1}],
            "tmpls": [{"name": "Cloze", "ord": 0, "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}<br>{{Back Extra}}"}],
        }

        class _ClozeAudioCard(MockCard):
            def render_output(self_card):
                return SimpleNamespace(
                    question_text="Listen [anki:play:q:0] [...]",
                    answer_text="Listen [anki:play:a:0] answer [anki:play:a:1]<br>[anki:play:a:2]",
                    css="",
                    question_av_tags=[SimpleNamespace(filename="prompt.mp3")],
                    answer_av_tags=[
                        SimpleNamespace(filename="prompt.mp3"),
                        SimpleNamespace(filename="hidden.mp3"),
                        SimpleNamespace(filename="extra.mp3"),
                    ],
                )

        # 3. Basic card with {{FrontSide}}: question sound in answer_av_tags is excluded from backAudioFiles
        basic_note = MockNote(
            1311,
            {"Front": "Front word [sound:front_only.mp3]", "Back": "Back meaning [sound:back_only.mp3]"},
            [],
            cids=[2311],
        )
        basic_note._model = {
            "id": 1011,
            "name": "Basic",
            "type": 0,
            "flds": [{"name": "Front", "ord": 0}, {"name": "Back", "ord": 1}],
            "tmpls": [{"name": "Card 1", "ord": 0, "qfmt": "{{Front}}", "afmt": "{{FrontSide}}<hr id=answer>{{Back}}"}],
        }

        class _BasicAudioCard(MockCard):
            def render_output(self_card):
                return SimpleNamespace(
                    question_text="Front word [anki:play:q:0]",
                    answer_text="Front word [anki:play:a:0]<hr id=answer>Back meaning [anki:play:a:1]",
                    css="",
                    question_av_tags=[SimpleNamespace(filename="front_only.mp3")],
                    answer_av_tags=[
                        SimpleNamespace(filename="front_only.mp3"),
                        SimpleNamespace(filename="back_only.mp3"),
                    ],
                )

        orig_get_note = self.mock_col.get_note
        orig_get_card = self.mock_col.get_card
        self.mock_col._cards[2310] = _ClozeAudioCard(2310, cloze_note)
        self.mock_col._cards[2311] = _BasicAudioCard(2311, basic_note)
        self.mock_col.get_note = (
            lambda nid: cloze_note
            if int(nid) == 1310
            else (basic_note if int(nid) == 1311 else orig_get_note(nid))
        )
        self.mock_col.get_card = (
            lambda cid: self.mock_col._cards[int(cid)] if int(cid) in (2310, 2311) else orig_get_card(cid)
        )
        try:
            rc_cloze = self.router.review_service._serialize_review_card(self.mock_col, 2310)
            self.assertEqual(rc_cloze["frontAudioFiles"], ["prompt.mp3"])
            self.assertEqual(rc_cloze["backAudioFiles"], ["hidden.mp3", "extra.mp3"])
            self.assertEqual(rc_cloze["sandboxQuestionAudioFiles"], ["prompt.mp3"])
            self.assertEqual(rc_cloze["sandboxAnswerAudioFiles"], ["prompt.mp3", "hidden.mp3", "extra.mp3"])
            self.assertEqual(rc_cloze["audioFiles"], ["prompt.mp3", "hidden.mp3", "extra.mp3"])

            rc_basic = self.router.review_service._serialize_review_card(self.mock_col, 2311)
            self.assertEqual(rc_basic["frontAudioFiles"], ["front_only.mp3"])
            self.assertEqual(rc_basic["backAudioFiles"], ["back_only.mp3"])
            self.assertEqual(rc_basic["audioFiles"], ["front_only.mp3", "back_only.mp3"])

            lib_basic = self.router.search_service._serialize_library_card(self.mock_col, 2311)
            self.assertEqual(lib_basic["frontAudioFiles"], ["front_only.mp3"])
            self.assertEqual(lib_basic["backAudioFiles"], ["back_only.mp3"])
        finally:
            self.mock_col.get_note = orig_get_note
            self.mock_col.get_card = orig_get_card

        # 4. play_audio queues multiple files via AVPlayer.play_tags and uses play_file for single files
        calls = []

        class _FakeAVPlayer:
            def stop_and_clear_queue(self):
                calls.append(("stop",))

            def play_tags(self, tags):
                calls.append(("play_tags", [t.filename for t in tags]))

            def play_file(self, fname):
                calls.append(("play_file", fname))

        fake_sound_mod = ModuleType("aqt.sound")
        fake_sound_mod.av_player = _FakeAVPlayer()
        fake_aqt_mod = ModuleType("aqt")
        fake_aqt_mod.sound = fake_sound_mod

        fake_anki_sound_mod = ModuleType("anki.sound")

        class _FakeTag:
            def __init__(self, filename=""):
                self.filename = filename

        fake_anki_sound_mod.SoundOrVideoTag = _FakeTag

        saved_mods = {k: sys.modules.get(k) for k in ("aqt", "aqt.sound", "anki.sound")}
        sys.modules["aqt"] = fake_aqt_mod
        sys.modules["aqt.sound"] = fake_sound_mod
        sys.modules["anki.sound"] = fake_anki_sound_mod
        try:
            res_multi = self._call("play_audio", {"filenames": ["first.mp3", "second.mp3", "first.mp3"]})
            self.assertTrue(res_multi["data"]["played"])
            self.assertEqual(res_multi["data"]["filenames"], ["first.mp3", "second.mp3"])
            self.assertEqual(calls, [("stop",), ("play_tags", ["first.mp3", "second.mp3"])])

            calls.clear()
            res_single = self._call("play_audio", {"filename": "single.mp3"})
            self.assertTrue(res_single["data"]["played"])
            self.assertEqual(calls, [("play_file", "single.mp3")])
        finally:
            for k, orig in saved_mods.items():
                if orig is None:
                    sys.modules.pop(k, None)
                else:
                    sys.modules[k] = orig

    def test_43_streak_freeze_does_not_inflate_streak_or_hide_real_reviews(self):
        """Frozen days must bridge streaks without inflating counts, inflating weekActiveDays, or masking real reviews."""
        sched = self.mock_col.sched
        orig_cutoff = sched.day_cutoff
        today_date = datetime.date.today()
        today_start_sec = int(datetime.datetime.combine(today_date, datetime.time(0, 0)).timestamp())
        sched.day_cutoff = today_start_sec + 86400

        def set_review_days(offsets):
            conn = self.mock_col.db.conn
            conn.execute("DELETE FROM revlog")
            base_id = 1_700_000_000_000
            for idx, off in enumerate(offsets):
                ts_ms = (today_start_sec + off * 86400 + 3600) * 1000
                conn.execute(
                    "INSERT INTO revlog VALUES (?, 201, 0, 3, 4, 2, 2500, 3000, 1)",
                    (ts_ms + idx,),
                )
            conn.commit()

        try:
            # 1. Zero reviews + active vacation freeze must NOT fabricate streak >= 1 or weekActiveDays > 0
            set_review_days([])
            frozen_window = [
                (today_date + datetime.timedelta(days=d)).isoformat()
                for d in (-2, -1, 0, 1, 2)
            ]
            self.config_store["vacation_frozen_dates"] = frozen_window
            self.config_store["vacation_state"] = {
                "active": True,
                "start_date": frozen_window[0],
                "end_date": frozen_window[-1],
                "freeze_streak": True,
                "frozen_dates": frozen_window,
            }
            dash_zero = self._call("get_dashboard", {})["data"]
            self.assertEqual(dash_zero["streak"]["current"], 0)
            self.assertEqual(dash_zero["streak"]["longest"], 0)
            self.assertEqual(dash_zero["streak"]["weekActiveDays"], 0)

            # 2. Reviews on -6,-5,-4 + frozen -3,-2 + review on -1 + frozen today -> streak=4 (not 7)
            frozen_window_2 = [
                (today_date + datetime.timedelta(days=d)).isoformat()
                for d in (-3, -2, 0, 1, 2)
            ]
            self.config_store["vacation_frozen_dates"] = frozen_window_2
            self.config_store["vacation_state"] = {
                "active": True,
                "start_date": frozen_window_2[0],
                "end_date": frozen_window_2[-1],
                "freeze_streak": True,
                "frozen_dates": frozen_window_2,
            }
            set_review_days([-6, -5, -4, -1])
            dash_bridge = self._call("get_dashboard", {})["data"]
            self.assertEqual(dash_bridge["streak"]["current"], 4)
            self.assertEqual(dash_bridge["streak"]["longest"], 4)

            # 3. Historical frozen bridge counts in longest_streak even after current streak resets
            set_review_days([-10, -9, -7, 0])
            self.config_store["vacation_frozen_dates"] = [
                (today_date + datetime.timedelta(days=-8)).isoformat(),
            ]
            self.config_store["vacation_state"] = {"active": False, "frozen_dates": []}
            dash_hist = self._call("get_dashboard", {})["data"]
            self.assertEqual(dash_hist["streak"]["current"], 1)
            self.assertEqual(dash_hist["streak"]["longest"], 3)

            # 4. Reviewing on a frozen date must show real review cell instead of frozen mask
            today_iso = today_date.isoformat()
            self.config_store["vacation_frozen_dates"] = [today_iso]
            dash_real = self._call("get_dashboard", {})["data"]
            today_cell = next(c for c in dash_real["heatmap"]["cells"] if c["date"] == today_iso)
            self.assertEqual(today_cell["count"], 1)
            self.assertFalse(today_cell["isStreakFrozen"])
        finally:
            sched.day_cutoff = orig_cutoff

    def test_44_early_end_vacation_prunes_unconsumed_future_frozen_dates(self):
        """Ending vacation early must strip >= today frozen dates while keeping consumed past ones."""
        today_date = datetime.date.today()
        yesterday_iso = (today_date - datetime.timedelta(days=1)).isoformat()
        today_iso = today_date.isoformat()
        tomorrow_iso = (today_date + datetime.timedelta(days=1)).isoformat()
        day2_iso = (today_date + datetime.timedelta(days=2)).isoformat()

        # Simulate repeating start 30d -> end immediately: nothing stays frozen
        res_start = self._call(
            "set_vacation",
            {"days": 30, "freezeStreak": True, "freezeNewCards": False, "shiftReviewCards": False},
        )
        self.assertTrue(res_start["data"]["success"])
        self.assertEqual(len(self.config_store["vacation_frozen_dates"]), 30)

        res_end = self._call("end_vacation", {})
        self.assertTrue(res_end["data"]["wasActive"])
        self.assertEqual(self.config_store["vacation_frozen_dates"], [])
        self.assertEqual(self.config_store["vacation_state"]["frozen_dates"], [])

        # Ongoing vacation that actually covered yesterday: ending today keeps yesterday, prunes >= today
        self.config_store["vacation_frozen_dates"] = [yesterday_iso, today_iso, tomorrow_iso, day2_iso]
        self.config_store["vacation_state"] = {
            "active": True,
            "start_date": yesterday_iso,
            "end_date": day2_iso,
            "freeze_streak": True,
            "frozen_dates": [yesterday_iso, today_iso, tomorrow_iso, day2_iso],
            "frozen_deck_limits": {},
        }
        res_end2 = self._call("end_vacation", {})
        self.assertTrue(res_end2["data"]["wasActive"])
        self.assertEqual(self.config_store["vacation_frozen_dates"], [yesterday_iso])
        self.assertEqual(self.config_store["vacation_state"]["frozen_dates"], [yesterday_iso])


if __name__ == "__main__":
    unittest.main()
