#!/usr/bin/env python3
"""
Render a calibration matrix of the same light fabric over REAL blazer +
pant templates, across 4 light-fabric profiles × 2 tile sizes (200 / 260).

The script never writes inside public/assets/ — every output goes under
/tmp/fabric-calibration-matrix/ so production renders stay untouched and
no bulk regen is needed to inspect the results.

Run:
    cd fabric-engine
    python3 tools/calibration_matrix.py

Override the fabric or output directory with env vars:
    FABRIC_PATH=public/assets/blazer/generated-fabrics/custom_beyaz/source.png \
      python3 tools/calibration_matrix.py
    CALIB_OUT_DIR=/tmp/my-calib python3 tools/calibration_matrix.py
"""

from __future__ import annotations

import os
import sys
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from fabric_generator import (  # noqa: E402
    srgb_luminance,
    _shirt_make_seamless,
    _shirt_make_tiled_fabric,
    SHIRT_SEAMLESS_OVERLAP,
    ALPHA_THRESHOLD,
    SHADING_STRENGTH,
    DETAIL_BLEND,
    LIGHT_FABRIC_THRESHOLD,
    LIGHT_FABRIC_STRENGTH_CAP,
    LIGHT_FABRIC_DETAIL_CAP,
    LIGHT_FABRIC_CLIP_FLOOR,
    LIGHT_FABRIC_CLIP_CEIL,
    LIGHT_FABRIC_SHOULDER_KNEE,
    LIGHT_FABRIC_SHOULDER_CEIL,
)

# -----------------------------------------------------------------------------
# Fixture selection
# -----------------------------------------------------------------------------
#
# `custom_byeaz_izgili` is the highest-luminance lightly-blueish fabric that
# actually exists in the uploaded set today (mean_lum ≈ 0.735 — just over the
# light-fabric threshold, slightly cool RGB). It's the closest "real light
# blue" we have without forcing the user to upload a new fabric just for this.
DEFAULT_FABRIC = ROOT / "public/assets/blazer/generated-fabrics/custom_byeaz_izgili/source.png"

# Real product templates, picked to have plenty of shading variation so the
# differences between profiles are easy to see.
BLAZER_TEMPLATE = ROOT / "public/assets/blazer/base/bottom_single_breasted+length_long+hemline_open.png"
PANT_TEMPLATE   = ROOT / "public/assets/pant/base/base__z31__length_long+cut_regular.png"

OUT_ROOT = Path(os.environ.get("CALIB_OUT_DIR", "/tmp/fabric-calibration-matrix"))
TILE_SIZES = (200, 260)

# -----------------------------------------------------------------------------
# Profile matrix
# -----------------------------------------------------------------------------
#
# Each profile is a dict of overrides applied to the LIGHT branch only. The
# helper `render_light()` below mirrors apply_relative_shading's light branch
# but accepts every constant as an explicit kwarg so this script can probe
# new values without touching the shared module defaults.
PROFILES: list[tuple[str, dict]] = [
    (
        "01_light_fabric_soft",
        # Current module defaults — should match what production renders today
        # for a light fabric.
        dict(
            strength_cap=LIGHT_FABRIC_STRENGTH_CAP,   # 0.75
            detail_cap=LIGHT_FABRIC_DETAIL_CAP,       # 0.08
            clip_floor=LIGHT_FABRIC_CLIP_FLOOR,       # 0.55
            clip_ceil=LIGHT_FABRIC_CLIP_CEIL,         # 1.25
            knee=LIGHT_FABRIC_SHOULDER_KNEE,          # 0.92
            ceil=LIGHT_FABRIC_SHOULDER_CEIL,          # 0.985
        ),
    ),
    (
        "02_light_fabric_stronger_texture",
        # Uncap the shading strength so the linear ratio amplifies fabric
        # weave variation more visibly. Still soft-shouldered, so no clipping.
        dict(
            strength_cap=1.0,
            detail_cap=LIGHT_FABRIC_DETAIL_CAP,
            clip_floor=LIGHT_FABRIC_CLIP_FLOOR,
            clip_ceil=LIGHT_FABRIC_CLIP_CEIL,
            knee=LIGHT_FABRIC_SHOULDER_KNEE,
            ceil=LIGHT_FABRIC_SHOULDER_CEIL,
        ),
    ),
    (
        "03_light_fabric_less_bleach",
        # Tighter highlights: lower clip ceiling AND lower shoulder asymptote.
        # The garment never approaches white; useful for cream / off-white
        # fabrics that the soft profile still washes out.
        dict(
            strength_cap=LIGHT_FABRIC_STRENGTH_CAP,
            detail_cap=LIGHT_FABRIC_DETAIL_CAP,
            clip_floor=LIGHT_FABRIC_CLIP_FLOOR,
            clip_ceil=1.10,
            knee=0.88,
            ceil=0.95,
        ),
    ),
    (
        "04_light_fabric_more_depth",
        # Lower clip floor so shaded folds darken more (visible depth on
        # shoulders / hip break), but the highlight side stays soft.
        dict(
            strength_cap=0.85,
            detail_cap=0.10,
            clip_floor=0.40,
            clip_ceil=LIGHT_FABRIC_CLIP_CEIL,
            knee=LIGHT_FABRIC_SHOULDER_KNEE,
            ceil=LIGHT_FABRIC_SHOULDER_CEIL,
        ),
    ),
]

