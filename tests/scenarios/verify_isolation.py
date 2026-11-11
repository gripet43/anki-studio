#!/usr/bin/env python3
"""隔离性自检。

测试系统的价值取决于「它有没有真的隔离」，而这件事不能靠约定，只能靠检查。
每次启动沙盒前跑一遍，任何一项 FAIL 都不应该继续。

    python3 tests/scenarios/verify_isolation.py            # 静态检查
    python3 tests/scenarios/verify_isolation.py --baseline # 记录真实库指纹
    python3 tests/scenarios/verify_isolation.py --check    # 与基线比对，确认未被改动

基线比对只看 size / mtime / sha256，全程只读，不打开 collection。
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from guard import REAL_ANKI_ROOT, SANDBOX_ROOT, state_dir  # noqa: E402

#: config.json 里属于运行时真实数据的字段，绝不该出现在沙盒副本中
PRIVATE_CONFIG_KEYS = (
    "last_rescue_receipt",
    "vacation_state",
    "vacation_history",
    "vacation_frozen_dates",
    "custom_nickname",
)

results: list[tuple[bool, str, str]] = []


def record(ok: bool, name: str, detail: str = "") -> None:
    results.append((ok, name, detail))


# ---------------------------------------------------------------------------
# 检查项
# ---------------------------------------------------------------------------


def check_boundary() -> None:
    """沙盒与真实数据目录不得有任何包含关系。"""
    sandbox = SANDBOX_ROOT.resolve()
    real = REAL_ANKI_ROOT.resolve()
    inside = str(sandbox).startswith(str(real)) or str(real).startswith(str(sandbox))
    record(
        not inside,
        "沙盒边界",
        f"沙盒 {sandbox} / 真实 {real}" if not inside else f"两者存在包含关系：{sandbox} ↔ {real}",
    )


def check_symlinks() -> None:
    """沙盒内不允许存在指向真实目录的符号链接。

    早期方案曾用软链共享插件目录，那会让插件写入的配置穿透到开发目录，
    等于绕过隔离。这里把它降级为硬性检查。
    """
    offenders: list[str] = []
    if SANDBOX_ROOT.exists():
        for root, dirs, files in os.walk(SANDBOX_ROOT, followlinks=False):
            for name in dirs + files:
                path = Path(root) / name
                if path.is_symlink():
                    target = path.resolve()
                    if str(target).startswith(str(REAL_ANKI_ROOT)):
                        offenders.append(f"{path} -> {target}")
    record(not offenders, "无越界软链", "；".join(offenders) or "未发现指向真实目录的软链")


def check_config() -> None:
    """沙盒里的 config.json 不得含真实运行时字段。"""
    cfg = SANDBOX_ROOT / "base" / "addons21" / "anki_modern_os" / "config.json"
    if not cfg.exists():
        record(True, "配置洁净", "尚未同步插件副本，跳过")
        return
    try:
        data = json.loads(cfg.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        record(False, "配置洁净", f"config.json 无法解析：{exc}")
        return
    leaked = [k for k in PRIVATE_CONFIG_KEYS if k in data]
    record(not leaked, "配置洁净", f"残留真实字段：{leaked}" if leaked else "无真实运行时字段")


def _find_real_collection() -> Path | None:
    """找真实库里任意 profile 的 collection。

    profile 名各平台不同（macOS 常见「账户 1」，Windows 常见「User 1」），
    不能写死，否则换平台后真实库指纹检查会静默失效。
    """
    if not REAL_ANKI_ROOT.is_dir():
        return None
    for candidate in sorted(REAL_ANKI_ROOT.glob("*/collection.anki2")):
        return candidate
    return None


def check_no_real_collection_in_sandbox() -> None:
    """沙盒里的 collection 必须来自 lib/，不能是真实库的拷贝。

    判据是：真实库存在时，沙盒库的大小不应与之一致。
    """
    real = _find_real_collection()
    sandbox_db = SANDBOX_ROOT / "base" / "测试账户" / "collection.anki2"
    if real is None or not sandbox_db.exists():
        record(True, "库来源", "真实库或沙盒库不存在，跳过")
        return
    same_size = real.stat().st_size == sandbox_db.stat().st_size
    record(not same_size, "库来源", "沙盒库与真实库大小相同，疑似直接拷贝" if same_size else "沙盒库独立生成")


def check_launcher_guard() -> None:
    """启动逻辑必须强制 ``-b``，且不得存在裸启动路径。

    启动入口已从 ``run.sh`` 迁到跨平台的 ``run.py``（Windows 上没有 bash/rsync）。
    ``run.sh`` 现在只是薄包装，因此以 ``run.py`` 为检查对象。
    """
    runner = Path(__file__).with_name("run.py")
    if not runner.exists():
        record(False, "启动守卫", "run.py 不存在")
        return

    text = runner.read_text(encoding="utf-8")
    launches = [
        line.strip()
        for line in text.splitlines()
        if not line.strip().startswith("#")
        and any(call in line for call in ("subprocess.call(", "subprocess.run(", "subprocess.Popen("))
    ]
    if not launches:
        record(False, "启动守卫", "run.py 里找不到启动调用")
        return

    missing = [line for line in launches if '"-b"' not in line]
    record(
        not missing,
        "启动守卫",
        f"缺 -b 的启动行：{missing}" if missing else "只允许 -b 沙盒启动",
    )


def _fingerprint(path: Path) -> dict[str, object]:
    stat = path.stat()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return {"size": stat.st_size, "mtime_ns": stat.st_mtime_ns, "sha256": digest}


def _baseline_path() -> Path:
    return state_dir() / "real-baseline.json"


def cmd_baseline() -> int:
    real = _find_real_collection()
    if real is None:
        print(f"在 {REAL_ANKI_ROOT} 下找不到任何 profile 的 collection.anki2", file=sys.stderr)
        return 1
    fp = _fingerprint(real)
    _baseline_path().write_text(json.dumps(fp, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"已记录真实库指纹：{fp['size']} B  sha256 {fp['sha256'][:16]}…")
    print(f"基线文件：{_baseline_path()}")
    return 0


def cmd_check() -> int:
    real = _find_real_collection()
    if real is None:
        record(False, "真实库未被改动", f"在 {REAL_ANKI_ROOT} 下找不到 collection.anki2")
        return 1
    baseline_file = _baseline_path()
    if not baseline_file.exists():
        record(False, "真实库未被改动", "没有基线，请先运行 --baseline")
        return 1
    baseline = json.loads(baseline_file.read_text(encoding="utf-8"))
    current = _fingerprint(real)
    same = (
        baseline["size"] == current["size"]
        and baseline["mtime_ns"] == current["mtime_ns"]
        and baseline["sha256"] == current["sha256"]
    )
    detail = (
        f"未变（{current['size']} B）"
        if same
        else f"发生变化！基线 {baseline['size']} B / 现在 {current['size']} B"
    )
    record(same, "真实库未被改动", detail)
    return 0


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="测试沙盒隔离性自检")
    parser.add_argument("--baseline", action="store_true", help="记录真实库指纹")
    parser.add_argument("--check", action="store_true", help="与基线比对真实库是否被改动")
    args = parser.parse_args()

    if args.baseline:
        return cmd_baseline()

    print(f"沙盒：{SANDBOX_ROOT}")
    print(f"真实：{REAL_ANKI_ROOT}\n")

    check_boundary()
    check_symlinks()
    check_config()
    check_no_real_collection_in_sandbox()
    check_launcher_guard()
    if args.check:
        cmd_check()

    width = max(len(name) for _, name, _ in results)
    failed = 0
    for ok, name, detail in results:
        flag = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"  [{flag}] {name.ljust(width)}  {detail}")

    print()
    if failed:
        print(f"{failed} 项未通过——请先修复再启动沙盒。")
        return 1
    print("隔离性检查全部通过。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
