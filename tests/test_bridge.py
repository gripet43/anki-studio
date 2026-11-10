# -*- coding: utf-8 -*-
"""
Anki Modern OS — Comprehensive Unit & Integration Test Suite
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
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
import sys

ADDON_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ADDON_ROOT.parent))

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
    def __init__(self, nid, fields_map, tags, is_cloze=False, cids=None):
        self.id = nid
        self._fields = dict(fields_map)
        self.tags = list(tags)
        self._is_cloze = is_cloze
        self._cids = cids or [201]

    def note_type(self):
        return {
            "id": 2 if self._is_cloze else 1,
            "name": "Cloze" if self._is_cloze else "Basic",
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
        if model.get("type") == 1:
            return MockNote(106, {"Text": "", "Back Extra": ""}, [], is_cloze=True)
        return MockNote(103, {"正面": "", "释义": ""}, [])

    def add_note(self, note, did):
        self._note_101 = note

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
            },
        )
        self.assertEqual(prefs_res["status"], "success")
        self.assertEqual(prefs_res["data"]["preferences"]["language"], "en")
        self.assertEqual(prefs_res["data"]["preferences"]["customNickname"], "Dr. Lee")
        self.assertTrue(prefs_res["data"]["preferences"]["showShortcutHints"])

        get_prefs = self._call("get_preferences", {})
        self.assertEqual(get_prefs["status"], "success")
        self.assertTrue(get_prefs["data"]["showShortcutHints"])

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
        res_text = self._call("copy_to_clipboard", {"text": "Hello Anki Modern OS"})
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


if __name__ == "__main__":
    unittest.main()