# -----------------------------------------------------------------------------
# Rendering core (mirrors apply_relative_shading's LIGHT branch with explicit
# knobs; identical math, no shared-module mutation)
# -----------------------------------------------------------------------------

def render_light(
    template_rgb_bbox: np.ndarray,
    alpha_bbox: np.ndarray,
    fabric_bbox: np.ndarray,
    *,
    base_shading_strength: float,
    base_detail_blend: float,
    base_shading_clip: tuple[float, float],
    strength_cap: float,
    detail_cap: float,
    clip_floor: float,
    clip_ceil: float,
    knee: float,
    ceil: float,
) -> np.ndarray:
    """Standalone copy of the LIGHT branch — same formula as
    `apply_relative_shading` but every constant is an argument so the matrix
    can sweep them without changing the shared defaults."""
    lum = srgb_luminance(template_rgb_bbox)
    vis = alpha_bbox > (ALPHA_THRESHOLD / 255.0)
    mean_lum = float(np.mean(lum[vis])) if np.any(vis) else float(np.mean(lum))
    mean_lum = max(mean_lum, 1e-4)

    eff_strength = min(base_shading_strength, strength_cap)
    eff_detail   = min(base_detail_blend, detail_cap)
    lo, hi = base_shading_clip
    eff_clip = (max(lo, clip_floor), min(hi, clip_ceil))

    ratio = lum / mean_lum
    shading = np.clip(1.0 + (ratio - 1.0) * eff_strength, eff_clip[0], eff_clip[1])
    shaded_raw = fabric_bbox * shading[..., None]

    headroom = max(ceil - knee, 1e-6)
    over = shaded_raw > knee
    if np.any(over):
        excess = np.maximum(shaded_raw - knee, 0.0)
        soft = knee + headroom * (1.0 - np.exp(-excess / headroom))
        shaded = np.where(over, soft, shaded_raw)
    else:
        shaded = shaded_raw
    shaded = np.clip(shaded, 0.0, 1.0)

    result = (1.0 - eff_detail) * shaded + eff_detail * template_rgb_bbox
    return np.clip(result, 0.0, 1.0)


def render_one(template_path: Path, fabric_pil: Image.Image,
               profile: dict, tile_size: int) -> Image.Image:
    """Full v2-shaped render for one (template, fabric, profile, tile) cell."""
    template = Image.open(str(template_path)).convert("RGBA")
    arr = np.array(template, dtype=np.float32) / 255.0
    template_rgb = arr[..., :3]
    alpha = arr[..., 3]
    H, W = arr.shape[:2]

    alpha_u8 = (alpha * 255.0).astype(np.uint8)
    garment_mask = alpha_u8 > ALPHA_THRESHOLD
    if not np.any(garment_mask):
        return template  # transparent passthrough

    ys, xs = np.where(garment_mask)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1

    rgb_bb   = template_rgb[y0:y1, x0:x1, :]
    alpha_bb = alpha[y0:y1, x0:x1]
    vis_bb   = alpha_bb > (ALPHA_THRESHOLD / 255.0)
    tiled    = _shirt_make_tiled_fabric(fabric_pil, W, H, tile_size, 0)
    fab_bb   = tiled[y0:y1, x0:x1, :].copy()

    shaded_bb = render_light(
        rgb_bb, alpha_bb, fab_bb,
        base_shading_strength=SHADING_STRENGTH,
        base_detail_blend=DETAIL_BLEND,
        base_shading_clip=(0.3, 1.4),   # blazer profile shading_clip
        **profile,
    )

    out = arr.copy()
    view = out[y0:y1, x0:x1, :3]
    view[vis_bb] = shaded_bb[vis_bb]
    out[..., 3] = alpha
    return Image.fromarray((out * 255.0).astype(np.uint8), mode="RGBA")


