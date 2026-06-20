#!/usr/bin/env python3
"""
Full composite preview for the final calibration choice.

For each candidate profile, render every layer the frontend configurator
would render with the DEFAULT selection (single-breasted 2-button, standard
notch lapel, with-flap pocket; off-centered fastening, no pleats) and
composite them in zIndex order — the same way the React configurator
stacks the per-fabric PNGs.

Outputs land under /tmp/fabric-full-composite-final-check/ ONLY.  Nothing
under public/assets/ is touched.  No production PNGs are overwritten and
no bulk regen runs.

Run:
    cd fabric-engine
    python3 tools/composite_preview.py
"""

from __future__ import annotations

import os
import sys
import json
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

# Reuse the standalone light-branch renderer from calibration_matrix so the
# composite preview shares its math exactly.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from calibration_matrix import render_light  # noqa: E402

# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------

DEFAULT_FABRIC = ROOT / "public/assets/blazer/generated-fabrics/custom_byeaz_izgili/source.png"
BLAZER_ROOT = ROOT / "public/assets/blazer"
PANT_ROOT   = ROOT / "public/assets/pant"

OUT_ROOT = Path(os.environ.get("PREVIEW_OUT_DIR",
                                "/tmp/fabric-full-composite-final-check"))
TILE_SIZE = 260   # the size chosen during the matrix review

# Default jacket selection — matches the React DEFAULT_SELECTION at
# frontend/src/components/JacketConfigurator.tsx:73-80.
JACKET_SEL = dict(
    breastStyle="single",
    buttonCount=2,
    lapelWidth="standard",
    lapelStyle="notch",
    pocketStyle="with_flap",
    pocketThird=False,
)
# Default pant selection — matches the standalone pant_blender.py.
PANT_FASTENING = "off-centered"
PANT_PLEATS    = "none"

# -----------------------------------------------------------------------------
# Profile candidates — the three the user shortlisted from the matrix review.
# Profile dicts mirror calibration_matrix.PROFILES so render_light accepts
# them directly via **kwargs.
# -----------------------------------------------------------------------------

CANDIDATE_PROFILES: list[tuple[str, dict]] = [
    (
        "A_stronger_texture",      # leading candidate
        dict(strength_cap=1.0,
             detail_cap=LIGHT_FABRIC_DETAIL_CAP,
             clip_floor=LIGHT_FABRIC_CLIP_FLOOR,
             clip_ceil=LIGHT_FABRIC_CLIP_CEIL,
             knee=LIGHT_FABRIC_SHOULDER_KNEE,
             ceil=LIGHT_FABRIC_SHOULDER_CEIL),
    ),
    (
        "B_more_depth",
        dict(strength_cap=0.85,
             detail_cap=0.10,
             clip_floor=0.40,
             clip_ceil=LIGHT_FABRIC_CLIP_CEIL,
             knee=LIGHT_FABRIC_SHOULDER_KNEE,
             ceil=LIGHT_FABRIC_SHOULDER_CEIL),
    ),
    (
        "C_soft_reference",        # current module default (control)
        dict(strength_cap=LIGHT_FABRIC_STRENGTH_CAP,
             detail_cap=LIGHT_FABRIC_DETAIL_CAP,
             clip_floor=LIGHT_FABRIC_CLIP_FLOOR,
             clip_ceil=LIGHT_FABRIC_CLIP_CEIL,
             knee=LIGHT_FABRIC_SHOULDER_KNEE,
             ceil=LIGHT_FABRIC_SHOULDER_CEIL),
    ),
]

# -----------------------------------------------------------------------------
# Jacket layer pick — port of frontend composeLayers().
# Ref: frontend/src/components/JacketConfigurator.tsx:223-336.
# -----------------------------------------------------------------------------

def _jacket_base_matches(layer: dict, breast_style: str) -> bool:
    opts = layer.get("options", {})
    if opts.get("breastStyle"):
        return opts["breastStyle"] == breast_style
    bp = opts.get("bodyPart")
    mao_specific     = bp in ("espalda_arriba_mao", "negra_mao")
    non_mao_specific = bp in ("espalda_arriba", "negra")
    if mao_specific:
        return breast_style == "mao"
    if non_mao_specific:
        return breast_style != "mao"
    return True


