#!/usr/bin/env bash
# 启动隔离沙盒。
#
#   ./run.sh --list          列出可用场景
#   ./run.sh exam            同步插件 → 备份现场 → 切换到 exam → 启动
#   ./run.sh --sync          只同步插件，不启动
#   ./run.sh --status        查看当前沙盒状态
#
# 这个脚本永远不会在缺少 -b 参数的情况下启动 Anki。真实数据目录
# ~/Library/Application Support/Anki2 只作为插件源码的读取来源，不作为写入目标。

set -euo pipefail

SANDBOX="$HOME/Anki-Test-Env"
ANKI_BIN="/Applications/Anki.app/Contents/MacOS/Anki"
PROFILE="测试账户"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEV_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BASE="$SANDBOX/base"
LIB="$SANDBOX/lib"
STATE="$SANDBOX/state"
ADDON_DST="$BASE/addons21/anki_modern_os"

die() { printf '错误：%s\n' "$1" >&2; exit 1; }
info() { printf '%s\n' "$1"; }

# ---------------------------------------------------------------- 前置校验
[ -x "$ANKI_BIN" ] || die "找不到 Anki：$ANKI_BIN"
case "$SANDBOX" in
  "$HOME/Library/Application Support/Anki2"*) die "沙盒路径落在真实数据目录内，拒绝启动" ;;
esac
[ -d "$DEV_DIR" ] || die "找不到插件源码目录：$DEV_DIR"

mkdir -p "$BASE/addons21" "$LIB" "$STATE"

# ---------------------------------------------------------------- 子命令
cmd_list() {
  info "沙盒：$SANDBOX"
  info ""
  if [ -z "$(ls -A "$LIB"/*.anki2 2>/dev/null)" ]; then
    info "  还没有场景，先运行：python3 tests/scenarios/build.py --core"
    return
  fi
  local active=""
  [ -f "$SANDBOX/active" ] && active="$(cat "$SANDBOX/active")"
  for f in "$LIB"/*.anki2; do
    local key; key="$(basename "$f" .anki2)"
    local mark="  "
    [ "$key" = "$active" ] && mark="→ "
    printf '%s%-9s %s\n' "$mark" "$key" "$(du -h "$f" | cut -f1)"
  done
}

cmd_sync() {
  info "同步插件副本 → $ADDON_DST"
  # config.json / meta.json 必须排除：前者是运行时配置，后者含 Anki 写入的配置副本。
  # 让沙盒保留自己的配置，才谈得上「不影响主界面」。
  rsync -a --delete \
    --exclude 'config.json' \
    --exclude 'meta.json' \
    --exclude '__pycache__' \
    --exclude '.git' \
    --exclude 'tests' \
    --exclude 'node_modules' \
    --exclude 'frontend/node_modules' \
    --exclude 'frontend/dist' \
    --exclude '*.ankiaddon' \
    "$DEV_DIR/" "$ADDON_DST/"

  # 首次同步补一份配置模板。必须剥离运行时私有字段：config.json 里可能有
  # 昵称、减负回执、休假历史等真实数据，测试沙盒不该携带任何真实信息。
  if [ ! -f "$ADDON_DST/config.json" ] && [ -f "$DEV_DIR/config.json" ]; then
    python3 - "$DEV_DIR/config.json" "$ADDON_DST/config.json" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
with open(src, encoding="utf-8") as fh:
    data = json.load(fh)
for key in ("last_rescue_receipt", "vacation_state", "vacation_history",
            "vacation_frozen_dates", "custom_nickname"):
    data.pop(key, None)
with open(dst, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=2)
PY
    info "  已写入洁净的 config.json 模板（已剥离运行时私有字段）"
  fi
  info "  完成（$(du -sh "$ADDON_DST" | cut -f1)）"
}

cmd_status() {
  info "沙盒根 : $SANDBOX"
  info "base   : $BASE"
  info "profile: $PROFILE"
  if [ -f "$SANDBOX/active" ]; then
    info "当前场景: $(cat "$SANDBOX/active")"
  else
    info "当前场景: （未激活）"
  fi
  if [ -f "$BASE/$PROFILE/collection.anki2" ]; then
    info "库大小 : $(du -h "$BASE/$PROFILE/collection.anki2" | cut -f1)"
  fi
  if [ -d "$ADDON_DST" ]; then
    info "插件副本: $(du -sh "$ADDON_DST" | cut -f1)  最近同步 $(date -r "$ADDON_DST" '+%H:%M:%S')"
  else
    info "插件副本: 尚未同步"
  fi
  info ""
  info "真实数据目录（只读，永不写入）：$HOME/Library/Application Support/Anki2"
}

ensure_profile() {
  mkdir -p "$BASE/$PROFILE/collection.media"
  if [ ! -f "$BASE/prefs21.db" ]; then
    info "初始化沙盒 profile 元数据"
    python3 - "$BASE/prefs21.db" "$PROFILE" <<'PY'
import pickle, sqlite3, sys
db, name = sys.argv[1], sys.argv[2]
conn = sqlite3.connect(db)
conn.execute("create table if not exists profiles (name text primary key, data blob)")
# Anki 读 profile 配置时用 pickle.loads；空 dict 会被它补全默认值
conn.execute("insert or replace into profiles (name, data) values (?, ?)",
             (name, pickle.dumps({})))
conn.commit(); conn.close()
PY
  fi
}

cmd_run() {
  local key="$1"
  local src="$LIB/$key.anki2"
  [ -f "$src" ] || die "场景不存在：$key（先运行 ./run.sh --list 查看）"

  cmd_sync
  ensure_profile

  # 切换前备份上一次的现场，避免手测出的数据说没就没
  local dst="$BASE/$PROFILE/collection.anki2"
  if [ -f "$dst" ]; then
    local prev="unknown"
    [ -f "$SANDBOX/active" ] && prev="$(cat "$SANDBOX/active")"
    local backup="$STATE/${prev}-$(date '+%Y%m%d-%H%M%S').anki2"
    cp "$dst" "$backup"
    info "已备份上一现场 → $(basename "$backup")"
  fi

  cp "$src" "$dst"
  rm -f "$dst-wal" "$dst-shm"
  rm -rf "$BASE/$PROFILE/collection.media"
  mkdir -p "$BASE/$PROFILE/collection.media"
  if [ -d "$LIB/$key.media" ]; then
    cp -R "$LIB/$key.media/." "$BASE/$PROFILE/collection.media/" 2>/dev/null || true
  fi
  printf '%s' "$key" > "$SANDBOX/active"

  info "已切换到场景：$key"
  info "启动：Anki -b <沙盒> -p $PROFILE"
  info ""
  # 唯一允许的启动方式：显式 -b 指向沙盒
  exec "$ANKI_BIN" -b "$BASE" -p "$PROFILE"
}

# ---------------------------------------------------------------- 分发
case "${1:-}" in
  ""|"-h"|"--help")
    sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
    ;;
  "--list")   cmd_list ;;
  "--sync")   cmd_sync; info "插件已同步（未启动）" ;;
  "--status") cmd_status ;;
  *)          cmd_run "$1" ;;
esac
