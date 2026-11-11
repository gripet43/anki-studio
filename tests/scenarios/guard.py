"""沙盒路径守卫。

整套测试系统只有一条不可破的规则：**任何写操作都不能落到真实的 Anki 数据目录。**

真实目录指的是 ``~/Library/Application Support/Anki2``，里面是用户的
collection、媒体文件、插件配置与 AnkiWeb 凭据。测试系统一律在
``~/Anki-Test-Env`` 下活动。

这里不用「约定」而是「断言」：所有落盘路径必须经过 :func:`assert_sandboxed`，
它会把符号链接解析成真实路径后再判断，因此软链也无法逃逸。
"""

from __future__ import annotations

from pathlib import Path

try:  # 作为包导入时走相对路径，直接运行脚本时走同级模块
    from .paths import real_anki_base
except ImportError:
    from paths import real_anki_base

HOME = Path.home()

#: 测试沙盒根目录。所有生成物、日志、备份都只能在这里面。
SANDBOX_ROOT = (HOME / "Anki-Test-Env").resolve()

#: 真实 Anki 数据目录。测试系统对它只允许一种操作：读取插件源码用于同步副本。
#: 跨平台：macOS 为 ~/Library/Application Support/Anki2，Windows 为 %APPDATA%\Anki2。
REAL_ANKI_ROOT = real_anki_base()

#: 真实 collection 文件名，用于额外拦截。
_REAL_COLLECTION_NAMES = ("collection.anki2", "collection.anki21", "collection.log")


class IsolationError(RuntimeError):
    """测试流程试图触碰沙盒之外的路径时抛出。"""


def _is_within(child: Path, parent: Path) -> bool:
    """child 是否位于 parent 之内（两者都应是已 resolve 的绝对路径）。"""
    try:
        child.relative_to(parent)
    except ValueError:
        return False
    return True


def assert_sandboxed(target: str | Path, *, purpose: str = "写入") -> Path:
    """校验目标路径确实位于沙盒内，返回解析后的绝对路径。

    解析符号链接后再比较，因此 ``base/addons21/x -> 真实目录`` 这种
    软链逃逸也会被拦下。
    """
    path = Path(target).expanduser().resolve()

    if _is_within(path, REAL_ANKI_ROOT):
        raise IsolationError(
            f"拒绝{purpose}：{path} 位于真实 Anki 数据目录 {REAL_ANKI_ROOT} 内。\n"
            f"测试系统不得修改用户数据，请改用沙盒路径 {SANDBOX_ROOT}。"
        )

    if not _is_within(path, SANDBOX_ROOT):
        raise IsolationError(
            f"拒绝{purpose}：{path} 不在沙盒 {SANDBOX_ROOT} 内。\n"
            f"若确需新增位置，请先在 guard.py 中显式登记，不要绕过守卫。"
        )

    return path


def ensure_dir(path: Path) -> Path:
    """创建目录（已存在则跳过）。

    不用 ``mkdir(exist_ok=True)``：部分沙箱环境会代理文件系统调用并忽略
    exist_ok，直接抛 EEXIST。显式判断在各个环境下行为一致。
    """
    if not path.exists():
        path.mkdir(parents=True)
    return path


def sandbox_path(*parts: str) -> Path:
    """拼接沙盒内路径并校验，父目录不存在时自动创建。"""
    path = assert_sandboxed(SANDBOX_ROOT.joinpath(*parts), purpose="创建目录")
    ensure_dir(path.parent)
    return path


def lib_dir() -> Path:
    """场景库目录：存放各场景的 collection.anki2。"""
    path = assert_sandboxed(SANDBOX_ROOT / "lib", purpose="访问场景库")
    return ensure_dir(path)


def base_dir() -> Path:
    """沙盒的 Anki base 目录（`Anki -b` 指向这里）。"""
    path = assert_sandboxed(SANDBOX_ROOT / "base", purpose="访问 base 目录")
    return ensure_dir(path)


def state_dir() -> Path:
    """备份与运行状态目录。"""
    path = assert_sandboxed(SANDBOX_ROOT / "state", purpose="访问状态目录")
    return ensure_dir(path)


def assert_real_collection_untouched(path: str | Path) -> None:
    """打开 collection 前调用：确认待打开的库不是真实库。"""
    resolved = Path(path).expanduser().resolve()
    if _is_within(resolved, REAL_ANKI_ROOT) or resolved.name in _REAL_COLLECTION_NAMES and _is_within(resolved, REAL_ANKI_ROOT):
        raise IsolationError(f"拒绝打开真实 collection：{resolved}")


def describe() -> str:
    """返回隔离边界的可读描述，供启动日志与自检打印。"""
    return (
        f"沙盒根目录 : {SANDBOX_ROOT}\n"
        f"真实数据   : {REAL_ANKI_ROOT}\n"
        f"交集       : {'有！' if _is_within(SANDBOX_ROOT, REAL_ANKI_ROOT) or _is_within(REAL_ANKI_ROOT, SANDBOX_ROOT) else '无'}"
    )