# -----------------------------------------------------------------------------
# Contact-sheet composition
# -----------------------------------------------------------------------------

LABEL_BAR_H = 28
CELL_PAD    = 12
THUMB_W     = 320   # final thumb width per garment in the contact sheet


def _thumb(img: Image.Image, target_w: int) -> Image.Image:
    """Resize an RGBA PNG to `target_w` (preserve aspect, flatten onto white)."""
    ratio = target_w / img.width
    new_size = (target_w, max(1, int(round(img.height * ratio))))
    resized = img.resize(new_size, Image.LANCZOS)
    bg = Image.new("RGB", new_size, (245, 240, 232))   # cream backdrop
    bg.paste(resized, (0, 0), resized)
    return bg


def _label(text: str, w: int, h: int = LABEL_BAR_H) -> Image.Image:
    from PIL import ImageDraw, ImageFont
    bar = Image.new("RGB", (w, h), (35, 39, 53))     # navy
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((w - tw) // 2, (h - th) // 2 - 1), text, fill=(245, 240, 232), font=font)
    return bar


def build_contact_sheet(renders: dict, out_path: Path) -> Path:
    """Assemble a grid: rows=profile, cols=tile_size, each cell = blazer + pant."""
    from PIL import ImageDraw

    # Build one thumb-cell (blazer + pant side-by-side) per (profile, tile)
    # so all cells share the same dimensions even though the templates differ.
    sample = next(iter(renders.values()))
    blazer_thumb = _thumb(sample["blazer"], THUMB_W)
    pant_thumb   = _thumb(sample["pant"], THUMB_W)
    cell_h = max(blazer_thumb.height, pant_thumb.height)
    cell_w = THUMB_W * 2 + CELL_PAD

    profile_labels = [p[0] for p in PROFILES]
    n_rows = len(profile_labels)
    n_cols = len(TILE_SIZES)

    row_label_w = 180
    col_label_h = LABEL_BAR_H
    inner_pad   = 14

    sheet_w = row_label_w + n_cols * (cell_w + inner_pad) + inner_pad
    sheet_h = col_label_h + n_rows * (cell_h + LABEL_BAR_H + inner_pad) + inner_pad

    sheet = Image.new("RGB", (sheet_w, sheet_h), (250, 247, 240))

    # Column headers
    for ci, ts in enumerate(TILE_SIZES):
        x0 = row_label_w + inner_pad + ci * (cell_w + inner_pad)
        sheet.paste(_label(f"tile_size = {ts}px", cell_w, col_label_h), (x0, 0))

    # Rows
    for ri, prof_name in enumerate(profile_labels):
        y_top = col_label_h + ri * (cell_h + LABEL_BAR_H + inner_pad)
        # Row label (rotated-ish: just a vertical bar with text)
        row_bar = _label(prof_name, cell_h + LABEL_BAR_H,
                         h=row_label_w - 4).rotate(90, expand=True)
        sheet.paste(row_bar, (0, y_top))

        for ci, ts in enumerate(TILE_SIZES):
            key = (prof_name, ts)
            cell_render = renders[key]
            bt = _thumb(cell_render["blazer"], THUMB_W)
            pt = _thumb(cell_render["pant"], THUMB_W)
            x_left = row_label_w + inner_pad + ci * (cell_w + inner_pad)

            sheet.paste(bt, (x_left, y_top))
            sheet.paste(pt, (x_left + THUMB_W + CELL_PAD, y_top))

            sub = _label("blazer  |  pant", cell_w, LABEL_BAR_H)
            sheet.paste(sub, (x_left, y_top + cell_h))

    # Footer
    footer_y = sheet_h - LABEL_BAR_H + 4
    draw = ImageDraw.Draw(sheet)
    try:
        from PIL import ImageFont
        font_small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 11)
    except Exception:
        font_small = None
    draw.text((inner_pad, footer_y), "fabric: light/blue-ish "
              "custom_byeaz_izgili (mean_lum ≈ 0.735) — see README.txt for profile knobs",
              fill=(80, 80, 90), font=font_small)

    sheet.save(str(out_path))
    return out_path


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main():
    fabric_path = Path(os.environ.get("FABRIC_PATH", str(DEFAULT_FABRIC)))
    if not fabric_path.exists():
        print(f"[err] fabric not found: {fabric_path}")
        return 1
    if not BLAZER_TEMPLATE.exists():
        print(f"[err] blazer template not found: {BLAZER_TEMPLATE}")
        return 1
    if not PANT_TEMPLATE.exists():
        print(f"[err] pant template not found: {PANT_TEMPLATE}")
        return 1

    # Reset output dir for a clean matrix (only under /tmp by default).
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    (OUT_ROOT / "blazer").mkdir(parents=True, exist_ok=True)
    (OUT_ROOT / "pant").mkdir(parents=True, exist_ok=True)

    fabric_pil = Image.open(str(fabric_path)).convert("RGB")
    fabric_lum = float(srgb_luminance(np.array(fabric_pil, dtype=np.float32) / 255.0).mean())
    is_light = fabric_lum >= LIGHT_FABRIC_THRESHOLD
    print(f"[calib] fabric: {fabric_path.relative_to(ROOT)}")
    print(f"[calib]   mean_lum={fabric_lum:.3f}  "
          f"{'(triggers light branch)' if is_light else '(NOT a light fabric — light profiles are still rendered for inspection)'}")
    print(f"[calib]   threshold={LIGHT_FABRIC_THRESHOLD}")
    print(f"[calib] blazer template: {BLAZER_TEMPLATE.relative_to(ROOT)}")
    print(f"[calib] pant   template: {PANT_TEMPLATE.relative_to(ROOT)}")
    print(f"[calib] writing matrix → {OUT_ROOT}/")

    # The same seamless tile is used for every render so pattern noise cannot
    # leak into the visual differences between profiles.
    seamless = _shirt_make_seamless(fabric_pil, SHIRT_SEAMLESS_OVERLAP)

    renders: dict[tuple[str, int], dict[str, Image.Image]] = {}
    for prof_name, prof_kwargs in PROFILES:
        for tile in TILE_SIZES:
            blazer_out = render_one(BLAZER_TEMPLATE, seamless, prof_kwargs, tile)
            pant_out   = render_one(PANT_TEMPLATE,   seamless, prof_kwargs, tile)
            blazer_path = OUT_ROOT / "blazer" / f"{prof_name}__tile{tile}.png"
            pant_path   = OUT_ROOT / "pant"   / f"{prof_name}__tile{tile}.png"
            blazer_out.save(str(blazer_path))
            pant_out.save(str(pant_path))
            renders[(prof_name, tile)] = {"blazer": blazer_out, "pant": pant_out}
            print(f"  [{prof_name}] tile={tile}  → {blazer_path.name}, {pant_path.name}")

    # Contact sheet
    sheet_path = build_contact_sheet(renders, OUT_ROOT / "contact_sheet.png")
    print(f"[calib] contact sheet → {sheet_path}")

    # Readme legend
    with open(OUT_ROOT / "README.txt", "w") as fh:
        fh.write("fabric-engine calibration matrix\n")
        fh.write("=================================\n\n")
        fh.write(f"fabric:           {fabric_path}\n")
        fh.write(f"  mean luminance: {fabric_lum:.3f}\n")
        fh.write(f"  threshold:      {LIGHT_FABRIC_THRESHOLD}\n\n")
        fh.write(f"blazer template:  {BLAZER_TEMPLATE}\n")
        fh.write(f"pant   template:  {PANT_TEMPLATE}\n\n")
        fh.write(f"tile sizes:       {TILE_SIZES}\n\n")
        fh.write("Profiles\n")
        fh.write("--------\n")
        for prof_name, prof_kwargs in PROFILES:
            fh.write(f"\n{prof_name}\n")
            for k, v in prof_kwargs.items():
                fh.write(f"    {k:14s} = {v}\n")
        fh.write("\nNothing in this directory is read by the production pipeline.\n")
    print(f"[calib] legend → {OUT_ROOT / 'README.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
