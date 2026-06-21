"""
fabric_generator.py — material-based blazer fabric generation.

Pipeline overview
─────────────────
1. preprocess_fabric()
     · Center-crop & resize to TILE_SIZE.
     · Remove broad lighting gradients (divide by heavy blur, re-apply mean colour).
     · Make tile seamless (cross-blend: overlap region faded against opposite edge).

2. build_material()
     · Separate the seamless tile into:
         base_colour  – average RGB (the fabric's dominant hue/value)
         texture_detail – normalised fine variation around the local average
     · material = base_colour × clip(detail, 0.1, 5)^TEXTURE_DETAIL_STRENGTH
     · Low strength → near-solid colour + subtle weave; high → raw texture dominant.

3. apply_fabric_to_layer()  (called per template layer)
     · Tile the material to the template canvas size at RENDER_TILE_SIZE.
     · Compute luminance of template RGB within visible pixels.
     · Normalize: shading = (lum / mean_lum) ** SHADING_STRENGTH, clipped 0..3.
     · Apply shading, then blend in DETAIL_BLEND fraction of the original template
       RGB to preserve fold/seam detail.
     · Composite back with the untouched original alpha channel.

Tuning guide
────────────
  SHADING_STRENGTH        Luminance contrast: 1.0 = natural, >1 = punchy, <1 = flat.
  DETAIL_BLEND            0 = pure shaded fabric; higher bleeds template RGB back in.
  TEXTURE_DETAIL_STRENGTH 0=solid colour, 1=full weave.  0.30–0.45 is the sweet spot.
  RENDER_TILE_SIZE        px of one tile on the jacket.  Smaller = finer/denser weave.
  SEAMLESS_OVERLAP        Cross-blend overlap ratio for make_seamless_crossblend().
  SHADING_MIN / SHADING_MAX  Legacy floor/ceiling kept for backward compatibility.
  SHADING_LUM_REFERENCE   Legacy calibration constant; no longer used in shading math.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from s3_assets import upload_generated_tree, upload_swatch

# NOTE: vest_blender.py and pant_blender.py are kept as standalone reference
# CLI scripts (mirrors of bugrahoca's blenders) but are no longer imported —
# generate_vest_layers / generate_pant_layers route through the canonical
# apply_fabric_to_layer_v2 path defined below.

# ---------------------------------------------------------------------------
# Module-level defaults  (overridable per call via generate_layers())
# ---------------------------------------------------------------------------

TILE_SIZE = 512               # resolution of the prepared texture tile (px)
RENDER_TILE_SIZE = 260        # rendered tile px on jacket-class garments
                              # (smaller = finer weave). Bumped 200 → 260 on
                              # 2026-05-21 to match the A_stronger_texture
                              # composite preview that was approved as the
                              # production default. Drives blazer / suit /
                              # tuxedo through RENDER_PROFILE_BLAZER below.
                              # main.py still exposes it as a per-upload Form
                              # field, so explicit user overrides still win
                              # (clamped to 60..600).
TEXTURE_DETAIL_STRENGTH = 0.35  # 0=solid, 1=raw weave
SHADING_STRENGTH = 1       # luminance shading contrast (1.0 = natural)
STRUCTURE_STRENGTH = 0.35     # legacy — accepted but unused in new shading path
SHADING_LUM_REFERENCE = 80    # legacy — kept for backward compat; not used in math
SHADING_MIN = 0.45            # legacy — kept for backward compat
SHADING_MAX = 1.05            # legacy — kept for backward compat

# New constants
TILE_SIZE_PX = 260            # default tile_size_px for apply_fabric_to_layer_v2
                              # (matches RENDER_TILE_SIZE since 2026-05-21)
SEAMLESS_OVERLAP = 0.15       # cross-blend overlap ratio
DETAIL_BLEND = 0.15           # fraction of original template RGB blended back in
ALPHA_THRESHOLD = 8           # minimum alpha to count as a visible pixel

# Shirt-specific tuning constants (separate from blazer/tuxedo pipeline)
SHIRT_TILE_SIZE_PX     = 260    # rendered tile size for shirt fabric (px)
SHIRT_SEAMLESS_OVERLAP = 0.15   # cross-blend overlap ratio for shirt seamless
SHIRT_DETAIL_BLEND     = 0.12   # fraction of template RGB blended back in for shirts
SHIRT_ALPHA_THRESHOLD  = 8      # minimum alpha to count as visible for shirts

# Light-fabric calibration constants.
# Light coloured fabrics (white, cream, light blue/grey, etc.) have very
# little headroom above mid-grey, so the default power-curve shading blows
# out the highlights and washes the hue toward white. apply_relative_shading
# detects "light" fabrics by mean luminance and switches to a gentler linear
# curve with a soft highlight shoulder.
# Values calibrated on 2026-05-21 via tools/calibration_matrix.py +
# tools/composite_preview.py: A_stronger_texture profile (strength_cap=1.0,
# everything else unchanged) was chosen over the "soft" and "more_depth"
# alternatives because it preserves weave variation on light fabrics without
# the grey-shadow contamination "more_depth" introduced or the flat look
# the "soft" reference produced.
LIGHT_FABRIC_THRESHOLD       = 0.72   # mean fabric luminance in [0,1] that flips on the light branch
LIGHT_FABRIC_STRENGTH_CAP    = 1.0    # shading_strength is capped to this when light branch is active
LIGHT_FABRIC_DETAIL_CAP      = 0.12   # detail_blend is capped to this so the grey template doesn't desaturate the fabric
LIGHT_FABRIC_CLIP_FLOOR      = 0.20   # lower bound applied to the shading multiplier
LIGHT_FABRIC_CLIP_CEIL       = 1.50   # upper bound applied to the shading multiplier
LIGHT_FABRIC_SHOULDER_KNEE   = 0.92   # per-channel shaded values above this get exponential roll-off
LIGHT_FABRIC_SHOULDER_CEIL   = 0.985  # asymptote of the soft shoulder (never reach pure white)


# ---------------------------------------------------------------------------
# Central shading helpers (bugrahoca-spec relative shading)
# ---------------------------------------------------------------------------
#
# These two functions are the canonical render core, ported verbatim from the
# standalone vest_blender / pant_blender (a.k.a. bugrahoca's shirt blender):
#
#     lum     = srgb_luminance(rgb_bbox)
#     vis     = alpha_bbox > (alpha_threshold / 255.0)
#     mean_lum= mean(lum[vis])
#     shading = clip((lum / mean_lum) ** shading_strength, *shading_clip)
#     shaded  = fabric * shading
#     out     = (1 - detail_blend) * shaded + detail_blend * template_rgb
#
# The output dynamic range is anchored on the template's mean luminance, so
# highlights brighten the fabric and shadows darken it — the opposite of the
# pure multiply path which can only darken. Detail blend bleeds enough of the
# template RGB back in to keep folds/seams legible.
# ---------------------------------------------------------------------------

def srgb_luminance(rgb_float01: np.ndarray) -> np.ndarray:
    """ITU-R BT.709 luminance for a float [0,1] RGB image."""
    return (0.2126 * rgb_float01[..., 0]
            + 0.7152 * rgb_float01[..., 1]
            + 0.0722 * rgb_float01[..., 2])


def apply_relative_shading(
    template_rgb_bbox: np.ndarray,
    alpha_bbox: np.ndarray,
    fabric_bbox: np.ndarray,
    *,
    shading_strength: float = SHADING_STRENGTH,
    shading_clip: tuple[float, float] = (0.0, 3.0),
    detail_blend: float = DETAIL_BLEND,
    alpha_threshold: int = ALPHA_THRESHOLD,
    global_mean_lum: float | None = None,
    light_fabric_override: bool | None = None,
    light_fabric_strength_cap: float = LIGHT_FABRIC_STRENGTH_CAP,
) -> np.ndarray:
    """
    Relative-shading + detail-blend renderer.

    All inputs are float in [0, 1] and same H×W bbox shape (fabric has 3 chs).
    `global_mean_lum` is in 0..255 space to match the existing callers (which
    derive it from float-0..255 luminance arrays); it's converted to [0,1]
    internally. Pass `None` to auto-compute mean_lum from this layer alone.

    Light-fabric branch
    ───────────────────
    If the mean luminance of the FABRIC inside the visible region is at or
    above LIGHT_FABRIC_THRESHOLD (default 0.72), the renderer switches to a
    softer profile that prevents highlight clipping and the pastel/grey wash
    you get with the power curve on whites / creams / light blues:

      · shading curve becomes LINEAR: 1 + (ratio - 1) * eff_strength
        (the default power curve `ratio**strength` amplifies highlights too
        aggressively when the input already sits near white)
      · shading_strength capped to LIGHT_FABRIC_STRENGTH_CAP (0.75 by default;
        override via `light_fabric_strength_cap` for an opt-in "more texture
        variation" preview)
      · detail_blend capped to LIGHT_FABRIC_DETAIL_CAP (0.08) — keeps the
        grey template highlight from desaturating coloured light fabrics
      · shading_clip floored at 0.55 / ceilinged at 1.25 — bounded gain so
        the multiplier alone can't blow a channel past 1.0
      · per-channel SOFT SHOULDER above LIGHT_FABRIC_SHOULDER_KNEE: any value
        above the knee is mapped exponentially toward LIGHT_FABRIC_SHOULDER_CEIL,
        so the output never reaches pure white and the hue is preserved
        (channels saturating one-by-one is what makes light blues look grey)

    Pass `light_fabric_override=True` or `False` to force the branch (used
    by the self-test to A/B render the same template under both paths).
    Dark / mid fabrics are untouched.
    """
    lum = srgb_luminance(template_rgb_bbox)
    vis = alpha_bbox > (alpha_threshold / 255.0)

    if global_mean_lum is not None:
        # callers compute mean lum in 0..255 space; convert to 0..1 here so
        # the lum/mean_lum ratio stays dimensionless regardless of input scale.
        mean_lum = float(global_mean_lum) / 255.0
    elif np.any(vis):
        mean_lum = float(np.mean(lum[vis]))
    else:
        mean_lum = float(np.mean(lum))
    mean_lum = max(mean_lum, 1e-4)

    # ---- Light-fabric detection ----
    fabric_lum = srgb_luminance(fabric_bbox)
    if np.any(vis):
        fabric_mean_lum = float(np.mean(fabric_lum[vis]))
    else:
        fabric_mean_lum = float(np.mean(fabric_lum))
    if light_fabric_override is None:
        is_light = fabric_mean_lum >= LIGHT_FABRIC_THRESHOLD
    else:
        is_light = bool(light_fabric_override)

    ratio = lum / mean_lum

    if is_light:
        eff_strength = min(shading_strength, light_fabric_strength_cap)
        eff_detail   = min(detail_blend, LIGHT_FABRIC_DETAIL_CAP)
        lo, hi = shading_clip
        eff_clip = (
            max(lo, LIGHT_FABRIC_CLIP_FLOOR),
            min(hi, LIGHT_FABRIC_CLIP_CEIL),
        )
        shading = np.clip(1.0 + (ratio - 1.0) * eff_strength, eff_clip[0], eff_clip[1])

        # Raw shaded — may exceed 1.0 per channel; soft shoulder handles that
        # without producing pure white (which causes hue shift on coloured
        # light fabrics because the channels clip one-by-one).
        shaded_raw = fabric_bbox * shading[..., None]
        knee = LIGHT_FABRIC_SHOULDER_KNEE
        ceil = LIGHT_FABRIC_SHOULDER_CEIL
        headroom = max(ceil - knee, 1e-6)
        over = shaded_raw > knee
        if np.any(over):
            # Asymptotic soft-sat: y = knee + headroom * (1 - exp(-(x-knee)/headroom)).
            # Identity at x=knee; approaches `ceil` as x → ∞; smooth derivative.
            excess = np.maximum(shaded_raw - knee, 0.0)
            soft = knee + headroom * (1.0 - np.exp(-excess / headroom))
            shaded = np.where(over, soft, shaded_raw)
        else:
            shaded = shaded_raw
        shaded = np.clip(shaded, 0.0, 1.0)

        result = (1.0 - eff_detail) * shaded + eff_detail * template_rgb_bbox
    else:
        # Original dark/mid-fabric path — power curve preserves contrast on
        # heavy navy / charcoal / brown / dark herringbone fabrics.
        lo, hi = shading_clip
        shading = np.clip(ratio ** shading_strength, lo, hi)
        shaded = np.clip(fabric_bbox * shading[..., None], 0.0, 1.0)
        result = (1.0 - detail_blend) * shaded + detail_blend * template_rgb_bbox

    return np.clip(result, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Swatch  (called from main.py before generate_layers)
# ---------------------------------------------------------------------------

def make_swatch(fabric_pil: Image.Image, output_path: Path, size: int = 96) -> None:
    """Center-crop → resize → save a square swatch thumbnail."""
    w, h = fabric_pil.size
    dim = min(w, h)
    left, top = (w - dim) // 2, (h - dim) // 2
    cropped = fabric_pil.crop((left, top, left + dim, top + dim))
    cropped.resize((size, size), Image.LANCZOS).save(str(output_path), "PNG")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _box_blur_f32(arr_uint8: np.ndarray, radius: int, passes: int = 3) -> np.ndarray:
    """Multi-pass box blur (approx. Gaussian). Returns float32, same shape as input."""
    pil = Image.fromarray(arr_uint8)
    for _ in range(passes):
        pil = pil.filter(ImageFilter.BoxBlur(radius))
    return np.array(pil, dtype=np.float32)


def _gaussian_lum(lum_f32: np.ndarray, radius: int) -> np.ndarray:
    """Gaussian-blur a 2-D float32 luminance map. Returns float32."""
    pil = Image.fromarray(np.clip(lum_f32, 0, 255).astype(np.uint8), mode="L")
    return np.array(pil.filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)


# ---------------------------------------------------------------------------
# Fabric preprocessing  (once per upload)
# ---------------------------------------------------------------------------

def _remove_gradients(tile_np: np.ndarray, tile_size: int) -> np.ndarray:
    """
    Flatten broad lighting gradients in a fabric photo.
    Divides by a large-radius blur estimate, then re-applies the original
    mean colour so the dominant hue is preserved.
    """
    tile_f = tile_np.astype(np.float32)
    box_r = max(4, tile_size // 8)
    blurred = _box_blur_f32(tile_np, box_r, passes=3)
    blurred = np.maximum(blurred, 1.0)
    avg = tile_f.mean(axis=(0, 1))
    normalised = tile_f / blurred * avg
    return np.clip(normalised, 0, 255).astype(np.uint8)


def _make_seamless(tile_np: np.ndarray) -> np.ndarray:
    """Legacy raised-cosine seamless blend. Kept for backward compatibility."""
    tile_f = tile_np.astype(np.float32)
    H, W = tile_f.shape[:2]
    rolled = np.roll(np.roll(tile_f, H // 2, axis=0), W // 2, axis=1)
    wy = 0.5 - 0.5 * np.cos(np.linspace(0, 2 * np.pi, H, endpoint=False))
    wx = 0.5 - 0.5 * np.cos(np.linspace(0, 2 * np.pi, W, endpoint=False))
    mask = np.outer(wy, wx)[:, :, np.newaxis]
    blended = tile_f * mask + rolled * (1.0 - mask)
    return np.clip(blended, 0, 255).astype(np.uint8)


def make_seamless_crossblend(img_np: np.ndarray, overlap: float) -> np.ndarray:
    """
    Cross-blend edges to create a seamlessly tileable texture.

    The last dx columns are faded into the first dx columns horizontally,
    and the last dy rows are faded into the first dy rows vertically.
    This ensures the tile boundaries blend smoothly when repeated.
    """
    H, W = img_np.shape[:2]
    dx = max(1, int(W * overlap))
    dy = max(1, int(H * overlap))
    result = img_np.astype(np.float32)

    # Horizontal: blend last dx cols onto first dx cols
    # ramp: 1.0 at left edge → 0.0 at the end of the overlap zone
    ramp_x = np.linspace(1.0, 0.0, dx, dtype=np.float32)[np.newaxis, :, np.newaxis]  # 1×dx×1
    result[:, :dx] = (
        img_np[:, :dx].astype(np.float32) * (1.0 - ramp_x)
        + img_np[:, -dx:].astype(np.float32) * ramp_x
    )

    # Vertical: blend last dy rows onto first dy rows (on the already-updated result)
    ramp_y = np.linspace(1.0, 0.0, dy, dtype=np.float32)[:, np.newaxis, np.newaxis]  # dy×1×1
    result[:dy, :] = (
        result[:dy, :] * (1.0 - ramp_y)
        + result[-dy:, :] * ramp_y
    )

    return np.clip(result, 0, 255).astype(np.uint8)


def preprocess_fabric(
    fabric_pil: Image.Image,
    tile_size: int = TILE_SIZE,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Prepare the uploaded fabric image.
    Returns (preprocessed, seamless) — both uint8 RGB (tile_size, tile_size, 3).
    """
    w, h = fabric_pil.size
    dim = min(w, h)
    left, top = (w - dim) // 2, (h - dim) // 2
    cropped = fabric_pil.crop((left, top, left + dim, top + dim))
    resized = np.array(cropped.resize((tile_size, tile_size), Image.LANCZOS), dtype=np.uint8)
    preprocessed = _remove_gradients(resized, tile_size)
    seamless = make_seamless_crossblend(preprocessed, SEAMLESS_OVERLAP)
    return preprocessed, seamless


# ---------------------------------------------------------------------------
# Material tile  (separates colour from texture detail)
# ---------------------------------------------------------------------------

def build_material(
    seamless_np: np.ndarray,
    tile_size: int,
    texture_detail_strength: float,
) -> np.ndarray:
    """
    Build the material tile by separating:
      base_colour     – mean RGB of the gradient-corrected tile
      texture_detail  – local variation around the per-pixel average

    material = base_colour × clip(detail, 0.1, 5)^strength
    """
    tile_f = seamless_np.astype(np.float32)
    base_colour = tile_f.mean(axis=(0, 1))

    detail_blur_r = max(3, tile_size // 50)
    local_blur = np.maximum(_box_blur_f32(seamless_np, detail_blur_r, passes=1), 1.0)
    detail = tile_f / local_blur

    detail_safe = np.clip(detail, 0.1, 5.0)
    if texture_detail_strength > 0:
        detail_compressed = detail_safe ** texture_detail_strength
    else:
        detail_compressed = np.ones_like(detail_safe)

    material = base_colour[np.newaxis, np.newaxis, :] * detail_compressed
    return np.clip(material, 0, 255).astype(np.uint8)


# ---------------------------------------------------------------------------
# Per-layer helpers
# ---------------------------------------------------------------------------

def _tile_material(
    material_np: np.ndarray,
    target_h: int,
    target_w: int,
    render_tile_size: int,
) -> np.ndarray:
    """Scale material to render_tile_size, then tile to (target_h, target_w)."""
    pil = Image.fromarray(material_np).resize(
        (render_tile_size, render_tile_size), Image.LANCZOS
    )
    tile_f = np.array(pil, dtype=np.float32)
    rts = render_tile_size
    tiles_y = (target_h + rts - 1) // rts
    tiles_x = (target_w + rts - 1) // rts
    tiled = np.tile(tile_f, (tiles_y, tiles_x, 1))
    return tiled[:target_h, :target_w]   # H×W×3 float32


def _extract_shading(
    rgb: np.ndarray,
    alpha: np.ndarray,
    shading_strength: float,
    structure_strength: float,
) -> np.ndarray:
    """
    Legacy shading extractor — kept for backward compatibility.
    The active shading path is now inside apply_fabric_to_layer().
    """
    H, W = rgb.shape[:2]
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]

    dim = min(H, W)
    big_r = max(8, dim // 35)
    med_r = max(2, dim // 80)

    broad  = _gaussian_lum(lum, big_r)
    medium = _gaussian_lum(lum, med_r)

    visible = alpha > 10
    if visible.any():
        broad_vis = broad[visible]
        b_min = float(broad_vis.min())
        b_max = float(broad_vis.max())
    else:
        b_min = float(broad.min())
        b_max = float(broad.max())

    broad_norm = (broad - b_min) / (b_max - b_min + 1e-6)
    broad_soft = SHADING_MIN + broad_norm * (SHADING_MAX - SHADING_MIN)
    broad_soft = 1.0 + (broad_soft - 1.0) * shading_strength
    broad_soft = np.clip(broad_soft, SHADING_MIN, SHADING_MAX)

    broad_safe = np.maximum(broad, 1.0)
    structure = np.clip(medium / broad_safe, 0.75, 1.25)
    structure_soft = 1.0 + (structure - 1.0) * structure_strength

    return (broad_soft * structure_soft).astype(np.float32)


# ---------------------------------------------------------------------------
# Zone and rotation helpers  (used by shirt generation)
# ---------------------------------------------------------------------------

def polygon_mask(polygon: list, height: int, width: int) -> np.ndarray:
    """Return bool H×W mask for a polygon given as list of [x, y] pixel coords."""
    img = Image.new("L", (width, height), 0)
    pts = [tuple(pt) for pt in polygon]
    ImageDraw.Draw(img).polygon(pts, fill=255)
    return np.array(img, dtype=bool)


def make_tiled_fabric_rotated(
    material_np: np.ndarray,
    target_h: int,
    target_w: int,
    render_tile_size: int,
    rotation_deg: float,
) -> np.ndarray:
    """
    Tile material at render_tile_size, rotate the whole canvas, crop to target.

    The critical difference from the naive approach of rotating a single tile:
    rotating one tile with expand=True produces black-filled corners, and tiling
    that produces repeating black patches.  Instead we tile a canvas large enough
    that after rotation the target area is still fully covered by fabric, then
    crop the centre — exactly the approach used in shirtfabricblending.py.
    """
    import math

    tile = Image.fromarray(material_np).resize(
        (render_tile_size, render_tile_size), Image.LANCZOS
    )
    tw, th = tile.size  # both equal render_tile_size

    if rotation_deg == 0:
        tiles_y = (target_h + th - 1) // th
        tiles_x = (target_w + tw - 1) // tw
        tiled = np.tile(np.array(tile, dtype=np.float32), (tiles_y, tiles_x, 1))
        return tiled[:target_h, :target_w]

    # Tile a square canvas large enough that after rotation the target area
    # stays fully covered (diagonal of target + one tile of padding on each side).
    diag = int(math.ceil(math.sqrt(target_w ** 2 + target_h ** 2))) + tw + th
    big = Image.new("RGB", (diag, diag))
    for y in range(0, diag, th):
        for x in range(0, diag, tw):
            big.paste(tile, (x, y))

    # Rotate the filled canvas — expand=False keeps it the same size (diag×diag)
    # so the centre is guaranteed to be fully covered by fabric.
    rotated = big.rotate(rotation_deg, resample=Image.BICUBIC, expand=False)

    # Crop the centre to (target_w, target_h)
    rx, ry = rotated.size
    cx, cy = rx // 2, ry // 2
    x0 = max(0, cx - target_w // 2)
    y0 = max(0, cy - target_h // 2)
    cropped = rotated.crop((x0, y0, x0 + target_w, y0 + target_h))
    if cropped.size != (target_w, target_h):
        cropped = cropped.resize((target_w, target_h), Image.LANCZOS)

    return np.array(cropped, dtype=np.float32)


# ---------------------------------------------------------------------------
# Shirt-specific tiling helpers  (PIL-based, aspect-ratio preserving)
# ---------------------------------------------------------------------------

def _shirt_make_seamless(img: Image.Image, overlap: float = SHIRT_SEAMLESS_OVERLAP) -> Image.Image:
    """
    Cross-blend edges to create a seamlessly tileable shirt fabric.

    Works in float [0,1] space. Replaces the leading dx columns with a blend
    of the trailing dx columns (and likewise for rows), so the fabric tiles
    without a hard seam.  This is the approach from shirtfabricblending.py —
    it produces a slightly narrower intermediate strip but the result tiles
    seamlessly at any rotation.
    """
    arr = np.array(img).astype(float) / 255.0
    h, w, c = arr.shape
    dy = int(h * overlap)
    dx = int(w * overlap)
    if dy < 1 or dx < 1:
        return img

    alpha_x = np.linspace(1.0, 0.0, dx).reshape(1, dx, 1)
    blended_x = arr[:, w - dx:, :] * alpha_x + arr[:, :dx, :] * (1.0 - alpha_x)
    arr_h = np.concatenate([blended_x, arr[:, dx:w - dx, :]], axis=1)

    h2 = arr_h.shape[0]
    alpha_y = np.linspace(1.0, 0.0, dy).reshape(dy, 1, 1)
    blended_y = arr_h[h2 - dy:, :, :] * alpha_y + arr_h[:dy, :, :] * (1.0 - alpha_y)
    arr_final = np.concatenate([blended_y, arr_h[dy:h2 - dy, :]], axis=0)

    return Image.fromarray((arr_final * 255).astype(np.uint8))


def _shirt_make_tiled_fabric(
    fabric_pil: Image.Image,
    target_w: int,
    target_h: int,
    tile_size_px: int = SHIRT_TILE_SIZE_PX,
    rotation_deg: float = 0,
) -> np.ndarray:
    """
    Tile a PIL fabric image to cover (target_w, target_h) at tile_size_px scale.

    Preserves the fabric's aspect ratio (unlike the blazer pipeline which squashes
    the material tile to a square).  Returns float32 H×W×3 in [0, 1].

    For rotation: tiles a canvas large enough that post-rotation crop has no black
    corners, then crops the centre — ensures seamless continuity after rotation.
    """
    fw, fh = fabric_pil.size
    scale = tile_size_px / max(1, fw)
    tw = max(1, int(round(fw * scale)))
    th = max(1, int(round(fh * scale)))
    tile = fabric_pil.resize((tw, th), Image.LANCZOS)

    if rotation_deg == 0:
        canvas = Image.new("RGB", (target_w, target_h))
        for y in range(0, target_h, th):
            for x in range(0, target_w, tw):
                canvas.paste(tile, (x, y))
        return np.array(canvas, dtype=np.float32) / 255.0

    # Tile a large canvas so the target area stays fully covered after rotation
    diag = int(np.ceil(np.sqrt(target_w ** 2 + target_h ** 2))) + tw + th
    big = Image.new("RGB", (diag, diag))
    for y in range(0, diag, th):
        for x in range(0, diag, tw):
            big.paste(tile, (x, y))

    rotated = big.rotate(rotation_deg, resample=Image.BICUBIC, expand=False)

    rx, ry = rotated.size
    cx, cy = rx // 2, ry // 2
    x0 = max(0, cx - target_w // 2)
    y0 = max(0, cy - target_h // 2)
    cropped = rotated.crop((x0, y0, x0 + target_w, y0 + target_h))
    if cropped.size != (target_w, target_h):
        cropped = cropped.resize((target_w, target_h), Image.LANCZOS)
    return np.array(cropped, dtype=np.float32) / 255.0


# ---------------------------------------------------------------------------
# Canonical per-layer renderer  (v2 — single path for ALL garment types)
# ---------------------------------------------------------------------------

# Per-garment-type rendering profiles. Used by the generate_* batch functions
# to pass the right tuning to apply_fabric_to_layer_v2 without hard-coding it
# at every call site.
RENDER_PROFILE_BLAZER = {
    "tile_size_px":      RENDER_TILE_SIZE,   # 260 (bumped 200 → 260 on 2026-05-21)
    "detail_blend":      DETAIL_BLEND,       # 0.15
    "shading_strength":  SHADING_STRENGTH,   # 1
    "shading_clip":      (0.3, 1.4),
    "alpha_threshold":   ALPHA_THRESHOLD,    # 8
}
RENDER_PROFILE_TUXEDO = dict(RENDER_PROFILE_BLAZER)
RENDER_PROFILE_SHIRT = {
    "tile_size_px":      SHIRT_TILE_SIZE_PX, # 260
    "detail_blend":      SHIRT_DETAIL_BLEND, # 0.12
    "shading_strength":  SHADING_STRENGTH,
    "shading_clip":      (0.0, 3.0),
    "alpha_threshold":   SHIRT_ALPHA_THRESHOLD,
}
RENDER_PROFILE_VEST = dict(RENDER_PROFILE_SHIRT)
RENDER_PROFILE_PANT = dict(RENDER_PROFILE_SHIRT)
RENDER_PROFILE_COAT = dict(RENDER_PROFILE_SHIRT)


def apply_fabric_to_layer_v2(
    template_path: Path,
    fabric_pil: Image.Image,
    output_path: Path,
    *,
    rotation: float = 0,
    zones: list | None = None,
    tile_size_px: int = TILE_SIZE_PX,
    detail_blend: float = DETAIL_BLEND,
    shading_strength: float = SHADING_STRENGTH,
    shading_clip: tuple[float, float] = (0.0, 3.0),
    alpha_threshold: int = ALPHA_THRESHOLD,
    global_mean_lum: float | None = None,
    use_pure_multiply: bool = False,
    debug_dir: Path | None = None,
) -> None:
    """
    Canonical fabric-to-layer renderer used by every garment type
    (blazer, tuxedo, shirt, vest, pant).

    Pipeline:
      1. Load RGBA template, convert to float [0, 1].
      2. Locate visible-pixel bounding box (skip large transparent margins).
      3. Tile the fabric to the FULL canvas (so pattern origin is shared
         across all layers), crop the bbox.
      4. For each zone: re-tile with the zone's own rotation, composite the
         zone fabric over the base fabric within the polygon mask. Zones
         overwrite earlier zones if they overlap (later wins). Polygons are
         in full-canvas pixel coordinates; they're translated to bbox-local
         space internally.
      5. Render the bbox with the bugrahoca-spec relative-shading + detail-
         blend formula (see `apply_relative_shading`). Pass `use_pure_multiply=True`
         to fall back to the legacy `fabric × template` multiply if needed
         for A/B comparison; default is the new path.
         · `global_mean_lum` (in 0..255 range) anchors the shading baseline
           across every layer in a batch so body/sleeves/pockets don't drift
           apart in tone.
         · `shading_clip` controls highlight/shadow headroom. Blazer/tuxedo
           profiles narrow it (0.3..1.4) to preserve fold detail on thick
           fabrics; shirt/vest/pant open it to (0.0..3.0).
      6. Compose back onto a copy of the original template RGBA. Only the
         `vis` (alpha > alpha_threshold) pixels inside the bbox are
         overwritten with the shaded fabric. Anti-alias edge pixels
         (0 < alpha <= alpha_threshold) keep the template's authored RGB,
         which is what prevents the black-halo bug the old `zeros_like`
         output had. Original alpha is preserved exactly.

    Polygon convention:
      zones = [
        {"polygon": [(x, y), (x, y), ...], "rotation": <degrees>},
        ...
      ]
    Coordinates are full-canvas (matching the original template PNG). Rotation
    follows PIL: positive = counter-clockwise.

    `fabric_pil` must already be RGB and seamless. Callers preprocess once
    per batch (e.g. via _shirt_make_seamless) and pass the same image to
    every layer for pattern continuity.
    """
    template = Image.open(str(template_path)).convert("RGBA")
    arr = np.array(template, dtype=np.float32) / 255.0
    template_rgb = arr[..., :3]
    alpha = arr[..., 3]
    H, W = arr.shape[:2]

    # Fast-exit: fully transparent template → write through unchanged so the
    # frontend still gets a valid PNG at the same path (and any anti-alias
    # halo authored into the template carries through).
    alpha_u8 = (alpha * 255.0).astype(np.uint8)
    garment_mask = alpha_u8 > alpha_threshold
    if not np.any(garment_mask):
        Image.fromarray((arr * 255.0).astype(np.uint8), mode="RGBA").save(str(output_path))
        return

    # Bounding box of visible pixels — only process this region.
    ys, xs = np.where(garment_mask)
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    bh, bw = y1 - y0, x1 - x0

    template_rgb_bbox = template_rgb[y0:y1, x0:x1, :]
    alpha_bbox = alpha[y0:y1, x0:x1]
    vis = alpha_bbox > (alpha_threshold / 255.0)

    # Base pass — full-canvas tile so pattern origin is shared across layers
    # (lapel stripes line up with body stripes when both run at rot=0).
    base_tiled = _shirt_make_tiled_fabric(fabric_pil, W, H, tile_size_px, rotation)
    fabric_bbox = base_tiled[y0:y1, x0:x1, :].copy()

    # Per-zone overrides — re-tile with zone rotation, mask, composite.
    # Zones overwrite earlier zones if they overlap (later wins).
    if zones:
        for zone in zones:
            poly = zone["polygon"]
            rot  = zone.get("rotation", rotation)
            local_poly = [(int(x) - x0, int(y) - y0) for x, y in poly]
            zmask = polygon_mask(local_poly, bh, bw)
            if not np.any(zmask):
                continue
            zone_tiled = _shirt_make_tiled_fabric(fabric_pil, W, H, tile_size_px, rot)
            fabric_bbox[zmask] = zone_tiled[y0:y1, x0:x1, :][zmask]

    if use_pure_multiply:
        # Legacy path — kept opt-in for A/B comparison. Crushes midtones and
        # cannot brighten highlights (pure multiply only darkens), which made
        # the rendered garments look flat.
        shaded_bbox = np.clip(fabric_bbox * template_rgb_bbox, 0.0, 1.0)
    else:
        # Default path — bugrahoca-spec relative shading + detail blend.
        shaded_bbox = apply_relative_shading(
            template_rgb_bbox,
            alpha_bbox,
            fabric_bbox,
            shading_strength=shading_strength,
            shading_clip=shading_clip,
            detail_blend=detail_blend,
            alpha_threshold=alpha_threshold,
            global_mean_lum=global_mean_lum,
        )

    # Halo fix: start the output from the original template (not zeros) so
    # anti-alias edge pixels keep their authored RGB. Then overwrite ONLY the
    # visible portion of the bbox with the shaded fabric. Alpha is preserved
    # exactly by construction (we copied arr, which already carries alpha).
    out = arr.copy()
    bbox_rgb_view = out[y0:y1, x0:x1, :3]
    bbox_rgb_view[vis] = shaded_bbox[vis]
    # Re-assert alpha (defensive: in case a future edit accidentally mutates it).
    out[..., 3] = alpha
    Image.fromarray((out * 255.0).astype(np.uint8), mode="RGBA").save(str(output_path))

    if debug_dir is not None:
        debug_dir = Path(debug_dir)
        debug_dir.mkdir(parents=True, exist_ok=True)
        Image.fromarray(
            (base_tiled * 255.0).astype(np.uint8), mode="RGB"
        ).save(str(debug_dir / "sample_base_tile.png"))
        # Save a visualisation of the shading map (helpful when tuning
        # shading_strength / shading_clip). Encoded as 8-bit luminance.
        if not use_pure_multiply:
            lum_full = srgb_luminance(template_rgb_bbox)
            mean_full = float(global_mean_lum) / 255.0 if global_mean_lum is not None else (
                float(np.mean(lum_full[vis])) if np.any(vis) else float(np.mean(lum_full))
            )
            mean_full = max(mean_full, 1e-4)
            lo, hi = shading_clip
            shading_map = np.clip((lum_full / mean_full) ** shading_strength, lo, hi)
            # Normalise to 0..255 for the saved preview (so the clip range
            # is visible regardless of absolute values).
            vmin, vmax = float(shading_map.min()), float(shading_map.max())
            if vmax > vmin:
                preview = (shading_map - vmin) / (vmax - vmin)
            else:
                preview = np.zeros_like(shading_map)
            Image.fromarray((preview * 255.0).astype(np.uint8), mode="L").save(
                str(debug_dir / "sample_shading_map.png")
            )


# ---------------------------------------------------------------------------
# Legacy per-layer functions  (thin wrappers around v2 for back-compat)
# ---------------------------------------------------------------------------

def apply_fabric_to_layer(
    template_path: Path,
    material_np: np.ndarray,
    output_path: Path,
    render_tile_size: int,
    shading_strength: float,
    structure_strength: float | None = None,
    debug_dir: Path | None = None,
    global_mean_lum: float | None = None,
    zones: list | None = None,
) -> None:
    """
    Legacy blazer/tuxedo entry point.  Accepts a uint8 material ndarray
    (output of build_material), wraps it as a PIL image, and delegates to
    apply_fabric_to_layer_v2 with the blazer/tuxedo render profile
    (tighter shading clip and higher detail_blend than shirt/vest/pant).

    Signature is preserved for back-compat with main.py callers and the
    self-test at the bottom of this module. `structure_strength` is accepted
    but ignored — kept only so old callers don't break.
    """
    del structure_strength  # legacy, unused in v2 path
    fabric_pil = Image.fromarray(material_np)
    apply_fabric_to_layer_v2(
        template_path,
        fabric_pil,
        output_path,
        zones=zones,
        tile_size_px=render_tile_size,
        detail_blend=DETAIL_BLEND,
        shading_strength=shading_strength,
        shading_clip=(0.3, 1.4),
        alpha_threshold=ALPHA_THRESHOLD,
        global_mean_lum=global_mean_lum,
        debug_dir=debug_dir,
    )


# ---------------------------------------------------------------------------
# Shirt layer renderer  (PIL-based, bbox-optimised)
# ---------------------------------------------------------------------------

def apply_fabric_to_shirt_layer(
    template_path: Path,
    fabric_pil: Image.Image,
    output_path: Path,
    rotation: float = 0,
    zones: list | None = None,
    shading_strength: float = SHADING_STRENGTH,
    global_mean_lum: float | None = None,
) -> None:
    """
    Legacy shirt entry point. Thin wrapper around apply_fabric_to_layer_v2
    with the shirt render profile (SHIRT_TILE_SIZE_PX=260, DETAIL_BLEND=0.12,
    shading_clip=(0,3)). Preserved for back-compat with main.py callers; new
    code should call apply_fabric_to_layer_v2 directly.
    """
    apply_fabric_to_layer_v2(
        template_path,
        fabric_pil,
        output_path,
        rotation=rotation,
        zones=zones,
        tile_size_px=SHIRT_TILE_SIZE_PX,
        detail_blend=SHIRT_DETAIL_BLEND,
        shading_strength=shading_strength,
        shading_clip=(0.0, 3.0),
        alpha_threshold=SHIRT_ALPHA_THRESHOLD,
        global_mean_lum=global_mean_lum,
    )


# ---------------------------------------------------------------------------
# Garment generation  (manifest-driven, generic)
#
# Reads <garment_root>/manifest.json (produced by tools/build-manifest.mjs)
# and renders a per-fabric variant of every fabricDependent layer across
# every category (base / lapels / hip-pocket / misc).  Each layer is rendered
# via the canonical apply_fabric_to_layer_v2 pipeline; if the manifest
# entry carries a `zones` array (authored with tools/web_zone_picker.py),
# those polygons + rotations are forwarded verbatim so striped fabrics
# follow the lapel angles correctly.
#
# Output is written to:
#     <garment_root>/generated/<fabric_id>/<category>/<filename>
# served at
#     /assets/<garment_type>/generated/<fabric_id>/<category>/<filename>
# via the existing Vite symlink — frontend swaps src on fabric selection.
#
# `garment_type` only governs log labels; everything that actually differs
# between blazer/suit (asset paths, manifest contents, zone polygons) is
# already encoded in `garment_root` and the manifest itself.
# ---------------------------------------------------------------------------

def generate_garment_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    garment_root: Path,
    garment_type: str = "blazer",
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Render every fabricDependent layer in <garment_root>/manifest.json with
    the uploaded fabric.  Used for both 'blazer' and 'suit' garment types
    (and any future tailored-garment manifest that follows the same
    base/lapels/hip-pocket schema).  Returns the count of layers successfully
    written.

    Pipeline:
      1. Load manifest.json from <garment_root>.
      2. Preprocess the fabric photo and build a material tile that respects
         `texture_detail_strength` (the look users are familiar with).
      3. Compute a global luminance baseline from an espalda_abajo body
         template so every panel normalises against the same reference —
         prevents body/sleeves/pockets from drifting to different tones.
      4. For each layer in each category:
           · Skip if fabricDependent is false (e.g. linings) or the PNG is
             missing.
           · Translate manifest `zones` from JSON-list polygons to the
             tuple form apply_fabric_to_layer_v2 expects.
           · Call apply_fabric_to_layer_v2 with the BLAZER render profile
             (tight shading clip 0.3..1.4, detail_blend 0.15) — same look
             for blazer and suit.
           · Write to <garment_root>/generated/<fabric_id>/<category>/<file>.
      5. Save a 96px swatch under generated-swatches/<fabric_id>.png.
    """
    manifest_path = garment_root / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(
            f"manifest.json not found at {manifest_path}. "
            "Run: node tools/build-manifest.mjs"
        )
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)

    categories = manifest.get("categories")
    if not isinstance(categories, dict):
        raise ValueError("manifest.json: missing or invalid 'categories' object")

    # ---- 2. Preprocess fabric into a seamless tile --------------------------
    # The renderer takes the SEAMLESS tile directly — the same path the shirt
    # pipeline uses. We deliberately skip build_material() here because that
    # step's base_colour × detail^strength composition flattens directional
    # patterns (stripes / herringbone / pinstripes) before they ever reach
    # the per-zone rotation step, so the Zone Picker's rotation angles end
    # up applied to a near-uniform texture and the output looks "straight"
    # regardless of zone rotation. Keeping the raw seamless texture
    # preserves the stripe contrast that makes per-zone rotation visible.
    preprocessed, seamless = preprocess_fabric(fabric_pil, TILE_SIZE)
    fabric_tile_pil = Image.fromarray(seamless)

    # ---- Debug images for the fabric (once per upload) ---------------------
    debug_dir = garment_root / "generated-fabrics" / fabric_id / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)
    Image.fromarray(preprocessed).save(str(debug_dir / "texture_preprocessed.png"))
    Image.fromarray(seamless).save(str(debug_dir / "texture_seamless.png"))

    # ---- 3. Global luminance reference from espalda_abajo -------------------
    global_mean_lum: float | None = None
    for layer in categories.get("base", []):
        rel = layer.get("file", "")
        if "espalda_abajo" not in rel:
            continue
        ref_path = garment_root / rel
        if not ref_path.exists():
            continue
        ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32)
        ref_vis = ref_arr[:, :, 3] > ALPHA_THRESHOLD
        if ref_vis.any():
            ref_rgb = ref_arr[:, :, :3]
            ref_lum = (
                0.2126 * ref_rgb[:, :, 0]
                + 0.7152 * ref_rgb[:, :, 1]
                + 0.0722 * ref_rgb[:, :, 2]
            )
            global_mean_lum = float(ref_lum[ref_vis].mean())
        break

    # ---- 4. Render-profile (shared between blazer and suit) ----------------
    profile = dict(RENDER_PROFILE_BLAZER)
    profile["tile_size_px"]     = int(render_tile_size)
    profile["shading_strength"] = float(shading_strength)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    total_listed = sum(len(v) for v in categories.values() if isinstance(v, list))
    print(
        f"  [{garment_type}] manifest layers={total_listed}  tile={profile['tile_size_px']}px"
        f"  detail={texture_detail_strength:.2f}  shading={shading_strength:.2f}"
        f"  global_mean_lum={lum_str}"
    )

    # ---- 5. Swatch (96px thumbnail) ----------------------------------------
    swatch_dir = garment_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    make_swatch(fabric_pil, swatch_path)

    # ---- 6. Output root for this fabric ------------------------------------
    out_root = garment_root / "generated" / fabric_id
    out_root.mkdir(parents=True, exist_ok=True)

    # ---- 7. Iterate every fabricDependent layer in every category ----------
    count = 0
    skipped_missing = 0
    skipped_passthrough = 0
    with_zones = 0
    debug_emitted = False

    for cat_name, layers in categories.items():
        if not isinstance(layers, list):
            continue
        for layer in layers:
            rel_file = layer.get("file")
            if not rel_file:
                continue

            if not layer.get("fabricDependent", True):
                skipped_passthrough += 1
                continue

            template_path = garment_root / rel_file
            if not template_path.exists():
                print(f"  [warn] {garment_type} template missing: {rel_file}")
                skipped_missing += 1
                continue

            zones: list[dict] | None = None
            raw_zones = layer.get("zones")
            if isinstance(raw_zones, list) and raw_zones:
                parsed_zones: list[dict] = []
                for z in raw_zones:
                    poly = z.get("polygon") if isinstance(z, dict) else None
                    if not isinstance(poly, list) or len(poly) < 3:
                        continue
                    parsed_zones.append({
                        "polygon": [tuple(pt) for pt in poly],
                        "rotation": float(z.get("rotation", 0)),
                    })
                if parsed_zones:
                    zones = parsed_zones
                    with_zones += 1

            output_path = out_root / rel_file
            output_path.parent.mkdir(parents=True, exist_ok=True)

            try:
                apply_fabric_to_layer_v2(
                    template_path,
                    fabric_tile_pil,
                    output_path,
                    rotation=0,
                    zones=zones,
                    global_mean_lum=global_mean_lum,
                    debug_dir=debug_dir if not debug_emitted else None,
                    **profile,
                )
                debug_emitted = True
                count += 1
            except Exception as exc:
                print(f"  [error] {rel_file}: {exc}")

    print(
        f"  [{garment_type}] done: rendered={count}"
        f"  with_zones={with_zones}"
        f"  passthrough_skipped={skipped_passthrough}"
        f"  missing_skipped={skipped_missing}"
    )
    upload_generated_tree(garment_type, fabric_id, out_root)
    upload_swatch(garment_type, fabric_id, swatch_path)
    return count


# Back-compat alias for any external caller still importing the old name.
def generate_blazer_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    blazer_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """Deprecated. Forwards to generate_garment_layers(garment_type='blazer')."""
    return generate_garment_layers(
        fabric_pil=fabric_pil,
        fabric_id=fabric_id,
        garment_root=blazer_root,
        garment_type="blazer",
        texture_detail_strength=texture_detail_strength,
        shading_strength=shading_strength,
        render_tile_size=render_tile_size,
    )


# ---------------------------------------------------------------------------
# Shirt generation  (called from main.py when garment_type == "SHIRT")
# ---------------------------------------------------------------------------

def generate_shirt_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    shirts_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Generate all unique fabric-dependent shirt layer PNGs for one fabric.

    Uses the advanced shirt pipeline (shirtfabricblending approach):
    - PIL-based seamless blending (_shirt_make_seamless) preserving aspect ratio.
    - Full-canvas tiling before bbox crop, ensuring pattern alignment across layers.
    - Per-zone rotation support via apply_fabric_to_shirt_layer().
    - Global luminance reference from the z=12000 base body layer so all panels
      share the same tonal baseline.

    Signature is unchanged from the previous implementation so main.py needs no
    modifications.  SHIRT_TILE_SIZE_PX and SHIRT_* constants govern shirt rendering;
    the render_tile_size parameter is accepted but not used in the shirt path.
    """
    # Make the fabric seamless using the shirt-specific overlap ratio
    seamless_pil = _shirt_make_seamless(fabric_pil.convert("RGB"), SHIRT_SEAMLESS_OVERLAP)

    # Load config
    config_path = shirts_root / "shirt_config.json"
    with open(config_path, encoding="utf-8") as fh:
        config = json.load(fh)

    # Collect all unique fabric=true layers across base / collars / cuffs
    # (deduplication by "path" key — same as before)
    seen: dict[str, dict] = {}

    for entry in config.get("base", []):
        if entry.get("fabric") and entry["path"] not in seen:
            seen[entry["path"]] = entry

    for collar_data in config.get("collars", {}).values():
        for btn_layers in collar_data.get("buttons", {}).values():
            for entry in btn_layers:
                if entry.get("fabric") and entry["path"] not in seen:
                    seen[entry["path"]] = entry

    for cuff_key, cuff_data in config.get("cuffs", {}).items():
        if cuff_key.startswith("_"):
            continue
        for entry in cuff_data.get("layers", []):
            if entry.get("fabric") and entry["path"] not in seen:
                seen[entry["path"]] = entry

    unique_layers = list(seen.values())

    # Global luminance reference from the base body layer (z=12000).
    # Computed in [0,255] float space; apply_fabric_to_shirt_layer divides by 255.
    global_mean_lum: float | None = None
    for entry in config.get("base", []):
        if entry.get("fabric") and entry.get("z") == 12000:
            ref_path = shirts_root / entry["path"].replace("shirts/", "")
            if ref_path.exists():
                ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32)
                ref_vis = ref_arr[:, :, 3] > SHIRT_ALPHA_THRESHOLD
                if ref_vis.any():
                    ref_rgb = ref_arr[:, :, :3]
                    ref_lum = (
                        0.2126 * ref_rgb[:, :, 0]
                        + 0.7152 * ref_rgb[:, :, 1]
                        + 0.0722 * ref_rgb[:, :, 2]
                    )
                    global_mean_lum = float(ref_lum[ref_vis].mean())
            break

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [shirt] tile={SHIRT_TILE_SIZE_PX}px"
        f"  overlap={SHIRT_SEAMLESS_OVERLAP:.2f}  detail_blend={SHIRT_DETAIL_BLEND:.2f}"
        f"  shading={shading_strength:.2f}  layers={len(unique_layers)}"
        f"  global_mean_lum={lum_str}"
    )

    # Save swatch
    swatch_dir = shirts_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    make_swatch(fabric_pil, swatch_path)

    # Generate each unique fabric layer
    output_dir = shirts_root / "generated" / fabric_id
    output_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for layer in unique_layers:
        template_path = shirts_root / layer["path"].replace("shirts/", "")
        if not template_path.exists():
            print(f"  [warn] shirt template missing: {template_path}")
            continue
        output_path = output_dir / Path(layer["path"]).name

        # Parse zones: JSON polygons are [[x,y],...] — convert to [(x,y),...]
        raw_zones = layer.get("zones") or None
        zones = None
        if raw_zones:
            zones = [
                {
                    "polygon": [tuple(pt) for pt in z["polygon"]],
                    "rotation": z.get("rotation", layer.get("rotation", 0)),
                }
                for z in raw_zones
            ]

        rotation = layer.get("rotation", 0)

        try:
            apply_fabric_to_shirt_layer(
                template_path,
                seamless_pil,
                output_path,
                rotation=rotation,
                zones=zones,
                shading_strength=shading_strength,
                global_mean_lum=global_mean_lum,
            )
            count += 1
        except Exception as exc:
            print(f"  [error] shirt layer {layer['path']}: {exc}")

    upload_generated_tree("shirts", fabric_id, output_dir)
    upload_swatch("shirts", fabric_id, swatch_path)
    return count


# ---------------------------------------------------------------------------
# Tuxedo generation  (called from main.py when garment_type == "JACKET")
# ---------------------------------------------------------------------------

def generate_tuxedo_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    tuxedo_assets_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Generate all fabric-dependent tuxedo PNGs for a custom fabric.

    Reads tuxedo_manifest.json, collects every fabricDependent=true layer
    from fabric_layers (base, neck, pocket, etc.) and pants_layers (fabric
    panels only — satin strips are skipped), and renders each layer via the
    canonical v2 pipeline (relative shading + detail blend), writing outputs
    to:
      tuxedo_assets_root/generated/{fabric_id}/{filename}

    Aligned with the blazer/suit path: uses the RAW seamless texture (not
    build_material) so directional patterns (pinstripe / herringbone) survive
    and the slim BLAZER shading_clip (0.3..1.4) is applied — keeping fold
    detail on heavy fabrics.

    Signature and return contract unchanged.
    """
    manifest_path = tuxedo_assets_root / "tuxedo_manifest.json"
    with open(manifest_path, encoding="utf-8") as fh:
        manifest = json.load(fh)

    # Collect all fabric-dependent layer dicts (jacket + pants fabric panels).
    # Keep the dicts (not just filenames) so we can forward per-layer zones
    # and rotation through to v2 — same as blazer/suit.
    fabric_dep_layers: list[dict] = []
    for layer in manifest.get("fabric_layers", []):
        if layer.get("fabricDependent"):
            fabric_dep_layers.append(layer)
    for layer in manifest.get("pants_layers", []):
        if layer.get("fabricDependent"):  # kind == 'pants_fabric'; satin skipped
            fabric_dep_layers.append(layer)

    if not fabric_dep_layers:
        print("  [tuxedo] no fabric-dependent layers found in manifest")
        return 0

    # Preprocess fabric once. We deliberately skip build_material() here —
    # see generate_garment_layers for the rationale (it flattens directional
    # patterns before the per-zone rotation step ever sees them).
    preprocessed, seamless = preprocess_fabric(fabric_pil, TILE_SIZE)
    fabric_tile_pil = Image.fromarray(seamless)

    # Global luminance reference: use the main body panel (espalda_abajo)
    # so every panel normalises against the same baseline tone.
    global_mean_lum: float | None = None
    for layer in manifest.get("fabric_layers", []):
        if "espalda_abajo" in layer["file"] and layer.get("fabricDependent"):
            ref_path = tuxedo_assets_root / layer["file"]
            if ref_path.exists():
                ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32)
                ref_vis = ref_arr[:, :, 3] > ALPHA_THRESHOLD
                if ref_vis.any():
                    ref_rgb = ref_arr[:, :, :3]
                    ref_lum = (
                        0.2126 * ref_rgb[:, :, 0]
                        + 0.7152 * ref_rgb[:, :, 1]
                        + 0.0722 * ref_rgb[:, :, 2]
                    )
                    global_mean_lum = float(ref_lum[ref_vis].mean())
            break

    # Use the tuxedo render profile (== blazer: tight shading_clip, detail 0.15).
    profile = dict(RENDER_PROFILE_TUXEDO)
    profile["tile_size_px"]     = int(render_tile_size)
    profile["shading_strength"] = float(shading_strength)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [tuxedo] tile={profile['tile_size_px']}px"
        f"  detail_blend={profile['detail_blend']:.2f}"
        f"  shading={profile['shading_strength']:.2f}"
        f"  layers={len(fabric_dep_layers)}  global_mean_lum={lum_str}"
    )

    # Output directory
    output_dir = tuxedo_assets_root / "generated" / fabric_id
    output_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for layer in fabric_dep_layers:
        filename = layer["file"]
        template_path = tuxedo_assets_root / filename
        if not template_path.exists():
            print(f"  [warn] tuxedo template missing: {template_path.name}")
            continue

        # Forward optional per-layer zones authored via Zone Picker, same
        # parsing as blazer/suit. Tolerates JSON-list polygons.
        zones: list[dict] | None = None
        raw_zones = layer.get("zones")
        if isinstance(raw_zones, list) and raw_zones:
            parsed_zones: list[dict] = []
            for z in raw_zones:
                poly = z.get("polygon") if isinstance(z, dict) else None
                if not isinstance(poly, list) or len(poly) < 3:
                    continue
                parsed_zones.append({
                    "polygon": [tuple(pt) for pt in poly],
                    "rotation": float(z.get("rotation", 0)),
                })
            if parsed_zones:
                zones = parsed_zones

        output_path = output_dir / filename
        try:
            apply_fabric_to_layer_v2(
                template_path,
                fabric_tile_pil,
                output_path,
                rotation=float(layer.get("rotation", 0)),
                zones=zones,
                global_mean_lum=global_mean_lum,
                **profile,
            )
            count += 1
        except Exception as exc:
            print(f"  [error] tuxedo {filename}: {exc}")

    upload_generated_tree("tuxedo", fabric_id, output_dir)

    # texture_detail_strength is accepted for back-compat with main.py but no
    # longer drives a build_material step here — kept in the signature so
    # callers don't break, but explicitly silenced for the linter.
    _ = texture_detail_strength
    return count


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Vest generation  (called from main.py when garment_type == "VEST")
# ---------------------------------------------------------------------------

def generate_vest_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    vest_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Generate fabric-applied vest PNGs by delegating to the reference
    vest_blender pipeline (FULL canvas tile + bbox crop + zones).

    Collects every fabric=true layer across base / all lapel styles /
    all hip-pocket styles (deduplicated by path), produces the seamless
    fabric once, then renders each unique layer with the reference
    apply_fabric_to_layer.  Output files are renamed to drop the
    "_fabric" suffix that the standalone script adds, so frontend paths
    stay simple.
    """
    # Use the canonical PIL-based seamless from the shirt path so vest goes
    # through the same preprocessing as every other v2 caller.
    fabric_seamless = _shirt_make_seamless(
        fabric_pil.convert("RGB"), overlap=SHIRT_SEAMLESS_OVERLAP
    )

    config_path = vest_root / "vest_config.json"
    with open(config_path) as fh:
        cfg = json.load(fh)

    seen: dict[str, dict] = {}
    for entry in cfg.get("base", []):
        if entry.get("fabric", False):
            seen[entry["path"]] = entry
    for lapel_data in cfg.get("lapels", {}).values():
        for entry in lapel_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry
    for pocket_data in cfg.get("hip-pocket", {}).values():
        for entry in pocket_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry

    # Global luminance reference: lowest-z base fabric layer with mean_lum > 1
    profile = RENDER_PROFILE_VEST
    base_fabric_layers = sorted(
        [e for e in cfg.get("base", []) if e.get("fabric", False)],
        key=lambda e: e["z"],
    )
    global_mean_lum: float | None = None
    for ref_entry in base_fabric_layers:
        ref_path = vest_root / ref_entry["path"].replace("vest/", "", 1)
        if not ref_path.exists():
            continue
        ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32) / 255.0
        ref_vis = ref_arr[..., 3] > (profile["alpha_threshold"] / 255.0)
        if not ref_vis.any():
            continue
        ref_rgb = ref_arr[..., :3]
        ref_lum = (0.2126 * ref_rgb[..., 0]
                   + 0.7152 * ref_rgb[..., 1]
                   + 0.0722 * ref_rgb[..., 2])
        candidate = float(ref_lum[ref_vis].mean()) * 255.0
        if candidate > 1.0:
            global_mean_lum = candidate
            break

    swatch_dir = vest_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    fabric_pil.resize((120, 120), Image.Resampling.LANCZOS).save(swatch_path)

    out_dir = vest_root / "generated" / fabric_id
    out_dir.mkdir(parents=True, exist_ok=True)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [vest] tile={profile['tile_size_px']}px"
        f"  detail_blend={profile['detail_blend']:.2f}"
        f"  shading={profile['shading_strength']:.2f}"
        f"  layers={len(seen)}  global_mean_lum={lum_str}"
    )

    count = 0
    for entry in seen.values():
        rel_path = entry["path"].replace("vest/", "", 1)
        template_path = vest_root / rel_path
        if not template_path.exists():
            print(f"  [warn] vest template missing: {template_path}")
            continue

        zones = None
        if entry.get("zones"):
            zones = [
                {
                    "polygon": [tuple(pt) for pt in z["polygon"]],
                    "rotation": z["rotation"],
                }
                for z in entry["zones"]
            ]

        try:
            apply_fabric_to_layer_v2(
                template_path,
                fabric_seamless,
                out_dir / template_path.name,
                rotation=entry.get("rotation", 0),
                zones=zones,
                global_mean_lum=global_mean_lum,
                **profile,
            )
            count += 1
        except Exception as exc:
            print(f"  [error] vest layer {entry['path']}: {exc}")

    upload_generated_tree("vest", fabric_id, out_dir)
    upload_swatch("vest", fabric_id, swatch_path)
    return count


# ---------------------------------------------------------------------------
# Config-driven garment generation  (shared by blazer v2 and suit v2)
# ---------------------------------------------------------------------------

def _render_config_garment_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    garment_root: Path,
    config_name: str,
    path_prefix: str,
    garment_label: str,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Shared renderer for any garment whose asset layout is described by a
    white_config.json file (blazer, suit, …).

    Reads garment_root/<config_name>, collects every fabric=True layer across
    base / lapels / hip-pocket (deduplicated by path), renders each with the
    BLAZER profile, and writes to garment_root/generated/<fabric_id>/<rel_path>
    where <rel_path> = layer["path"] with <path_prefix> stripped.
    """
    fabric_seamless = _shirt_make_seamless(
        fabric_pil.convert("RGB"), overlap=SHIRT_SEAMLESS_OVERLAP
    )

    config_path = garment_root / config_name
    with open(config_path) as fh:
        cfg = json.load(fh)

    seen: dict[str, dict] = {}
    for entry in cfg.get("base", []):
        if entry.get("fabric", False):
            seen[entry["path"]] = entry
    for lapel_data in cfg.get("lapels", {}).values():
        for entry in lapel_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry
    for pocket_data in cfg.get("hip-pocket", {}).values():
        for entry in pocket_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry

    profile = dict(RENDER_PROFILE_BLAZER)
    profile["tile_size_px"] = int(render_tile_size)
    profile["shading_strength"] = float(shading_strength)

    base_fabric_layers = sorted(
        [e for e in cfg.get("base", []) if e.get("fabric", False)],
        key=lambda e: e["z"],
    )
    global_mean_lum: float | None = None
    for ref_entry in base_fabric_layers:
        rel_path = ref_entry["path"].replace(path_prefix, "", 1)
        ref_path = garment_root / rel_path
        if not ref_path.exists():
            continue
        ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32) / 255.0
        ref_vis = ref_arr[..., 3] > (profile["alpha_threshold"] / 255.0)
        if not ref_vis.any():
            continue
        ref_rgb = ref_arr[..., :3]
        ref_lum = (
            0.2126 * ref_rgb[..., 0]
            + 0.7152 * ref_rgb[..., 1]
            + 0.0722 * ref_rgb[..., 2]
        )
        candidate = float(ref_lum[ref_vis].mean()) * 255.0
        if candidate > 1.0:
            global_mean_lum = candidate
            break

    swatch_dir = garment_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    make_swatch(fabric_pil, swatch_path)

    out_root = garment_root / "generated" / fabric_id
    out_root.mkdir(parents=True, exist_ok=True)

    debug_dir = garment_root / "generated-fabrics" / fabric_id / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [{garment_label}] tile={profile['tile_size_px']}px"
        f"  detail_blend={profile['detail_blend']:.2f}"
        f"  shading={profile['shading_strength']:.2f}"
        f"  layers={len(seen)}  global_mean_lum={lum_str}"
    )

    count = 0
    debug_emitted = False
    for entry in seen.values():
        rel_path = entry["path"].replace(path_prefix, "", 1)
        template_path = garment_root / rel_path
        if not template_path.exists():
            print(f"  [warn] {garment_label} template missing: {template_path}")
            continue

        zones = None
        if entry.get("zones"):
            zones = [
                {"polygon": [tuple(pt) for pt in z["polygon"]], "rotation": z["rotation"]}
                for z in entry["zones"]
            ]

        output_path = out_root / rel_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            apply_fabric_to_layer_v2(
                template_path,
                fabric_seamless,
                output_path,
                rotation=entry.get("rotation", 0),
                zones=zones,
                global_mean_lum=global_mean_lum,
                debug_dir=debug_dir if not debug_emitted else None,
                **profile,
            )
            debug_emitted = True
            count += 1
        except Exception as exc:
            print(f"  [error] {garment_label} layer {entry['path']}: {exc}")

    upload_generated_tree(garment_label, fabric_id, out_root)
    upload_swatch(garment_label, fabric_id, swatch_path)
    return count


def generate_blazer_v2_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    blazer_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """Config-driven blazer renderer (reads blazer-white_config.json)."""
    return _render_config_garment_layers(
        fabric_pil, fabric_id, blazer_root,
        config_name="blazer-white_config.json",
        path_prefix="blazer/",
        garment_label="blazer",
        shading_strength=shading_strength,
        render_tile_size=render_tile_size,
    )


def generate_suit_v2_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    suit_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """Config-driven suit renderer (reads suit-white_config.json)."""
    return _render_config_garment_layers(
        fabric_pil, fabric_id, suit_root,
        config_name="suit-white_config.json",
        path_prefix="suit/",
        garment_label="suit",
        shading_strength=shading_strength,
        render_tile_size=render_tile_size,
    )


# ---------------------------------------------------------------------------
# Pant generation  (called from main.py when garment_type == "PANT")
# ---------------------------------------------------------------------------

def generate_pant_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    pant_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Generate fabric-applied pant PNGs by delegating to the reference
    pant_blender pipeline.  Same delegation model as
    generate_vest_layers().
    """
    fabric_seamless = _shirt_make_seamless(
        fabric_pil.convert("RGB"), overlap=SHIRT_SEAMLESS_OVERLAP
    )

    config_path = pant_root / "pant_config.json"
    with open(config_path) as fh:
        cfg = json.load(fh)

    seen: dict[str, dict] = {}
    for entry in cfg.get("base", []):
        if entry.get("fabric", False):
            seen[entry["path"]] = entry
    for fast_data in cfg.get("fastenings", {}).values():
        for entry in fast_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry
    for pleat_data in cfg.get("pleats", {}).values():
        for entry in pleat_data.get("layers", []):
            if entry.get("fabric", False):
                seen[entry["path"]] = entry

    profile = RENDER_PROFILE_PANT
    base_fabric = sorted(
        [e for e in cfg.get("base", []) if e.get("fabric", False)],
        key=lambda e: e["z"],
    )
    global_mean_lum: float | None = None
    for ref_entry in base_fabric:
        ref_path = pant_root / ref_entry["path"].replace("pants/", "", 1)
        if not ref_path.exists():
            continue
        ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32) / 255.0
        ref_vis = ref_arr[..., 3] > (profile["alpha_threshold"] / 255.0)
        if not ref_vis.any():
            continue
        ref_rgb = ref_arr[..., :3]
        ref_lum = (0.2126 * ref_rgb[..., 0]
                   + 0.7152 * ref_rgb[..., 1]
                   + 0.0722 * ref_rgb[..., 2])
        candidate = float(ref_lum[ref_vis].mean()) * 255.0
        if candidate > 1.0:
            global_mean_lum = candidate
            break

    swatch_dir = pant_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    fabric_pil.resize((120, 120), Image.Resampling.LANCZOS).save(swatch_path)

    out_dir = pant_root / "generated" / fabric_id
    out_dir.mkdir(parents=True, exist_ok=True)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [pant] tile={profile['tile_size_px']}px"
        f"  detail_blend={profile['detail_blend']:.2f}"
        f"  shading={profile['shading_strength']:.2f}"
        f"  layers={len(seen)}  global_mean_lum={lum_str}"
    )

    count = 0
    for entry in seen.values():
        rel_path = entry["path"].replace("pants/", "", 1)
        template_path = pant_root / rel_path
        if not template_path.exists():
            print(f"  [warn] pant template missing: {template_path}")
            continue

        zones = None
        if entry.get("zones"):
            zones = [
                {
                    "polygon": [tuple(pt) for pt in z["polygon"]],
                    "rotation": z["rotation"],
                }
                for z in entry["zones"]
            ]

        try:
            apply_fabric_to_layer_v2(
                template_path,
                fabric_seamless,
                out_dir / template_path.name,
                rotation=entry.get("rotation", 0),
                zones=zones,
                global_mean_lum=global_mean_lum,
                **profile,
            )
            count += 1
        except Exception as exc:
            print(f"  [error] pant layer {entry['path']}: {exc}")

    upload_generated_tree("pant", fabric_id, out_dir)
    upload_swatch("pant", fabric_id, swatch_path)
    return count


# ---------------------------------------------------------------------------
# Coat generation  (called from main.py when garment_type == "COAT")
# ---------------------------------------------------------------------------

def generate_coat_layers(
    fabric_pil: Image.Image,
    fabric_id: str,
    coat_root: Path,
    texture_detail_strength: float = TEXTURE_DETAIL_STRENGTH,
    shading_strength: float = SHADING_STRENGTH,
    render_tile_size: int = RENDER_TILE_SIZE,
) -> int:
    """
    Generate fabric-applied coat PNGs.  Same delegation model as
    generate_vest_layers() / generate_pant_layers().

    The coat config groups layers under base + style + bottoms + pockets +
    sleeve-accents + shoulder-accents (each group value is {label, layers:[…]}
    except `base`, which is a flat list).  Every fabric=true layer across all
    groups is collected (deduplicated by path), the seamless fabric is produced
    once, then each unique layer is rendered with apply_fabric_to_layer_v2.
    Coat config paths are already relative to coat_root (no garment prefix), and
    every fabric-layer basename is unique, so output is written flat under
    generated/<fabric_id>/<basename> — exactly like vest/pant.
    """
    fabric_seamless = _shirt_make_seamless(
        fabric_pil.convert("RGB"), overlap=SHIRT_SEAMLESS_OVERLAP
    )

    config_path = coat_root / "coat_config.json"
    with open(config_path) as fh:
        cfg = json.load(fh)

    seen: dict[str, dict] = {}
    for entry in cfg.get("base", []):
        if entry.get("fabric", False):
            seen[entry["path"]] = entry
    for group in ("style", "bottoms", "pockets", "sleeve-accents", "shoulder-accents"):
        for variant in cfg.get(group, {}).values():
            for entry in variant.get("layers", []):
                if entry.get("fabric", False):
                    seen[entry["path"]] = entry

    profile = RENDER_PROFILE_COAT
    base_fabric = sorted(
        [e for e in cfg.get("base", []) if e.get("fabric", False)],
        key=lambda e: e["z"],
    )
    global_mean_lum: float | None = None
    for ref_entry in base_fabric:
        ref_path = coat_root / ref_entry["path"]
        if not ref_path.exists():
            continue
        ref_arr = np.array(Image.open(str(ref_path)).convert("RGBA"), dtype=np.float32) / 255.0
        ref_vis = ref_arr[..., 3] > (profile["alpha_threshold"] / 255.0)
        if not ref_vis.any():
            continue
        ref_rgb = ref_arr[..., :3]
        ref_lum = (0.2126 * ref_rgb[..., 0]
                   + 0.7152 * ref_rgb[..., 1]
                   + 0.0722 * ref_rgb[..., 2])
        candidate = float(ref_lum[ref_vis].mean()) * 255.0
        if candidate > 1.0:
            global_mean_lum = candidate
            break

    swatch_dir = coat_root / "generated-swatches"
    swatch_dir.mkdir(parents=True, exist_ok=True)
    swatch_path = swatch_dir / f"{fabric_id}.png"
    fabric_pil.resize((120, 120), Image.Resampling.LANCZOS).save(swatch_path)

    out_dir = coat_root / "generated" / fabric_id
    out_dir.mkdir(parents=True, exist_ok=True)

    lum_str = f"{global_mean_lum:.1f}" if global_mean_lum is not None else "auto"
    print(
        f"  [coat] tile={profile['tile_size_px']}px"
        f"  detail_blend={profile['detail_blend']:.2f}"
        f"  shading={profile['shading_strength']:.2f}"
        f"  layers={len(seen)}  global_mean_lum={lum_str}"
    )

    count = 0
    for entry in seen.values():
        template_path = coat_root / entry["path"]
        if not template_path.exists():
            print(f"  [warn] coat template missing: {template_path}")
            continue

        zones = None
        if entry.get("zones"):
            zones = [
                {
                    "polygon": [tuple(pt) for pt in z["polygon"]],
                    "rotation": z["rotation"],
                }
                for z in entry["zones"]
            ]

        try:
            apply_fabric_to_layer_v2(
                template_path,
                fabric_seamless,
                out_dir / template_path.name,
                rotation=entry.get("rotation", 0),
                zones=zones,
                global_mean_lum=global_mean_lum,
                **profile,
            )
            count += 1
        except Exception as exc:
            print(f"  [error] coat layer {entry['path']}: {exc}")

    upload_generated_tree("coat", fabric_id, out_dir)
    upload_swatch("coat", fabric_id, swatch_path)
    return count


# ---------------------------------------------------------------------------
# Self-test — run with:  python3 fabric_generator.py
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import tempfile

    print("Running internal tests …\n")
    rng = np.random.default_rng(42)
    ts = 256

    # Synthetic fabric: diagonal gradient + colour noise.
    # Brighter than the legacy fixture so the highlight assertion has headroom.
    grid = np.indices((ts, ts))
    grad = (grid[0] + grid[1]) / (2 * ts) * 160 + 40
    r = np.clip(grad + rng.integers(-15, 15, (ts, ts)), 0, 255).astype(np.uint8)
    g = np.clip(rng.integers(120, 180, (ts, ts)).astype(float) - grad * 0.15, 0, 255).astype(np.uint8)
    b = np.clip(rng.integers(130, 190, (ts, ts)).astype(float) - grad * 0.10, 0, 255).astype(np.uint8)
    fake_fabric = Image.fromarray(np.stack([r, g, b], axis=-1))

    # --- preprocess ----------------------------------------------------------
    pre, seamless = preprocess_fabric(fake_fabric, ts)
    assert pre.shape == seamless.shape == (ts, ts, 3)
    print(f"  preprocess : {pre.shape}  avg={pre.mean(axis=(0,1)).round(1)}")

    # --- make_seamless_crossblend: shape sanity ------------------------------
    tile = np.arange(ts * ts * 3, dtype=np.uint8).reshape(ts, ts, 3)
    blended = make_seamless_crossblend(tile, overlap=SEAMLESS_OVERLAP)
    assert blended.shape == (ts, ts, 3), f"bad crossblend shape {blended.shape}"
    print(f"  crossblend : {blended.shape}  ✓")

    # --- material (legacy build_material — still used by some callers) -------
    mat = build_material(seamless, ts, texture_detail_strength=0.35)
    assert mat.shape == (ts, ts, 3)
    print(f"  material   : {mat.shape}  avg={mat.mean(axis=(0,1)).round(1)}")

    # --- srgb_luminance: numeric sanity --------------------------------------
    pure_white = np.ones((4, 4, 3), dtype=np.float32)
    pure_black = np.zeros((4, 4, 3), dtype=np.float32)
    assert np.allclose(srgb_luminance(pure_white), 1.0)
    assert np.allclose(srgb_luminance(pure_black), 0.0)
    print(f"  luminance  : ✓")

    # --- apply_relative_shading: highlights brighten fabric ------------------
    # Synthetic bbox: half dark (lum < mean), half bright (lum > mean).
    H, W = 16, 16
    rgb_bbox   = np.zeros((H, W, 3), dtype=np.float32)
    rgb_bbox[:, : W // 2, :] = 0.20   # dark half
    rgb_bbox[:, W // 2 :, :] = 0.80   # bright half
    alpha_bbox = np.ones((H, W), dtype=np.float32)
    fabric_bbox = np.full((H, W, 3), 0.5, dtype=np.float32)  # mid-grey fabric
    rs = apply_relative_shading(rgb_bbox, alpha_bbox, fabric_bbox,
                                shading_strength=1.0,
                                shading_clip=(0.0, 3.0),
                                detail_blend=0.12,
                                alpha_threshold=ALPHA_THRESHOLD)
    dark_mean   = float(rs[:, : W // 2, :].mean())
    bright_mean = float(rs[:, W // 2 :, :].mean())
    pure_mult   = (fabric_bbox * rgb_bbox).mean()  # only-darkens baseline
    assert bright_mean > dark_mean, "highlights should brighten output"
    assert bright_mean > 0.5, \
        f"bright half should brighten the mid-grey fabric, got {bright_mean:.3f}"
    print(f"  rel-shade  : dark={dark_mean:.3f}  bright={bright_mean:.3f}"
          f"  (pure-mult avg={pure_mult:.3f}) ✓")

    # --- full layer end-to-end (via apply_fabric_to_layer → v2) --------------
    T = 512
    Y, X = np.mgrid[-1:1:T * 1j, -1:1:T * 1j]
    dist = np.hypot(X, Y)
    alpha_f = np.clip((1.0 - dist) * 350, 0, 255)
    # Brighter template so the relative-shading curve has range to work with.
    shade = np.clip(0.5 + 0.5 * ((X + 1) / 2), 0, 1)
    r_ch = (90 + 120 * shade).astype(np.uint8)
    g_ch = (95 + 120 * shade).astype(np.uint8)
    b_ch = (110 + 130 * shade).astype(np.uint8)
    template_arr = np.dstack([r_ch, g_ch, b_ch, alpha_f.astype(np.uint8)])

    with tempfile.TemporaryDirectory() as tmp:
        tpl = Path(tmp) / "template.png"
        out = Path(tmp) / "output.png"
        out_mult = Path(tmp) / "output_pure_multiply.png"
        dbg = Path(tmp) / "debug"
        dbg.mkdir()
        Image.fromarray(template_arr, "RGBA").save(str(tpl))

        # Auto-compute path (global_mean_lum=None) — blazer/tuxedo profile.
        apply_fabric_to_layer(tpl, mat, out, RENDER_TILE_SIZE,
                               SHADING_STRENGTH, STRUCTURE_STRENGTH, debug_dir=dbg)

        out_arr = np.array(Image.open(str(out)))
        assert out_arr.shape == (T, T, 4), f"bad shape {out_arr.shape}"
        assert np.array_equal(out_arr[:, :, 3], template_arr[:, :, 3]), "alpha changed!"

        vis   = out_arr[:, :, 3] > ALPHA_THRESHOLD
        invis = out_arr[:, :, 3] <= ALPHA_THRESHOLD

        # Halo regression: every invisible/anti-alias pixel must keep the
        # template's authored RGB. Old `out = np.zeros_like(arr)` failed this
        # and produced a black halo at the alpha edge.
        if invis.any():
            orig_invis = template_arr[:, :, :3][invis]
            out_invis  = out_arr[:, :, :3][invis]
            assert np.array_equal(out_invis, orig_invis), \
                (f"halo regression: transparent/anti-alias pixel RGB modified, "
                 f"max_diff={np.abs(out_invis.astype(int)-orig_invis.astype(int)).max()}")
        print(f"  no-halo    : RGB unchanged on {invis.sum()} edge/transparent px ✓")

        # Anti-alias band specifically: 0 < alpha <= ALPHA_THRESHOLD.
        edge_band = (out_arr[:, :, 3] > 0) & (out_arr[:, :, 3] <= ALPHA_THRESHOLD)
        if edge_band.any():
            edge_out = out_arr[:, :, :3][edge_band]
            assert edge_out.max() > 0, "anti-alias band went pure black (halo!)"
            print(f"  edge-band  : {edge_band.sum()} px, max RGB {edge_out.max()} ✓")

        # Render the same template with use_pure_multiply=True for baseline.
        apply_fabric_to_layer_v2(
            tpl, Image.fromarray(mat), out_mult,
            tile_size_px=RENDER_TILE_SIZE,
            detail_blend=DETAIL_BLEND,
            shading_strength=SHADING_STRENGTH,
            shading_clip=(0.3, 1.4),
            alpha_threshold=ALPHA_THRESHOLD,
            use_pure_multiply=True,
        )
        mult_arr = np.array(Image.open(str(out_mult)))

        # Dynamic-range comparison: relative shading should preserve more
        # contrast across the visible region than pure multiply (which can
        # only darken).
        rel_vis  = out_arr[:, :, :3][vis].astype(float)
        mult_vis = mult_arr[:, :, :3][vis].astype(float)
        rel_range  = rel_vis.max(axis=0)  - rel_vis.min(axis=0)
        mult_range = mult_vis.max(axis=0) - mult_vis.min(axis=0)
        assert rel_range.mean() >= mult_range.mean(), \
            (f"relative-shading dynamic range {rel_range.mean():.1f} should not be "
             f"below pure-multiply {mult_range.mean():.1f}")
        print(f"  dyn-range  : rel={rel_range.mean():.1f}  mult={mult_range.mean():.1f} ✓")

        avg_out_auto = rel_vis.mean(axis=0)
        avg_mat = mat.astype(float).mean(axis=(0, 1))
        print(f"  layer(auto): avg_rgb(visible)={avg_out_auto.round(1)}")
        print(f"  material   : avg_rgb={avg_mat.round(1)}")
        print(f"  alpha      : preserved exactly ✓")
        assert (dbg / "sample_shading_map.png").exists(), "debug not saved"
        print(f"  debug      : shading map saved ✓")

        # Global mean_lum path: re-render with an explicit reference.
        out2 = Path(tmp) / "output_global.png"
        fixed_lum = 60.0
        apply_fabric_to_layer(tpl, mat, out2, RENDER_TILE_SIZE,
                               SHADING_STRENGTH, global_mean_lum=fixed_lum)
        out2_arr = np.array(Image.open(str(out2)))
        assert np.array_equal(out2_arr[:, :, 3], template_arr[:, :, 3]), \
            "alpha changed in global_mean_lum path!"
        avg_out_global = out2_arr[:, :, :3][vis].astype(float).mean(axis=0)
        assert not np.allclose(avg_out_auto, avg_out_global, atol=1), \
            "global_mean_lum had no effect — parameter not wired in"
        print(f"  layer(glbl): avg_rgb(visible)={avg_out_global.round(1)}  (ref={fixed_lum}) ✓")

        # Zone rotation: an explicit zone covering the whole bbox must not
        # blow up and must still preserve alpha.
        zone_out = Path(tmp) / "output_zone.png"
        full_poly = [(0, 0), (T - 1, 0), (T - 1, T - 1), (0, T - 1)]
        apply_fabric_to_layer_v2(
            tpl, Image.fromarray(mat), zone_out,
            zones=[{"polygon": full_poly, "rotation": 30.0}],
            tile_size_px=RENDER_TILE_SIZE,
            detail_blend=DETAIL_BLEND,
            shading_strength=SHADING_STRENGTH,
            shading_clip=(0.3, 1.4),
            alpha_threshold=ALPHA_THRESHOLD,
        )
        zone_arr = np.array(Image.open(str(zone_out)))
        assert np.array_equal(zone_arr[:, :, 3], template_arr[:, :, 3]), \
            "alpha changed in zone path!"
        print(f"  zones      : 30° rotation rendered ✓")

    # ---- Light-fabric branch tests ----------------------------------------
    # Synthetic light blue fabric (mean lum well above the threshold) +
    # synthetic template with both a midtone area and a bright highlight half.
    H, W = 32, 32
    light_blue = np.zeros((H, W, 3), dtype=np.float32)
    light_blue[..., 0] = 0.70   # R
    light_blue[..., 1] = 0.80   # G
    light_blue[..., 2] = 0.95   # B  → mean lum ≈ 0.79
    dark_navy = np.zeros((H, W, 3), dtype=np.float32)
    dark_navy[..., 0] = 0.05
    dark_navy[..., 1] = 0.08
    dark_navy[..., 2] = 0.22    # mean lum ≈ 0.094
    bright_template = np.full((H, W, 3), 0.70, dtype=np.float32)
    bright_template[:, W // 2 :, :] = 0.99   # bright highlight half
    alpha_full = np.ones((H, W), dtype=np.float32)

    light_blue_lum = float(srgb_luminance(light_blue).mean())
    dark_navy_lum  = float(srgb_luminance(dark_navy).mean())
    assert light_blue_lum >= LIGHT_FABRIC_THRESHOLD
    assert dark_navy_lum  <  LIGHT_FABRIC_THRESHOLD
    print(f"  light-det  : light_blue_lum={light_blue_lum:.3f} ≥ "
          f"{LIGHT_FABRIC_THRESHOLD}  navy_lum={dark_navy_lum:.3f} ✓")

    # Power-curve baseline (forced off) — should clip the bright half.
    rs_power = apply_relative_shading(
        bright_template, alpha_full, light_blue,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
        light_fabric_override=False,
    )
    # Soft light branch (auto / forced on) — should not.
    rs_soft = apply_relative_shading(
        bright_template, alpha_full, light_blue,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
        light_fabric_override=True,
    )
    rs_auto = apply_relative_shading(
        bright_template, alpha_full, light_blue,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
        # default: auto-detect → light_blue mean is above threshold → light path
    )
    # Stronger-texture preview: same light branch but uncap the strength so
    # more shading variation comes through (useful for textured weaves).
    rs_strong = apply_relative_shading(
        bright_template, alpha_full, light_blue,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
        light_fabric_override=True,
        light_fabric_strength_cap=1.0,
    )
    assert np.allclose(rs_auto, rs_soft, atol=1e-6), \
        "auto-detection should trigger the light branch on a light fabric"
    assert rs_soft.max() < 1.0, \
        f"light branch should avoid pure white, got max={rs_soft.max():.4f}"
    assert rs_soft.max() < rs_power.max() - 0.01, \
        f"light branch should reduce highlight clipping (soft={rs_soft.max():.3f}, power={rs_power.max():.3f})"
    print(f"  rs-light   : power_max={rs_power.max():.3f}  soft_max={rs_soft.max():.3f}"
          f"  strong_max={rs_strong.max():.3f} ✓")

    # Dark-fabric guarantee: navy fabric must NOT auto-trigger the light
    # branch — its output should equal the forced-off (power-curve) path.
    rs_navy_auto = apply_relative_shading(
        bright_template, alpha_full, dark_navy,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
    )
    rs_navy_forced_dark = apply_relative_shading(
        bright_template, alpha_full, dark_navy,
        shading_strength=SHADING_STRENGTH, shading_clip=(0.3, 1.4),
        detail_blend=DETAIL_BLEND,
        light_fabric_override=False,
    )
    assert np.allclose(rs_navy_auto, rs_navy_forced_dark, atol=1e-6), \
        "dark fabric must not trigger light branch (auto should match power curve)"
    print(f"  rs-dark    : navy fabric stays on power curve ✓")

    # ---- 3-variant visual comparison renders ------------------------------
    # Write three full-PNG renders of the same light-blue fabric on the same
    # template, so the calibration can be eyeballed in any image viewer.
    # Saved to a stable, predictable path (not auto-cleaned) so the user can
    # open them without copy-pasting tempdir names.
    import os
    compare_dir = Path(os.environ.get("FABRIC_COMPARE_DIR",
                                       "/tmp/fabric-engine-render-compare"))
    compare_dir.mkdir(parents=True, exist_ok=True)

    # Bigger fabric tile + bigger template, so the comparison looks like a
    # real layer instead of a 32×32 swatch.
    CT = 384
    Y2, X2 = np.mgrid[-1:1:CT * 1j, -1:1:CT * 1j]
    dist2 = np.hypot(X2, Y2)
    alpha_c = np.clip((1.0 - dist2) * 350, 0, 255)
    # Template: vertical gradient with a bright highlight on the right half.
    shade2 = np.clip(0.55 + 0.45 * ((X2 + 1) / 2), 0, 1)
    r2 = (110 + 130 * shade2).astype(np.uint8)
    g2 = (115 + 130 * shade2).astype(np.uint8)
    b2 = (125 + 130 * shade2).astype(np.uint8)
    template_c = np.dstack([r2, g2, b2, alpha_c.astype(np.uint8)])
    tpl_c = compare_dir / "_template.png"
    Image.fromarray(template_c, "RGBA").save(str(tpl_c))

    # Light-blue fabric tile (256×256), gentle weave-ish noise so the
    # shading curves have something visible to act on.
    rng2 = np.random.default_rng(7)
    base_rgb = np.array([0.72, 0.82, 0.95], dtype=np.float32)
    noise = rng2.normal(0.0, 0.025, (256, 256, 3)).astype(np.float32)
    fab_arr = np.clip(base_rgb[None, None, :] + noise, 0.0, 1.0)
    fab_u8 = (fab_arr * 255.0).astype(np.uint8)
    fab_pil = Image.fromarray(fab_u8)
    Image.fromarray(fab_u8).save(str(compare_dir / "_fabric.png"))

    # Variant runs through apply_fabric_to_layer_v2 → apply_relative_shading,
    # using the BLAZER profile (tight shading_clip, detail 0.15) as the
    # caller surface.  We pass `light_fabric_override` straight through.
    variants = [
        ("01_current_relative_power_curve",
         dict(light_fabric_override=False)),
        ("02_light_fabric_soft",
         dict(light_fabric_override=True)),
        ("03_light_fabric_stronger_texture",
         dict(light_fabric_override=True, light_fabric_strength_cap=1.0)),
    ]
    for name, override_kwargs in variants:
        out_c = compare_dir / f"{name}.png"
        # Replicate the inner call manually so we can pass the new override
        # kwargs without touching v2's signature (which we want to keep stable
        # for cross-call compatibility).
        templ = Image.open(str(tpl_c)).convert("RGBA")
        c_arr = np.array(templ, dtype=np.float32) / 255.0
        c_rgb = c_arr[..., :3]
        c_alpha = c_arr[..., 3]
        Hc, Wc = c_arr.shape[:2]
        alpha_u8c = (c_alpha * 255.0).astype(np.uint8)
        g_mask = alpha_u8c > ALPHA_THRESHOLD
        ys, xs = np.where(g_mask)
        y0c, y1c = int(ys.min()), int(ys.max()) + 1
        x0c, x1c = int(xs.min()), int(xs.max()) + 1
        rgb_bb   = c_rgb[y0c:y1c, x0c:x1c, :]
        alpha_bb = c_alpha[y0c:y1c, x0c:x1c]
        vis_bb   = alpha_bb > (ALPHA_THRESHOLD / 255.0)
        tiled = _shirt_make_tiled_fabric(fab_pil, Wc, Hc, RENDER_TILE_SIZE, 0)
        fab_bb = tiled[y0c:y1c, x0c:x1c, :].copy()
        shaded_bb = apply_relative_shading(
            rgb_bb, alpha_bb, fab_bb,
            shading_strength=SHADING_STRENGTH,
            shading_clip=(0.3, 1.4),
            detail_blend=DETAIL_BLEND,
            alpha_threshold=ALPHA_THRESHOLD,
            **override_kwargs,
        )
        out_full = c_arr.copy()
        view = out_full[y0c:y1c, x0c:x1c, :3]
        view[vis_bb] = shaded_bb[vis_bb]
        out_full[..., 3] = c_alpha
        Image.fromarray((out_full * 255.0).astype(np.uint8), mode="RGBA").save(str(out_c))
    print(f"  compare    : 3 variants written to {compare_dir}/")
    for name, _ in variants:
        print(f"               {name}.png")

    print("\nAll tests passed.")
