#!/usr/bin/env python3
"""
Apply a fabric texture onto vest-layer PNGs (RGBA).

Reads layer configuration from vest/vest-white_config.json. Select a lapel
style and hip-pocket style below — the script assembles the correct layer
stack automatically.

Requires:
  pip install pillow numpy
"""

from pathlib import Path
import json
import shutil
import numpy as np
from PIL import Image

# =========================
# CONFIG
# =========================
FABRIC_PATH = Path("test3.jpg")
CONFIG_PATH = Path("vest/vest-white_config.json")
OUT_DIR     = Path("textured_vest_layers")
OUT_SUFFIX  = "_fabric"

# --- Vest selection ---
# lapel_style: one of the keys in vest-white_config.json "lapels"
#   single-4btn-narrow-notch | single-4btn-narrow-peak |
#   single-4btn-medium-notch | single-4btn-medium-peak | single-4btn-shawl |
#   single-5btn-narrow-notch | single-5btn-narrow-peak |
#   single-5btn-medium-notch | single-5btn-medium-peak | single-5btn-shawl |
#   double-6btn-narrow-notch | double-6btn-narrow-peak |
#   double-6btn-medium-notch | double-6btn-medium-peak | double-6btn-shawl
LAPEL_STYLE = "single-4btn-shawl"

# hip_pocket_style: one of the keys in vest-white_config.json "hip-pocket"
#   hip_pockets_welt-single_breasted |
#   hip_pockets_with_flap-single_breasted |
#   hip_pockets_double_welt-single_breasted
HIP_POCKET_STYLE = "hip_pockets_welt-single_breasted"

# =========================
# TUNING
# =========================
TILE_SIZE_PX     = 260
SEAMLESS_OVERLAP = 0.15
DETAIL_BLEND     = 0.12
SHADING_STRENGTH = 1.0
FABRIC_ROTATE_DEG = 0   # global pre-rotation of the fabric image (0/90/180/270)
ALPHA_THRESHOLD  = 8


# =========================
# HELPERS
# =========================

def srgb_luminance(rgb_float01: np.ndarray) -> np.ndarray:
    return (0.2126 * rgb_float01[..., 0]
            + 0.7152 * rgb_float01[..., 1]
            + 0.0722 * rgb_float01[..., 2])


def make_seamless(img: Image.Image, overlap_percent: float = 0.15) -> Image.Image:
    arr = np.array(img).astype(float) / 255.0
    h, w, c = arr.shape
    dy = int(h * overlap_percent)
    dx = int(w * overlap_percent)
    if dy < 1 or dx < 1:
        return img

    alpha_x = np.linspace(1.0, 0.0, dx).reshape(1, dx, 1)
    left_strip  = arr[:, :dx, :]
    right_strip = arr[:, w - dx:, :]
    blended_x   = right_strip * alpha_x + left_strip * (1.0 - alpha_x)
    arr_h = np.concatenate([blended_x, arr[:, dx:w - dx, :]], axis=1)

    h2, _, _ = arr_h.shape
    alpha_y    = np.linspace(1.0, 0.0, dy).reshape(dy, 1, 1)
    top_strip    = arr_h[:dy, :, :]
    bottom_strip = arr_h[h2 - dy:, :, :]
    blended_y  = bottom_strip * alpha_y + top_strip * (1.0 - alpha_y)
    arr_final  = np.concatenate([blended_y, arr_h[dy:h2 - dy, :]], axis=0)

    return Image.fromarray((arr_final * 255).astype(np.uint8))


