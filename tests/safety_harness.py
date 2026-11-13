# -*- coding: utf-8 -*-
"""
Anki Studio - Card Safety Test Harness (Round 1)

A fully isolated synthetic Anki collection plus a field-level snapshot / diff
engine. The collection lives in an in-memory SQLite database built by this
module: this harness NEVER opens, copies or even resolves the user's real
collection.anki2.

Why business columns only: Anki legitimately rewrites cards.mod / cards.usn
(sync timestamps) on every write. Comparing them would produce false failures.
We compare every scheduling/content column instead, and separately assert that
revlog history is append-only from the add-on's point of view.
"""
from __future__ import annotations

import hashlib
import json
import random
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from _addon_bootstrap import ADDON_ROOT, ensure_importable  # noqa: E402

ensure_importable()

from anki_modern_os.bridge.router import BridgeRouter  # noqa: E402

CARD_BUSINESS_COLUMNS = (
    "id", "nid", "did", "ord", "type", "queue", "due", "ivl", "factor",
    "reps", "lapses", "left", "odue", "odid", "flags", "data",
)
NOTE_BUSINESS_COLUMNS = (
    "id", "guid", "mid", "tags", "flds", "sfld", "csum", "flags", "data",
)

SCHEMA = """
CREATE TABLE cards (
  id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER,
  mod INTEGER, usn INTEGER, type INTEGER, queue INTEGER, due INTEGER,
  ivl INTEGER, factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER,
  odue INTEGER, odid INTEGER, flags INTEGER, data TEXT
);
CREATE TABLE notes (
  id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER, usn INTEGER,
  tags TEXT, flds TEXT, sfld TEXT, csum INTEGER, flags INTEGER, data TEXT
);
CREATE TABLE revlog (
  id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER, ivl INTEGER,
  lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER
);
CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, mod INTEGER, scm INTEGER, ver INTEGER);
"""

SAMPLE_FIELDS = (
    "快速排序的平均时间复杂度\x1f分治；<b>O(n log n)</b>",
    "《行测》言语理解 · 主旨概括\x1f抓关联词与转折后重点",
    "Photosynthesis\x1fConversion of light energy to chemical energy",
    "宪法 第 33 条\x1f公民在法律面前一律平等",
    "FSRS stability\x1fTime until recall probability drops to 90%",
)


