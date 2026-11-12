#!/usr/bin/env python3
"""生成测试场景。

用法：

    python3 tests/scenarios/build.py --list
    python3 tests/scenarios/build.py --core          # empty / newbie / exam
    python3 tests/scenarios/build.py exam backlog    # 指定场景
    python3 tests/scenarios/build.py --all

产物写在 ``~/Anki-Test-Env/lib/<场景>.anki2``，配套 ``.manifest.json``。
生成过程不读取真实 collection，所有路径都经过 guard 校验。
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from builder import build  # noqa: E402
from guard import SANDBOX_ROOT, ensure_dir, lib_dir, state_dir  # noqa: E402
from scenarios import CORE, SCENARIOS  # noqa: E402


def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def _fingerprint(path: Path) -> tuple[str, str]:
    """业务指纹：排除 id / mod / due 等必然变化的时间字段。

    notes 按 flds 排序后哈希，cards 按调度字段排序后哈希。同一份配方只要
    这两项一致，就说明场景确实可复现，而不是「看起来差不多」。
    """
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        notes = [row[0] for row in conn.execute("select flds from notes order by flds")]
        cards = conn.execute(
            "select type, queue, ivl, factor, reps, lapses, flags from cards"
            " order by type, queue, ivl, factor, reps, lapses, flags"
        ).fetchall()
    finally:
        conn.close()
    note_hash = hashlib.sha256("\x00".join(notes).encode("utf-8")).hexdigest()[:16]
    card_hash = hashlib.sha256(repr(cards).encode("utf-8")).hexdigest()[:16]
    return note_hash, card_hash


def cmd_verify_repro(keys: list[str]) -> int:
    """同一配方生成两次，比对业务指纹。"""
    work = ensure_dir(state_dir() / "repro")
    failed = 0
    for key in keys:
        spec = SCENARIOS[key]
        a = work / f"{key}-a.anki2"
        b = work / f"{key}-b.anki2"
        print(f"→ {key} …", end="", flush=True)
        try:
            build(spec, a)
            build(spec, b)
            fa, fb = _fingerprint(a), _fingerprint(b)
            if fa == fb:
                print(f" 可复现  notes {fa[0]}  cards {fa[1]}")
            else:
                print(f" 不可复现！\n    notes {fa[0]} vs {fb[0]}\n    cards {fa[1]} vs {fb[1]}")
                failed += 1
        except Exception as exc:  # noqa: BLE001
            print(f" 失败 {type(exc).__name__}: {exc}")
            failed += 1
        finally:
            for path in (a, b):
                if path.exists():
                    path.unlink()
                media = path.with_suffix(".media")
                if media.exists():
                    shutil.rmtree(media)
    return 1 if failed else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 Anki 测试场景")
    parser.add_argument("keys", nargs="*", help="场景 key，省略时等同 --core")
    parser.add_argument("--list", action="store_true", help="只列出可用场景")
    parser.add_argument("--core", action="store_true", help="生成首批核心场景")
    parser.add_argument("--all", action="store_true", help="生成全部场景")
    parser.add_argument(
        "--verify-repro",
        action="store_true",
        help="同一配方生成两次，比对业务指纹以确认可复现",
    )
    args = parser.parse_args()

    if args.list:
        print(f"沙盒：{SANDBOX_ROOT}\n")
        for key, spec in SCENARIOS.items():
            marker = "●" if key in CORE else "○"
            print(f"  {marker} {key:<9} {spec.total_cards:>5} 卡  {spec.title}")
            print(f"             {spec.description}")
        print("\n  ● = --core 默认生成")
        return 0

    if args.verify_repro:
        return cmd_verify_repro(args.keys or list(CORE))

    if args.all:
        keys = list(SCENARIOS)
    elif args.keys:
        keys = args.keys
    else:
        keys = list(CORE)

    unknown = [k for k in keys if k not in SCENARIOS]
    if unknown:
        print(f"未知场景：{', '.join(unknown)}", file=sys.stderr)
        return 2

    out_dir = lib_dir()
    print(f"沙盒：{SANDBOX_ROOT}")
    print(f"输出：{out_dir}\n")

    failures = 0
    for key in keys:
        spec = SCENARIOS[key]
        started = time.time()
        print(f"→ {key} ({spec.total_cards} 卡) …", end="", flush=True)
        try:
            manifest = build(spec, out_dir / f"{key}.anki2")
        except Exception as exc:  # noqa: BLE001
            print(f" 失败\n  {type(exc).__name__}: {exc}")
            failures += 1
            continue

        size = (out_dir / f"{key}.anki2").stat().st_size
        elapsed = time.time() - started
        verify = manifest["verification"]
        print(
            f" 完成 {elapsed:4.1f}s  {_human_size(size):>7}  "
            f"卡 {verify['anki_card_count']}  revlog {verify['anki_revlog']}"
        )

    print()
    if failures:
        print(f"{failures} 个场景生成失败", file=sys.stderr)
        return 1
    print("全部生成完成。用 ./run.sh <场景> 启动沙盒。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
