#!/usr/bin/env python3
"""把若干张界面截图拼成 AnkiWeb 简介页用的循环预览 GIF。

为什么单独成脚本：上一版预览图是一次性命令拼出来的，改不动、也复现不了。
UI 一旦改版就得重来，所以这里把「构图 / 量化 / 节奏」全部参数化。

用法（默认硬切，最清晰、体积最小）：

    python3 scripts/build_preview_gif.py \\
        --frames shots/01-dashboard.jpg shots/02-search.jpg \\
                 shots/03-relief.jpg shots/04-vacation.jpg \\
        --out docs/assets/anki-studio-preview.gif

想要交叉淡入就加 --fade-steps 3（会显著增大体积，且淡入期间两张图重叠）。

截图规格建议：窗口截图，背景纯白或与页面同色，各帧同尺寸同构图；
macOS 上用 Xnip 带阴影直接截整窗即可（本脚本实测输入 2944×2086）。
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

# 截图多为 JPEG，白色区域带 ±1 的色度噪声。这些噪声会占掉调色板里的名额，
# 让本该纯白的整片底色被量化到 252 一类「脏白」上（实测纯白像素从 58% 掉到 0%），
# 看起来就是整屏发灰、底色有噪点。所以量化前先把接近纯白的像素拍平。
WHITE_SNAP = 250


def snap_whites(im: Image.Image, threshold: int = WHITE_SNAP) -> Image.Image:
    a = np.array(im)
    a[a.min(axis=2) >= threshold] = 255
    return Image.fromarray(a)


def load_frames(paths: list[Path], width: int) -> list[Image.Image]:
    frames = []
    size = None
    for p in paths:
        im = Image.open(p).convert("RGB")
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        if size is None:
            size = im.size
        elif im.size != size:
            raise SystemExit(f"各帧尺寸不一致：{p} 得到 {im.size}，期望 {size}")
        frames.append(snap_whites(im))
    return frames


def to_palette(im: Image.Image) -> Image.Image:
    """逐帧自适应量化到 256 色。

    这里踩过两个坑，都实测过：

    1. **不要用全局调色板**。曾把四帧拼成蒙太奇量化出一套共用调色板，想让
       换帧时底色不跳色；但共用调色板要迁就四帧的平均分布，单帧误差反而大：
       平均色差（MAE）2.32，而逐帧自适应只有 0.24，差一个数量级。硬切播放时
       每帧本来就独立出现，跳色问题并不存在，共用一个调色板是纯亏。

    2. **不要开抖动，也不要预模糊**。Pillow 的 `quantize(dither=...)` 在这套
       路径下会被静默忽略（四组参数的输出像素完全相同）；而预模糊会把文字
       糊掉，MAE 从 0.24 涨到 0.60（0.4px）/ 1.32（0.7px）。

    缩放到目标宽度时用的 LANCZOS 已经做了抗锯齿，不需要再补模糊。
    """
    return im.quantize(colors=256, method=Image.Quantize.MEDIANCUT)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frames", nargs="+", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--width", type=int, default=1200)
    ap.add_argument("--hold-ms", type=int, default=2800, help="每帧停留时长")
    ap.add_argument("--fade-steps", type=int, default=0, help="每两帧之间的淡入步数，0=硬切")
    ap.add_argument("--fade-ms", type=int, default=90, help="单步淡入时长")
    ap.add_argument("--loop-back", action="store_true", help="末帧淡回首帧，避免循环处硬跳")
    args = ap.parse_args()

    frames = load_frames(args.frames, args.width)

    seq: list[Image.Image] = []
    durations: list[int] = []

    def emit(im: Image.Image, ms: int) -> None:
        seq.append(to_palette(im))
        durations.append(ms)

    pairs = list(zip(frames, frames[1:]))
    if args.loop_back:
        pairs.append((frames[-1], frames[0]))

    for i, frame in enumerate(frames):
        emit(frame, args.hold_ms)
        if i < len(pairs):
            a, b = pairs[i]
            for s in range(1, args.fade_steps + 1):
                emit(Image.blend(a, b, s / (args.fade_steps + 1)), args.fade_ms)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    seq[0].save(
        args.out,
        save_all=True,
        append_images=seq[1:],
        duration=durations,
        loop=0,
        disposal=2,
        optimize=True,
    )

    kb = args.out.stat().st_size / 1024
    total = sum(durations) / 1000
    print(f"{args.out}  {frames[0].width}×{frames[0].height}  {len(seq)} 帧  {total:.1f}s  {kb:.0f} KB")


if __name__ == "__main__":
    main()