class SyntheticDB:
    """Minimal Anki-style db wrapper (first / all / execute)."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def first(self, sql: str, *args: Any):
        return self.conn.execute(sql, args).fetchone()

    def all(self, sql: str, *args: Any):
        return self.conn.execute(sql, args).fetchall()

    def execute(self, sql: str, *args: Any):
        self.conn.execute(sql, args)
        self.conn.commit()


class FakeCard:
    _COLUMNS = (
        "id", "nid", "did", "ord", "mod", "usn", "type", "queue", "due",
        "ivl", "factor", "reps", "lapses", "left", "odue", "odid", "flags", "data",
    )

    def __init__(self, row: Sequence[Any], owner: "SyntheticCollection"):
        for key, value in zip(self._COLUMNS, row):
            setattr(self, key, value)
        self._owner = owner

    def note(self):
        return self._owner.get_note(self.nid)


class FakeNote:
    def __init__(self, row: Sequence[Any]):
        self.id = row[0]
        self.guid = row[1]
        self.mid = row[2]
        self.tags = [t for t in str(row[5] or "").split(" ") if t]
        self.fields = str(row[6] or "").split("\x1f")
        self.sfld = row[7]

    def keys(self):
        return [f"Field{i}" for i in range(len(self.fields))]

    def values(self):
        return list(self.fields)

    def items(self):
        return list(zip(self.keys(), self.fields))

    def __contains__(self, key):
        return key in self.keys()

    def __getitem__(self, key):
        return self.fields[self.keys().index(key)]

    def __setitem__(self, key, value):
        self.fields[self.keys().index(key)] = value

    def add_tag(self, tag):
        if tag not in self.tags:
            self.tags.append(tag)


class FakeDecks:
    def __init__(self, owner: "SyntheticCollection"):
        self._owner = owner
        self.configs = [
            {"id": 1, "name": "Default", "new": {"perDay": 20}},
            {"id": 2, "name": "行测", "new": {"perDay": 15}},
            {"id": 3, "name": "专业课::算法", "new": {"perDay": 10}},
        ]

    def all_config(self):
        return self.configs

    def save(self, conf):
        return None

    def get(self, did, default=False):
        row = self._owner.conn.execute("SELECT id, name FROM decks WHERE id = ?", (int(did),)).fetchone()
        return {"id": row[0], "name": row[1]} if row else (default or {"id": did, "name": "Default"})

    def name(self, did):
        obj = self.get(did, default=False)
        return obj.get("name") if isinstance(obj, dict) else "Default"

    def children(self, did):
        return []

    def select(self, did):
        return None

    def rename(self, did, name):
        self._owner.conn.execute("UPDATE decks SET name = ? WHERE id = ?", (name, int(did)))

    def remove(self, dids):
        return None

    def add_normal_deck_with_name(self, name):
        class Out:
            id = 999
        return Out()


class FakeTags:
    def __init__(self, owner: "SyntheticCollection"):
        self._owner = owner

    def all(self):
        tags = set()
        for (raw,) in self._owner.conn.execute("SELECT tags FROM notes"):
            tags.update(t for t in str(raw or "").split(" ") if t)
        return sorted(tags)


class FakeModels:
    @staticmethod
    def all():
        return [{"id": 1, "name": "Basic", "type": 0,
                 "flds": [{"name": "Front"}, {"name": "Back"}]}]

    @staticmethod
    def current():
        return {"id": 1, "name": "Basic", "type": 0,
                "flds": [{"name": "Front"}, {"name": "Back"}]}


class FakeMedia:
    @staticmethod
    def dir():
        return ""

    @staticmethod
    def write_data(name, data):
        return name


class FakeSched:
    """Faithful-enough Set Due Date semantics, including Anki's type=4 revlog."""

    def __init__(self, owner: "SyntheticCollection"):
        self._owner = owner
        self.today = 400
        self.day_cutoff = int(time.time()) + 3600

    def _log_manual_reschedule(self, cid: int):
        owner = self._owner
        owner._revlog_seq += 1
        owner.conn.execute(
            "INSERT INTO revlog VALUES (?, ?, 0, 0, 0, 0, 0, 0, 4)",
            (owner._revlog_base + owner._revlog_seq, cid),
        )
        owner.conn.commit()

    def set_due_date(self, cids, expr: str):
        expr = str(expr)
        # A trailing "!" rewrites intervals; our code must never emit it.
        if expr.endswith("!"):
            raise AssertionError(f"interval-rewriting set_due_date('{expr}') is forbidden")
        if "-" in expr:
            lo, hi = (int(x) for x in expr.split("-", 1))
            span = max(1, hi - lo + 1)
            offsets = [(lo + (i % span)) for i in range(len(cids))]
        else:
            offsets = [int(expr)] * len(cids)
        for cid, off in zip(cids, offsets):
            self._owner.conn.execute(
                "UPDATE cards SET due = ?, mod = mod + 1 WHERE id = ?",
                (self.today + off, int(cid)),
            )
            self._log_manual_reschedule(int(cid))
        self._owner.conn.commit()

    def suspend_cards(self, cids):
        for cid in cids:
            self._owner.conn.execute("UPDATE cards SET queue = -1 WHERE id = ?", (int(cid),))
        self._owner.conn.commit()

    def unsuspend_cards(self, cids):
        for cid in cids:
            self._owner.conn.execute(
                "UPDATE cards SET queue = CASE WHEN type = 0 THEN 0 ELSE 2 END WHERE id = ?",
                (int(cid),),
            )
        self._owner.conn.commit()

    def bury_cards(self, cids, manual=True):
        for cid in cids:
            self._owner.conn.execute("UPDATE cards SET queue = -2 WHERE id = ?", (int(cid),))
        self._owner.conn.commit()

    def unbury_cards(self, cids):
        self.unsuspend_cards(cids)

    def reset(self):
        return None


class _PM:
    name = "Safety Test Profile"

    @staticmethod
    def backupFolder():
        return "/tmp/anki_studio_safety_backups"


class FakeMW:
    def __init__(self):
        self.pm = _PM()
        self.reset_count = 0

    def reset(self):
        self.reset_count += 1