def _is_pocket_eligible_cut(sel: dict) -> bool:
    if sel["lapelWidth"] != "wide":
        return False
    if sel["breastStyle"] == "single":
        return sel["buttonCount"] in (1, 2)
    if sel["breastStyle"] == "double":
        return sel["buttonCount"] == 2
    return False


def compose_jacket_layers(manifest: dict, sel: dict) -> list[dict]:
    cat = manifest["categories"]
    picked: list[dict] = []
    suppressed_breast_pocket = False

    for l in cat.get("base", []):
        if _jacket_base_matches(l, sel["breastStyle"]):
            picked.append(l)

    if sel["breastStyle"] == "mao":
        for l in cat.get("lapels", []):
            if l.get("kind") == "neck" and l.get("options", {}).get("breastStyle") == "mao":
                picked.append(l)
                break
    else:
        for l in cat.get("lapels", []):
            o = l.get("options", {})
            if (l.get("kind") == "neck"
                and o.get("breastStyle") == sel["breastStyle"]
                and o.get("buttonCount") == sel["buttonCount"]
                and o.get("lapelWidth")  == sel["lapelWidth"]
                and o.get("lapelStyle")  == sel["lapelStyle"]):
                picked.append(l)
                break
        if _is_pocket_eligible_cut(sel):
            for l in cat.get("lapels", []):
                o = l.get("options", {})
                if (l.get("kind") == "neckWithBreastPocket"
                    and o.get("breastStyle") == sel["breastStyle"]
                    and o.get("buttonCount") == sel["buttonCount"]
                    and o.get("lapelWidth")  == sel["lapelWidth"]
                    and o.get("lapelStyle")  == sel["lapelStyle"]):
                    picked.append(l)
                    suppressed_breast_pocket = True
                    break

    for l in cat.get("hip-pocket", []):
        kind = l.get("kind")
        if kind == "breastPocket":
            if sel["breastStyle"] == "mao":
                continue
            if suppressed_breast_pocket:
                continue
            picked.append(l)
        elif kind == "hipPocket":
            o = l.get("options", {})
            if o.get("pocketStyle") != sel["pocketStyle"]:
                continue
            is_third = bool(o.get("third"))
            if not is_third:
                picked.append(l)
            elif sel.get("pocketThird"):
                picked.append(l)

    # Defensive z-order guard — keep back lining strictly behind the body shell.
    body_part = "negra_mao" if sel["breastStyle"] == "mao" else "negra"
    body_layer = next((l for l in picked
                       if l.get("options", {}).get("bodyPart") == body_part), None)
    if body_layer is not None:
        lining = ({"espalda_arriba_mao", "espalda_abajo"}
                  if sel["breastStyle"] == "mao"
                  else {"espalda_arriba", "espalda_abajo"})
        for i, l in enumerate(picked):
            if (l.get("options", {}).get("bodyPart") in lining
                and l["zIndex"] >= body_layer["zIndex"]):
                picked[i] = dict(l, zIndex=body_layer["zIndex"] - 1)

    picked.sort(key=lambda l: (l["zIndex"], l["file"]))
    return picked


# -----------------------------------------------------------------------------
# Pant layer pick — replicates pant_blender.load_layer_configs.
# -----------------------------------------------------------------------------

def compose_pant_layers(cfg: dict, fastening: str, pleats: str) -> list[dict]:
    layers: list[dict] = list(cfg.get("base", []))
    if fastening not in cfg.get("fastenings", {}):
        raise ValueError(f"unknown pant fastening: {fastening}")
    layers.extend(cfg["fastenings"][fastening].get("layers", []))
    if pleats not in cfg.get("pleats", {}):
        raise ValueError(f"unknown pant pleat style: {pleats}")
    layers.extend(cfg["pleats"][pleats].get("layers", []))
    layers.sort(key=lambda e: e.get("z", 0))
    return layers


