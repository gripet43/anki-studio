#!/usr/bin/env bash
# 测试系统一键门禁。
#
#   ./gate.sh              隔离自检 → 补缺失场景 → 冒烟回归 → 前端静态审计
#   ./gate.sh --rebuild    强制重建全部场景
#   ./gate.sh --with-project  额外跑项目自身的 Bundle 审计与单测
#   ./gate.sh --with-apkg     额外跑真实 .apkg 显示兼容性（需本地卡组）
#
# 任何一步失败即中止。这个脚本不会启动 GUI，可以放心放进日常流程。

set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REBUILD=0
WITH_PROJECT=0
WITH_APKG=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --with-project) WITH_PROJECT=1 ;;
    --with-apkg) WITH_APKG=1 ;;
    *) printf '未知参数：%s\n' "$arg" >&2; exit 2 ;;
  esac
done

echo "── 1/6 隔离自检"
python3 verify_isolation.py

echo
echo "── 2/6 场景准备"
if [ "$REBUILD" -eq 1 ]; then
  python3 build.py --all
elif [ ! -f "$HOME/Anki-Test-Env/lib/exam.anki2" ]; then
  echo "核心场景缺失，先生成："
  python3 build.py --core
else
  echo "已就绪：$(ls "$HOME/Anki-Test-Env/lib"/*.anki2 2>/dev/null | wc -l | tr -d ' ') 个场景"
fi

echo
echo "── 3/6 可复现性"
python3 build.py --verify-repro exam

echo
echo "── 4/6 冒烟回归"
python3 smoke.py --quiet

PROJECT_ROOT="$(cd .. && cd .. && pwd)"

echo
echo "── 5/6 前端静态审计（DOM target 防御等）"
( cd "$PROJECT_ROOT" && python3 tests/scenarios/frontend_audit.py )

if [ "$WITH_APKG" -eq 1 ]; then
  echo
  echo "── 真实 .apkg 显示兼容性"
  ( cd "$PROJECT_ROOT" && python3 tests/apkg/run.py )
fi

if [ "$WITH_PROJECT" -eq 1 ]; then
  echo
  echo "── 6/6 项目门禁"
  ( cd "$PROJECT_ROOT" && node tests/test_frontend_bundle.mjs | tail -1 )
  ( cd "$PROJECT_ROOT" && python3 -m unittest discover -s tests -p "test_*.py" 2>&1 | tail -3 )
fi

echo
echo "门禁通过。"