class SyntheticCollection:
    """A deterministic, real-SQLite, in-memory Anki-like collection."""

    def __init__(self, seed: int = 0, n_cards: int = 60, db_path: Optional[str] = None):
        # db_path is only ever a tempdir path supplied by a crash-consistency
        # test. The default (and all other tests) stays strictly in memory.
        self.conn = sqlite3.connect(db_path or ":memory:")
        self.conn.executescript(SCHEMA)
        self.rng = random.Random(seed)
        self._revlog_base = 1_700_000_000_000
        self._revlog_seq = 0
        self.crt = int(time.time()) - 500 * 86400

        for did, name in ((1, "Default"), (2, "行测"), (3, "专业课::算法")):
            self.conn.execute("INSERT INTO decks VALUES (?, ?)", (did, name))
        self.conn.execute("INSERT INTO col VALUES (1, ?, ?, ?, 11)", (self.crt, self.crt, self.crt))

        base_ms = int(time.time() * 1000) - 90 * 86400 * 1000
        for i in range(n_cards):
            nid, cid = 1000 + i, 2000 + i
            did = self.rng.choice((1, 2, 3))
            fields = self.rng.choice(SAMPLE_FIELDS)
            tags = self.rng.choice(("", " 高频 ", " 错题 易忘 ", " 算法 "))
            self.conn.execute(
                "INSERT INTO notes VALUES (?, ?, 1, 0, 0, ?, ?, ?, 0, 0, '')",
                (nid, f"guid-{seed}-{i}", tags, fields, fields.split("\x1f")[0]),
            )
            roll = self.rng.random()
            if roll < 0.68:  # review
                ctype, queue, ivl = 2, 2, self.rng.randint(1, 240)
                due = 400 + self.rng.randint(-40, 25)
            elif roll < 0.84:  # new
                ctype, queue, ivl, due = 0, 0, 0, i
            elif roll < 0.94:  # learning
                ctype, queue, ivl, due = 1, 1, 0, int(time.time()) + i
            else:  # suspended
                ctype, queue, ivl = 2, -1, self.rng.randint(1, 120)
                due = 400 + self.rng.randint(-10, 20)
            self.conn.execute(
                "INSERT INTO cards VALUES (?, ?, ?, 0, 0, 0, ?, ?, ?, ?, 2500, ?, 0, 0, 0, 0, 0, '')",
                (cid, nid, did, ctype, queue, due, ivl, self.rng.randint(0, 12)),
            )
            for k in range(self.rng.randint(0, 3)):
                self._revlog_seq += 1
                self.conn.execute(
                    "INSERT INTO revlog VALUES (?, ?, 0, ?, ?, ?, 2500, ?, ?)",
                    (self._revlog_base - (90 * 86400 * 1000) + i * 1000 + k,
                     cid, self.rng.randint(1, 4), ivl, max(1, ivl // 2),
                     self.rng.randint(500, 9000), self.rng.randint(0, 3)),
                )
        self.conn.commit()

        self.undo_entries: List[str] = []
        self.merged_undo_targets: List[int] = []
        self.backup_calls: List[Dict[str, Any]] = []

        self.db = SyntheticDB(self.conn)
        self.sched = FakeSched(self)
        self.decks = FakeDecks(self)
        self.tags = FakeTags(self)
        self.models = FakeModels()
        self.media = FakeMedia()

    @classmethod
    def from_file(cls, path: str) -> "SyntheticCollection":
        """Re-attach to an existing file database after a simulated crash.
        Never regenerates data: the point is to observe the surviving state."""
        obj = cls.__new__(cls)
        obj.conn = sqlite3.connect(path)
        obj.rng = random.Random(0)
        obj._revlog_base = 1_700_000_000_000
        obj._revlog_seq = 0
        obj.crt = int(time.time()) - 500 * 86400
        obj.undo_entries = []
        obj.merged_undo_targets = []
        obj.backup_calls = []
        obj.db = SyntheticDB(obj.conn)
        obj.sched = FakeSched(obj)
        obj.decks = FakeDecks(obj)
        obj.tags = FakeTags(obj)
        obj.models = FakeModels()
        obj.media = FakeMedia()
        return obj

    # -- collection API used by the services ---------------------------------
    def find_cards(self, query: str) -> List[int]:
        q = str(query or "")
        clauses: List[str] = []
        for token in q.replace('"', "").split():
            if token.startswith("-"):
                neg, body = True, token[1:]
            else:
                neg, body = False, token
            if body == "is:due":
                c = "due <= 400 AND queue >= 0"
            elif body == "is:review":
                c = "queue = 2 AND type = 2"
            elif body == "is:new":
                c = "queue = 0 AND type = 0"
            elif body == "is:suspended":
                c = "queue = -1"
            elif body == "is:buried":
                c = "queue IN (-2, -3)"
            elif body.startswith("deck:"):
                name = body.split(":", 1)[1]
                c = f"did IN (SELECT id FROM decks WHERE name = '{name}')"
            elif body.startswith("prop:due") or body.startswith("rated:") or body.startswith("tag:"):
                continue
            else:
                continue
            clauses.append(f"NOT ({c})" if neg else f"({c})")
        sql = "SELECT id FROM cards" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY id"
        return [r[0] for r in self.conn.execute(sql)]

    def get_card(self, cid):
        row = self.conn.execute("SELECT * FROM cards WHERE id = ?", (int(cid),)).fetchone()
        return FakeCard(row, self) if row else None

    def get_note(self, nid):
        row = self.conn.execute("SELECT * FROM notes WHERE id = ?", (int(nid),)).fetchone()
        return FakeNote(row) if row else None

    def update_card(self, card):
        self.conn.execute(
            "UPDATE cards SET due = ?, ivl = ?, queue = ?, type = ?, did = ?, mod = mod + 1 WHERE id = ?",
            (card.due, card.ivl, card.queue, card.type, card.did, card.id),
        )
        self.conn.commit()

    def update_note(self, note):
        self.conn.execute("UPDATE notes SET flds = ?, tags = ? WHERE id = ?",
                          ("\x1f".join(note.fields), " " + " ".join(note.tags) + " ", note.id))
        self.conn.commit()

    def update_notes(self, notes):
        for n in notes:
            self.update_note(n)

    def card_count(self):
        return self.conn.execute("SELECT count(*) FROM cards").fetchone()[0]

    def save(self):
        self.conn.commit()

    def set_deck(self, cids, did):
        for cid in cids:
            self.conn.execute("UPDATE cards SET did = ? WHERE id = ?", (int(did), int(cid)))
        self.conn.commit()

    def remove_notes(self, nids):
        for nid in nids:
            self.conn.execute("DELETE FROM notes WHERE id = ?", (int(nid),))
            self.conn.execute("DELETE FROM cards WHERE nid = ?", (int(nid),))
        self.conn.commit()

    def add_custom_undo_entry(self, name):
        self.undo_entries.append(name)
        return 1000 + len(self.undo_entries)

    def merge_undo_entries(self, target):
        self.merged_undo_targets.append(target)

    def create_backup(self, *, backup_folder, force, wait_for_completion):
        self.backup_calls.append({
            "backup_folder": backup_folder,
            "force": force,
            "wait_for_completion": wait_for_completion,
        })
        return True

    def undo_status(self):
        return type("Status", (), {"undo": "Answer Card"})()

    def undo(self):
        return None


# -- snapshot / diff ---------------------------------------------------------

def snapshot(col: SyntheticCollection, cfg: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    def fetch(columns, table):
        return [tuple(r) for r in col.conn.execute(
            f"SELECT {','.join(columns)} FROM {table} ORDER BY id"
        )]

    return {
        "cards": fetch(CARD_BUSINESS_COLUMNS, "cards"),
        "notes": fetch(NOTE_BUSINESS_COLUMNS, "notes"),
        "revlog_ids": [r[0] for r in col.conn.execute("SELECT id FROM revlog ORDER BY id")],
        "deck_limits": tuple(sorted(
            (int(c["id"]), int(c["new"]["perDay"])) for c in col.decks.all_config()
        )),
        "config": json.dumps(cfg, sort_keys=True, ensure_ascii=False) if cfg is not None else "",
    }


def compare(before: Dict[str, Any], after: Dict[str, Any]) -> Dict[str, Any]:
    """Field-level diff. Every list must be empty for a zero-diff round trip."""
    def by_id(rows):
        return {r[0]: r for r in rows}

    b_cards, a_cards = by_id(before["cards"]), by_id(after["cards"])
    b_notes, a_notes = by_id(before["notes"]), by_id(after["notes"])
    a_rev = set(after["revlog_ids"])
    return {
        "cards_added": sorted(set(a_cards) - set(b_cards)),
        "cards_removed": sorted(set(b_cards) - set(a_cards)),
        "cards_changed": sorted(
            cid for cid in set(b_cards) & set(a_cards) if b_cards[cid] != a_cards[cid]
        ),
        "notes_added": sorted(set(a_notes) - set(b_notes)),
        "notes_removed": sorted(set(b_notes) - set(a_notes)),
        "notes_changed": sorted(
            nid for nid in set(b_notes) & set(a_notes) if b_notes[nid] != a_notes[nid]
        ),
        "revlog_removed": [rid for rid in before["revlog_ids"] if rid not in a_rev],
        "deck_limits_changed": before["deck_limits"] != after["deck_limits"],
        "config_changed": before["config"] != after["config"],
    }


def card_safety_diff(diff: Dict[str, Any]) -> Dict[str, Any]:
    """Only the invariants that must hold for *every* operation, including
    operations whose round trip is not yet lossless."""
    return {k: diff[k] for k in (
        "cards_added", "cards_removed", "notes_added", "notes_removed",
        "notes_changed", "revlog_removed",
    )}


def notes_fingerprint(snap: Dict[str, Any]) -> str:
    h = hashlib.sha256()
    for row in snap["notes"]:
        h.update(repr(row).encode("utf-8"))
    return h.hexdigest()


_LIVE_ENVS: List["SafetyEnv"] = []


class SafetyEnv:
    """One isolated environment: synthetic collection + in-memory add-on config."""

    def __init__(
        self,
        seed: int = 0,
        n_cards: int = 60,
        db_path: Optional[str] = None,
        cfg_path: Optional[str] = None,
    ):
        self.col = SyntheticCollection(seed, n_cards, db_path=db_path)
        self.cfg_path = cfg_path
        self.cfg: Dict[str, Any] = {}
        if cfg_path and Path(cfg_path).exists():
            self.cfg = json.loads(Path(cfg_path).read_text(encoding="utf-8"))
        self.mw = FakeMW()
        self.router = BridgeRouter(
            col_getter=lambda: self.col,
            mw_getter=lambda: self.mw,
            config_getter=lambda: self.cfg,
            config_writer=self._write_cfg,
        )
        # Keep environments alive until tearDownModule() closes them explicitly;
        # otherwise GC of an unclosed sqlite3 connection emits ResourceWarning.
        _LIVE_ENVS.append(self)

    @classmethod
    def from_files(cls, db_path: str, cfg_path: str) -> "SafetyEnv":
        """Rebuild a full environment over persisted state after a crash."""
        obj = cls.__new__(cls)
        obj.col = SyntheticCollection.from_file(db_path)
        obj.cfg_path = cfg_path
        obj.cfg = (
            json.loads(Path(cfg_path).read_text(encoding="utf-8"))
            if Path(cfg_path).exists() else {}
        )
        obj.mw = FakeMW()
        obj.router = BridgeRouter(
            col_getter=lambda: obj.col,
            mw_getter=lambda: obj.mw,
            config_getter=lambda: obj.cfg,
            config_writer=obj._write_cfg,
        )
        _LIVE_ENVS.append(obj)
        return obj

    def close(self):
        try:
            self.col.conn.close()
        except Exception:
            pass

    def _write_cfg(self, patch):
        self.cfg.update(patch)
        if self.cfg_path:
            Path(self.cfg_path).write_text(
                json.dumps(self.cfg, ensure_ascii=False), encoding="utf-8"
            )
        return self.cfg

    def call(self, action: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        raw = self.router.handle_pycmd(
            "modern_anki:" + json.dumps({"action": action, "data": data or {}})
        )
        return json.loads(raw)

    def snap(self) -> Dict[str, Any]:
        return snapshot(self.col, self.cfg)


def close_all() -> None:
    for env in _LIVE_ENVS:
        env.close()
    _LIVE_ENVS.clear()