# -----------------------------------------------------------------------------
# Per-layer renderer  (mirrors apply_fabric_to_layer_v2 minus the file write)
# -----------------------------------------------------------------------------

def render_layer_image(
    template_path: Path,
    fabric_pil: Image.Image,
    profile_kwargs: dict,
    tile_size: int,
) -> Image.Image:
    template = Image.open(str(template_path)).convert("RGBA")
    arr = np.array(template, dtype=np.float32) / 255.0
    template_rgb = arr[..., :3]
    alpha = arr[..., 3]
    H, W = arr.shape[:2]

    alpha_u8 = (alpha * 255.0).astype(np.uint8)
    garment_mask = alpha_u8 > ALPHA_THRESHOLD
    if not np.any(garment_mask):
        return template

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
        base_shading_clip=(0.3, 1.4),
        **profile_kwargs,
    )

    out = arr.copy()
    view = out[y0:y1, x0:x1, :3]
    view[vis_bb] = shaded_bb[vis_bb]
    out[..., 3] = alpha
    return Image.fromarray((out * 255.0).astype(np.uint8), mode="RGBA")


def composite_layers(
    layer_descriptors: list[tuple[Path, bool, int]],
    fabric_pil: Image.Image,
    profile_kwargs: dict,
    tile_size: int,
    canvas_size: tuple[int, int],
) -> Image.Image:
    """Stack PNGs in zIndex order using alpha compositing onto a transparent
    canvas. Fabric-dependent layers go through render_layer_image; non-fabric
    layers are loaded raw."""
    W, H = canvas_size
    base = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for path, is_fabric, _z in layer_descriptors:
        if not path.exists():
            continue
        if is_fabric:
            layer_img = render_layer_image(path, fabric_pil, profile_kwargs, tile_size)
        else:
            layer_img = Image.open(str(path)).convert("RGBA")
        if layer_img.size != (W, H):
            # Defensive — should not happen with matched assets, but resize
            # rather than crash if a sibling layer disagrees on dimensions.
            layer_img = layer_img.resize((W, H), Image.LANCZOS)
        base = Image.alpha_composite(base, layer_img)
    return base


# -----------------------------------------------------------------------------
# Contact sheet
# -----------------------------------------------------------------------------

CONTACT_THUMB_W = 360
LABEL_BAR_H     = 28
INNER_PAD       = 14


def _thumb(img: Image.Image, target_w: int) -> Image.Image:
    ratio = target_w / img.width
    size = (target_w, max(1, int(round(img.height * ratio))))
    resized = img.resize(size, Image.LANCZOS)
    bg = Image.new("RGB", size, (245, 240, 232))  # cream backdrop
    bg.paste(resized, (0, 0), resized)
    return bg