def make_tiled_fabric(fabric_rgb: Image.Image, w: int, h: int,
                      tile_size_px: int, rotation_deg: float = 0) -> Image.Image:
    fw, fh = fabric_rgb.size
    scale = tile_size_px / max(1, fw)
    tw = max(1, int(round(fw * scale)))
    th = max(1, int(round(fh * scale)))
    tile = fabric_rgb.resize((tw, th), Image.Resampling.LANCZOS)

    if rotation_deg == 0:
        canvas = Image.new("RGB", (w, h))
        for y in range(0, h, th):
            for x in range(0, w, tw):
                canvas.paste(tile, (x, y))
        return canvas

    diag = int(np.ceil(np.sqrt(w * w + h * h))) + tw + th
    big  = Image.new("RGB", (diag, diag))
    for y in range(0, diag, th):
        for x in range(0, diag, tw):
            big.paste(tile, (x, y))

    rotated = big.rotate(rotation_deg, resample=Image.Resampling.BICUBIC, expand=False)

    rx, ry = rotated.size
    cx, cy = rx // 2, ry // 2
    x0 = max(0, cx - w // 2)
    y0 = max(0, cy - h // 2)
    cropped = rotated.crop((x0, y0, x0 + w, y0 + h))
    if cropped.size != (w, h):
        cropped = cropped.resize((w, h), Image.Resampling.LANCZOS)
    return cropped


def apply_shading(rgb_bbox: np.ndarray, alpha_bbox: np.ndarray,
                  fabric_arr: np.ndarray) -> np.ndarray:
    lum      = srgb_luminance(rgb_bbox)
    vis      = alpha_bbox > (ALPHA_THRESHOLD / 255.0)
    mean_lum = float(np.mean(lum[vis])) if np.any(vis) else float(np.mean(lum))
    mean_lum = max(mean_lum, 1e-4)
    shading  = np.clip((lum / mean_lum) ** SHADING_STRENGTH, 0.0, 3.0)
    shaded   = np.clip(fabric_arr * shading[..., None], 0.0, 1.0)
    result   = np.clip((1.0 - DETAIL_BLEND) * shaded + DETAIL_BLEND * rgb_bbox, 0.0, 1.0)
    return result


# =========================
# MAIN PROCESSING
# =========================

def polygon_mask(polygon: list, h: int, w: int) -> np.ndarray:
    from PIL import ImageDraw
    img = Image.new("L", (w, h), 0)
    ImageDraw.Draw(img).polygon(polygon, fill=255)
    return np.array(img) > 0


def apply_fabric_to_layer(layer_path: Path, fabric_rgb: Image.Image,
                          out_dir: Path,
                          rotation: float = 0,
                          zones: list | None = None) -> Path:
    layer = Image.open(layer_path).convert("RGBA")
    arr   = np.array(layer).astype(np.float32) / 255.0
    rgb   = arr[..., :3]
    alpha = arr[..., 3]
    H, W  = arr.shape[:2]

    out_path = out_dir / f"{layer_path.stem}{OUT_SUFFIX}.png"

    if np.max(alpha) <= 0.0:
        layer.save(out_path)
        return out_path

    alpha_u8     = (alpha * 255.0).astype(np.uint8)
    garment_mask = alpha_u8 > ALPHA_THRESHOLD
    if not np.any(garment_mask):
        layer.save(out_path)
        return out_path

    ys, xs = np.where(garment_mask)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    bw, bh = x1 - x0, y1 - y0

    rgb_bbox   = rgb[y0:y1, x0:x1, :]
    alpha_bbox = alpha[y0:y1, x0:x1]
    out_rgb    = rgb.copy()

    if zones:
        full_base = np.array(make_tiled_fabric(fabric_rgb, W, H, TILE_SIZE_PX, rotation)).astype(np.float32) / 255.0
        result    = apply_shading(rgb_bbox, alpha_bbox, full_base[y0:y1, x0:x1, :])

        for zone in zones:
            poly = zone["polygon"]
            rot  = zone.get("rotation", rotation)

            local_poly = [(x - x0, y - y0) for x, y in poly]
            zmask = polygon_mask(local_poly, bh, bw)
            if not np.any(zmask):
                continue

            full_zone   = np.array(make_tiled_fabric(fabric_rgb, W, H, TILE_SIZE_PX, rot)).astype(np.float32) / 255.0
            zone_result = apply_shading(rgb_bbox, alpha_bbox, full_zone[y0:y1, x0:x1, :])
            result[zmask] = zone_result[zmask]

    else:
        full_tiled = np.array(make_tiled_fabric(fabric_rgb, W, H, TILE_SIZE_PX, rotation)).astype(np.float32) / 255.0
        result     = apply_shading(rgb_bbox, alpha_bbox, full_tiled[y0:y1, x0:x1, :])

    out_rgb[y0:y1, x0:x1, :] = result

    out = np.zeros_like(arr)
    out[..., :3] = out_rgb
    out[..., 3]  = alpha
    Image.fromarray((out * 255.0).astype(np.uint8), mode="RGBA").save(out_path)
    return out_path


def load_layer_configs(config_path: Path, lapel_style: str,
                       hip_pocket_style: str) -> list[dict]:
    """
    Read vest-white_config.json and return a flat ordered list of layer dicts:
      { "path": Path, "fabric": bool, "rotation": float, "zones": list|None }

    Layers are ordered by z-index so they composite correctly.
    """
    with open(config_path) as f:
        cfg = json.load(f)

    raw_layers: list[dict] = []

    # Base (always included)
    for entry in cfg["base"]:
        raw_layers.append(entry)

    # Selected lapel
    lapel_key = lapel_style.lower()
    if lapel_key not in cfg["lapels"]:
        raise ValueError(f"Unknown lapel style '{lapel_style}'. "
                         f"Valid: {list(cfg['lapels'].keys())}")
    for entry in cfg["lapels"][lapel_key]["layers"]:
        raw_layers.append(entry)

    # Selected hip pocket
    hip_key = hip_pocket_style.lower()
    if hip_key not in cfg["hip-pocket"]:
        raise ValueError(f"Unknown hip-pocket style '{hip_pocket_style}'. "
                         f"Valid: {list(cfg['hip-pocket'].keys())}")
    for entry in cfg["hip-pocket"][hip_key]["layers"]:
        raw_layers.append(entry)

    # Sort by z-index and convert paths
    raw_layers.sort(key=lambda e: e["z"])
    result = []
    for entry in raw_layers:
        result.append({
            "path":     Path(entry["path"]),
            "fabric":   entry.get("fabric", True),
            "rotation": entry.get("rotation", 0),
            # JSON polygons are [[x,y],...]; convert to [(x,y),...] for PIL
            "zones":    [
                {"polygon": [tuple(pt) for pt in z["polygon"]], "rotation": z["rotation"]}
                for z in entry["zones"]
            ] if entry.get("zones") else None,
        })
    return result


def main():
    if not FABRIC_PATH.exists():
        print(f"Fabric not found: {FABRIC_PATH}")
        return
    if not CONFIG_PATH.exists():
        print(f"Config not found: {CONFIG_PATH}")
        return

    try:
        layer_configs = load_layer_configs(CONFIG_PATH, LAPEL_STYLE, HIP_POCKET_STYLE)
    except ValueError as e:
        print(f"Config error: {e}")
        return

    print(f"Vest: lapel={LAPEL_STYLE}  hip-pocket={HIP_POCKET_STYLE}")
    print(f"Layers: {len(layer_configs)} total "
          f"({sum(1 for l in layer_configs if l['fabric'])} fabric, "
          f"{sum(1 for l in layer_configs if not l['fabric'])} pass-through)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fabric = Image.open(FABRIC_PATH).convert("RGB")
    print("Synthesizing seamless texture...")
    fabric = make_seamless(fabric, overlap_percent=SEAMLESS_OVERLAP)
    if FABRIC_ROTATE_DEG in (90, 180, 270):
        fabric = fabric.rotate(FABRIC_ROTATE_DEG, expand=True)

    print("Processing layers...")
    outputs = []
    for layer_cfg in layer_configs:
        layer_path = layer_cfg["path"]
        if not layer_path.exists():
            print(f"  Skipping (not found): {layer_path}")
            continue

        out_path = OUT_DIR / f"{layer_path.stem}{OUT_SUFFIX}.png"

        if not layer_cfg["fabric"]:
            shutil.copy2(layer_path, out_path)
            outputs.append(out_path)
            print(f"  Copied:     {layer_path.name}")
            continue

        try:
            out_path = apply_fabric_to_layer(
                layer_path, fabric, OUT_DIR,
                rotation=layer_cfg["rotation"],
                zones=layer_cfg["zones"],
            )
            outputs.append(out_path)
            print(f"  Processed:  {layer_path.name}")
        except Exception as e:
            print(f"  Error processing {layer_path.name}: {e}")

    print(f"\nDone. Wrote {len(outputs)} files to {OUT_DIR}/")
    for p in outputs:
        print(" -", p)


if __name__ == "__main__":
    main()
