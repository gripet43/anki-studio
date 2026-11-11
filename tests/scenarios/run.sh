#!/usr/bin/env bash
# 薄包装：真正的逻辑在 run.py（跨平台）。Windows 上直接 `python run.py <场景>`。
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/run.py" "$@"