def _label(text: str, w: int, h: int = LABEL_BAR_H,
           bg=(35, 39, 53), fg=(245, 240, 232)) -> Image.Image:
    from PIL import ImageDraw, ImageFont
    bar = Image.new("RGB", (w, h), bg)
    draw = ImageDraw.Draw(bar)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((w - tw) // 2, (h - th) // 2 - 1), text, fill=fg, font=font)
    return bar


def build_contact_sheet(grid: dict, out_path: Path) -> Path:
    """grid: {(garment, profile): PIL Image}. Rows=garment, cols=profile."""
    garments = ["blazer", "pant", "suit"]
    profiles = [p[0] for p in CANDIDATE_PROFILES]
    thumbs = {(g, p): _thumb(grid[(g, p)], CONTACT_THUMB_W)
              for g in garments for p in profiles}

    # Pre-compute per-row height (each row's max thumb height).
    row_h = {g: max(thumbs[(g, p)].height for p in profiles) for g in garments}
    col_w = CONTACT_THUMB_W

    row_label_w = 110
    col_label_h = LABEL_BAR_H

    sheet_w = row_label_w + len(profiles) * (col_w + INNER_PAD) + INNER_PAD
    sheet_h = col_label_h + sum(row_h[g] + LABEL_BAR_H + INNER_PAD for g in garments) + INNER_PAD

    sheet = Image.new("RGB", (sheet_w, sheet_h), (250, 247, 240))

    # Column headers
    for ci, prof in enumerate(profiles):
        x0 = row_label_w + INNER_PAD + ci * (col_w + INNER_PAD)
        sheet.paste(_label(prof, col_w, col_label_h), (x0, 0))

    # Rows
    y_cursor = col_label_h
    for g in garments:
        # Row label (rotated)
        row_bar = _label(g.upper(), row_h[g] + LABEL_BAR_H,
                         h=row_label_w - 4, bg=(198, 161, 91), fg=(35, 31, 26))
        row_bar = row_bar.rotate(90, expand=True)
        sheet.paste(row_bar, (0, y_cursor))

        for ci, prof in enumerate(profiles):
            x_left = row_label_w + INNER_PAD + ci * (col_w + INNER_PAD)
            sheet.paste(thumbs[(g, prof)], (x_left, y_cursor))
            sub = _label(f"{g}  ·  {prof}  ·  tile={TILE_SIZE}",
                         col_w, LABEL_BAR_H,
                         bg=(244, 238, 226), fg=(60, 55, 45))
            sheet.paste(sub, (x_left, y_cursor + row_h[g]))

        y_cursor += row_h[g] + LABEL_BAR_H + INNER_PAD

    sheet.save(str(out_path))
    return out_path


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> int:
    fabric_path = Path(os.environ.get("FABRIC_PATH", str(DEFAULT_FABRIC)))
    if not fabric_path.exists():
        print(f"[err] fabric not found: {fabric_path}")
        return 1

    blazer_manifest_path = BLAZER_ROOT / "manifest.json"
    pant_config_path     = PANT_ROOT   / "pant_config.json"
    for p in (blazer_manifest_path, pant_config_path):
        if not p.exists():
            print(f"[err] missing: {p}")
            return 1

    # Reset output dir (only writes under /tmp by default).
    if OUT_ROOT.exists():
        shutil.rmtree(OUT_ROOT)
    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    # Fabric
    fabric_pil = Image.open(str(fabric_path)).convert("RGB")
    fabric_lum = float(srgb_luminance(
        np.array(fabric_pil, dtype=np.float32) / 255.0).mean())
    is_light = fabric_lum >= LIGHT_FABRIC_THRESHOLD
    print(f"[preview] fabric: {fabric_path.relative_to(ROOT)}  mean_lum={fabric_lum:.3f}  "
          f"{'(triggers light branch)' if is_light else '(NOT light — light profiles still rendered for inspection)'}")
    seamless = _shirt_make_seamless(fabric_pil, SHIRT_SEAMLESS_OVERLAP)

    # ---- Blazer layer pick (frontend default selection) -------------------
    blazer_manifest = json.loads(blazer_manifest_path.read_text())
    jacket_layers = compose_jacket_layers(blazer_manifest, JACKET_SEL)
    print(f"[preview] blazer layer stack ({len(jacket_layers)}):  "
          f"selection={JACKET_SEL}")
    for l in jacket_layers:
        print(f"    z={l['zIndex']:>4}  fabric={str(l.get('fabricDependent')):<5}  {l['file']}")

    # Resolve to absolute paths + flags
    blazer_descriptors: list[tuple[Path, bool, int]] = [
        (BLAZER_ROOT / l["file"], bool(l.get("fabricDependent", True)), l["zIndex"])
        for l in jacket_layers
    ]
    # Canvas size from the first available template
    bz_template = next((p for p, _f, _z in blazer_descriptors if p.exists()), None)
    if bz_template is None:
        print("[err] no blazer templates resolvable from manifest")
        return 1
    bz_w, bz_h = Image.open(str(bz_template)).size

    # ---- Pant layer pick (pant_blender defaults) --------------------------
    pant_cfg = json.loads(pant_config_path.read_text())
    pant_layers = compose_pant_layers(pant_cfg, PANT_FASTENING, PANT_PLEATS)
    print(f"[preview] pant layer stack ({len(pant_layers)}):  "
          f"fastening={PANT_FASTENING}  pleats={PANT_PLEATS}")
    for e in pant_layers:
        print(f"    z={e.get('z'):>4}  fabric={str(e.get('fabric')):<5}  {e.get('path')}")
    # pant_config.json uses a "pants/..." prefix that fabric_generator.py
    # strips before resolving against PANT_ROOT — mirror that here.
    pant_descriptors: list[tuple[Path, bool, int]] = [
        (PANT_ROOT / e["path"].replace("pants/", "", 1),
         bool(e.get("fabric", True)),
         e.get("z", 0))
        for e in pant_layers
    ]
    pt_template = next((p for p, _f, _z in pant_descriptors if p.exists()), None)
    if pt_template is None:
        print("[err] no pant templates resolvable")
        return 1
    pt_w, pt_h = Image.open(str(pt_template)).size

    # ---- Render every (garment, profile) cell -----------------------------
    grid: dict[tuple[str, str], Image.Image] = {}
    for prof_name, prof_kwargs in CANDIDATE_PROFILES:
        print(f"\n[preview] profile={prof_name}  tile_size={TILE_SIZE}")
        blazer_full = composite_layers(
            blazer_descriptors, seamless, prof_kwargs, TILE_SIZE, (bz_w, bz_h))
        pant_full = composite_layers(
            pant_descriptors,   seamless, prof_kwargs, TILE_SIZE, (pt_w, pt_h))

        # Suit view — vertical stack with a small overlap so the blazer hem
        # sits over the waistband area of the pant (matches how the React
        # configurators render them above each other).
        overlap = 40
        suit_w = max(bz_w, pt_w)
        suit_h = bz_h + pt_h - overlap
        suit = Image.new("RGBA", (suit_w, suit_h), (0, 0, 0, 0))
        # Pant first (bottom), then blazer on top so the hem covers the waist.
        suit.alpha_composite(pant_full,   ((suit_w - pt_w) // 2, bz_h - overlap))
        suit.alpha_composite(blazer_full, ((suit_w - bz_w) // 2, 0))

        prof_dir = OUT_ROOT / prof_name
        prof_dir.mkdir(parents=True, exist_ok=True)
        blazer_path = prof_dir / "blazer.png"
        pant_path   = prof_dir / "pant.png"
        suit_path   = prof_dir / "suit.png"
        blazer_full.save(str(blazer_path))
        pant_full.save(str(pant_path))
        suit.save(str(suit_path))
        print(f"    → {blazer_path.relative_to(OUT_ROOT)}, "
              f"{pant_path.relative_to(OUT_ROOT)}, {suit_path.relative_to(OUT_ROOT)}")

        grid[("blazer", prof_name)] = blazer_full
        grid[("pant",   prof_name)] = pant_full
        grid[("suit",   prof_name)] = suit

    sheet_path = build_contact_sheet(grid, OUT_ROOT / "contact_sheet.png")
    print(f"\n[preview] contact sheet → {sheet_path}")

    # Legend
    with open(OUT_ROOT / "README.txt", "w") as fh:
        fh.write("fabric-engine full composite preview\n")
        fh.write("=====================================\n\n")
        fh.write(f"fabric:     {fabric_path}\n")
        fh.write(f"  mean lum: {fabric_lum:.3f}  (threshold {LIGHT_FABRIC_THRESHOLD})\n\n")
        fh.write(f"jacket selection (frontend DEFAULT): {JACKET_SEL}\n")
        fh.write(f"pant fastening:  {PANT_FASTENING}\n")
        fh.write(f"pant pleats:     {PANT_PLEATS}\n")
        fh.write(f"tile_size:       {TILE_SIZE}\n\n")
        fh.write("Profiles\n--------\n")
        for prof_name, prof_kwargs in CANDIDATE_PROFILES:
            fh.write(f"\n{prof_name}\n")
            for k, v in prof_kwargs.items():
                fh.write(f"    {k:14s} = {v}\n")
        fh.write("\nNothing here is read by the production pipeline.\n")
        fh.write("Module defaults in fabric_generator.py were NOT changed.\n")
    print(f"[preview] legend → {OUT_ROOT / 'README.txt'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
