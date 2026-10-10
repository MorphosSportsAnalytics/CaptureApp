#!/usr/bin/env python3
"""Generate Morphos Capture app icons and Android mipmap assets from the Morphos mark."""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"

# App chrome background (matches MobileApp dark theme).
BACKGROUND = (15, 23, 42, 255)  # #0f172a

# Crop bounds for the stylized M (excludes MORPHOS SPORTS wordmark).
MARK_BOX = (110, 160, 820, 500)

ICON_SIZE = 1024
MARK_PADDING = 0.14  # fraction of canvas; keeps adaptive-icon safe zone


def load_mark() -> Image.Image:
    source = ASSETS / "morphos-mark-source.png"
    if not source.exists():
        raise SystemExit(f"Missing source asset: {source}")
    img = Image.open(source).convert("RGBA")
    return img.crop(MARK_BOX)


def fit_mark(canvas_size: int, background: tuple[int, int, int, int] | None) -> Image.Image:
    mark = load_mark()
    inner = int(canvas_size * (1 - 2 * MARK_PADDING))
    scale = min(inner / mark.width, inner / mark.height)
    size = (max(1, int(mark.width * scale)), max(1, int(mark.height * scale)))
    mark = mark.resize(size, Image.Resampling.LANCZOS)

    if background is None:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    else:
        canvas = Image.new("RGBA", (canvas_size, canvas_size), background)

    x = (canvas_size - mark.width) // 2
    y = (canvas_size - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    return canvas


def rounded_square_icon(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    size = img.width
    radius = int(size * radius_ratio)
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def round_icon(img: Image.Image) -> Image.Image:
    size = img.width
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def save_png(path: Path, img: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def save_webp(path: Path, img: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="WEBP", quality=95, method=6)


def write_app_assets() -> None:
    icon = fit_mark(ICON_SIZE, BACKGROUND)
    adaptive = fit_mark(ICON_SIZE, None)
    splash = fit_mark(ICON_SIZE, BACKGROUND)

    save_png(ASSETS / "icon.png", icon)
    save_png(ASSETS / "adaptive-icon.png", adaptive)
    save_png(ASSETS / "splash-icon.png", splash)


def write_android_launcher(size: int, path: Path, round_mask: bool) -> None:
    base = fit_mark(size, BACKGROUND)
    final = round_icon(base) if round_mask else rounded_square_icon(base)
    save_webp(path, final)


def write_android_splash(width: int, path: Path) -> None:
    # Splash logo width scales with density bucket.
    canvas = Image.new("RGBA", (width, width), (0, 0, 0, 0))
    mark = load_mark()
    scale = (width * 0.82) / max(mark.width, mark.height)
    size = (max(1, int(mark.width * scale)), max(1, int(mark.height * scale)))
    mark = mark.resize(size, Image.Resampling.LANCZOS)
    x = (width - mark.width) // 2
    y = (width - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    save_png(path, canvas)


def write_android_assets() -> None:
    launcher_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    splash_sizes = {
        "drawable-mdpi": 128,
        "drawable-hdpi": 216,
        "drawable-xhdpi": 324,
        "drawable-xxhdpi": 432,
        "drawable-xxxhdpi": 576,
    }

    for folder, px in launcher_sizes.items():
        write_android_launcher(px, ANDROID_RES / folder / "ic_launcher.webp", round_mask=False)
        write_android_launcher(px, ANDROID_RES / folder / "ic_launcher_round.webp", round_mask=True)

    for folder, px in splash_sizes.items():
        write_android_splash(px, ANDROID_RES / folder / "splashscreen_logo.png")


def write_ios_app_icon() -> None:
    dest = (
        ROOT
        / "ios"
        / "MorphosCapture"
        / "Images.xcassets"
        / "AppIcon.appiconset"
        / "AppIcon.png"
    )
    if not dest.parent.exists():
        return
    save_png(dest, fit_mark(ICON_SIZE, BACKGROUND))


def main() -> None:
    write_app_assets()
    if ANDROID_RES.exists():
        write_android_assets()
    write_ios_app_icon()
    print("Generated Morphos app icons in assets/, android/app/src/main/res/, and ios AppIcon")


if __name__ == "__main__":
    main()
