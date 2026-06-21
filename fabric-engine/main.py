"""
backend/main.py — local FastAPI backend for the blazer fabric generator.

Run from the backend/ directory:
    uvicorn main:app --reload --port 8000

The Vite dev server proxies /api → http://localhost:8000, so no CORS is needed
when running both servers together. The CORS middleware below handles direct
browser access if you bypass the proxy (e.g. testing with curl or Insomnia).
"""

import json
import re
import subprocess
import urllib.request
import urllib.error
from io import BytesIO

import numpy as np
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image

import fabric_generator
from s3_assets import delete_fabric_assets, public_url

# ---------------------------------------------------------------------------
# Paths — PROJECT_ROOT is two levels up from backend/main.py
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).parent
FABRICS_JSON = PROJECT_ROOT / "public/assets/blazer/fabrics.json"
STYLES_JSON = PROJECT_ROOT / "public/assets/blazer/styles.json"
ASSETS_ROOT = PROJECT_ROOT / "public/assets/blazer"
SWATCHES_DIR = ASSETS_ROOT / "generated-swatches"
GENERATED_DIR = ASSETS_ROOT / "generated-fabrics"
SUIT_ASSETS_ROOT   = PROJECT_ROOT / "public/assets/suit"
SHIRT_ASSETS_ROOT  = PROJECT_ROOT / "public/assets/shirts"
TUXEDO_ASSETS_ROOT = PROJECT_ROOT / "public/assets/tuxedo"
VEST_ASSETS_ROOT   = PROJECT_ROOT / "public/assets/vest"
PANT_ASSETS_ROOT   = PROJECT_ROOT / "public/assets/pant"
COAT_ASSETS_ROOT   = PROJECT_ROOT / "public/assets/coat"

# Map the incoming `garment_type` form value to the asset root directory
# and the canonical short name used in URLs / log labels.
# Accepts mixed case for resilience; the frontend currently sends 'JACKET'
# and 'SUIT' (and lowercase variants).
TAILORED_GARMENT_ROOTS: dict[str, tuple[Path, str]] = {
    "JACKET":   (ASSETS_ROOT,      "blazer"),   # legacy alias for blazer
    "BLAZER":   (ASSETS_ROOT,      "blazer"),
    "BLAZER ":  (ASSETS_ROOT,      "blazer"),   # tolerate trailing space
    "blazer":   (ASSETS_ROOT,      "blazer"),
    "SUIT":     (SUIT_ASSETS_ROOT, "suit"),
    "suit":     (SUIT_ASSETS_ROOT, "suit"),
}

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Blazer Fabric Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated (and base) assets straight off local disk for local dev, so
# the frontend can load textures without S3. The frontend points
# VITE_S3_ASSET_BASE_URL at http://localhost:8000/assets to use this.
app.mount("/assets", StaticFiles(directory=PROJECT_ROOT / "public/assets"), name="assets")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_json(path: Path) -> list | dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _save_json(path: Path, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


def _notify_spring_boot(fabric_id: str, fabric_key: str, name: str, tag: str = "", garment_type: str = "JACKET") -> None:
    payload = json.dumps({
        "fabricId": fabric_id,
        "key": fabric_key,
        "name": name,
        "label": "Custom uploaded fabric",
        "subtitle": "Custom uploaded fabric",
        "defaultFabric": False,
        "createdBy": "system",
        "type": garment_type,
        "tag": tag or None,
        "inStock": True,
    }).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:8080/api/fabrics",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"[generate] Spring Boot notified — status {resp.status}")
    except Exception as exc:
        print(f"[generate] Spring Boot notification failed (ignored): {exc}")


def _make_fabric_id(name: str, existing_ids: set[str]) -> str:
    slug = _slugify(name) or "fabric"
    base = f"custom_{slug}"
    if base not in existing_ids:
        return base
    for i in range(2, 1000):
        candidate = f"{base}_{i:03d}"
        if candidate not in existing_ids:
            return candidate
    raise ValueError("Could not generate a unique fabric id — try a different name.")

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/shirts/config")
def get_shirt_config():
    """Return shirt_config.json so the frontend ShirtConfigurator can load options."""
    config_path = SHIRT_ASSETS_ROOT / "shirt_config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="shirt_config.json not found.")
    return _load_json(config_path)


@app.get("/api/vests/config")
def get_vest_config():
    """Return vest_config.json so the frontend VestConfigurator can load options."""
    config_path = VEST_ASSETS_ROOT / "vest_config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="vest_config.json not found.")
    return _load_json(config_path)


@app.get("/api/pants/config")
def get_pant_config():
    """Return pant_config.json so the frontend PantConfigurator can load options."""
    config_path = PANT_ASSETS_ROOT / "pant_config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="pant_config.json not found.")
    return _load_json(config_path)


@app.get("/api/coats/config")
def get_coat_config():
    """Return coat_config.json so the frontend CoatConfigurator can load options."""
    config_path = COAT_ASSETS_ROOT / "coat_config.json"
    if not config_path.exists():
        raise HTTPException(status_code=404, detail="coat_config.json not found.")
    return _load_json(config_path)


@app.post("/api/fabrics/generate")
async def generate_fabric(
    name: str = Form(...),
    file: UploadFile = File(...),
    texture_detail_strength: float = Form(fabric_generator.TEXTURE_DETAIL_STRENGTH),
    shading_strength: float = Form(fabric_generator.SHADING_STRENGTH),
    render_tile_size: int = Form(fabric_generator.RENDER_TILE_SIZE),
    tag: str = Form(""),
    garment_type: str = Form("JACKET"),
):
    # ---- validate -------------------------------------------------------
    if not name.strip():
        raise HTTPException(status_code=400, detail="Fabric name is required.")
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    # ---- read image ------------------------------------------------------
    img_bytes = await file.read()
    try:
        fabric_pil = Image.open(BytesIO(img_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image.")

    # ---- unique fabric id (shared by both garment types) ----------------
    existing_ids: set[str] = set()
    if FABRICS_JSON.exists():
        existing_ids = {f["fabricId"] for f in _load_json(FABRICS_JSON)}

    try:
        fabric_id = _make_fabric_id(name.strip(), existing_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    fabric_key = fabric_id.replace("_", "-")

    # ---- SHIRT branch ---------------------------------------------------
    if garment_type == "SHIRT":
        print(f"\n[generate] SHIRT fabric_id={fabric_id!r}")
        generated_count = fabric_generator.generate_shirt_layers(
            fabric_pil=fabric_pil,
            fabric_id=fabric_id,
            shirts_root=SHIRT_ASSETS_ROOT,
            texture_detail_strength=float(np.clip(texture_detail_strength, 0, 1)),
            shading_strength=float(np.clip(shading_strength, 0, 1)),
            render_tile_size=int(np.clip(render_tile_size, 60, 600)),
        )
        print(f"[generate] SHIRT done — {generated_count} layers written")
        _notify_spring_boot(fabric_id, fabric_key, name.strip(), tag=tag.strip(), garment_type="SHIRT")
        return {
            "ok": True,
            "fabric": {
                "key": fabric_key,
                "fabricId": fabric_id,
                "label": name.strip(),
                "swatchSrc": public_url(f"shirts/generated-swatches/{fabric_id}.png"),
            },
            "generatedLayers": generated_count,
        }

    # ---- VEST branch ----------------------------------------------------
    if garment_type == "VEST":
        print(f"\n[generate] VEST fabric_id={fabric_id!r}")
        generated_count = fabric_generator.generate_vest_layers(
            fabric_pil=fabric_pil,
            fabric_id=fabric_id,
            vest_root=VEST_ASSETS_ROOT,
            texture_detail_strength=float(np.clip(texture_detail_strength, 0, 1)),
            shading_strength=float(np.clip(shading_strength, 0, 1)),
            render_tile_size=int(np.clip(render_tile_size, 60, 600)),
        )
        print(f"[generate] VEST done — {generated_count} layers written")
        _notify_spring_boot(fabric_id, fabric_key, name.strip(), tag=tag.strip(), garment_type="JACKET")
        return {
            "ok": True,
            "fabric": {
                "key": fabric_key,
                "fabricId": fabric_id,
                "label": name.strip(),
                "swatchSrc": public_url(f"vest/generated-swatches/{fabric_id}.png"),
            },
            "generatedLayers": generated_count,
        }

    # ---- PANT branch ----------------------------------------------------
    if garment_type == "PANT":
        print(f"\n[generate] PANT fabric_id={fabric_id!r}")
        generated_count = fabric_generator.generate_pant_layers(
            fabric_pil=fabric_pil,
            fabric_id=fabric_id,
            pant_root=PANT_ASSETS_ROOT,
            texture_detail_strength=float(np.clip(texture_detail_strength, 0, 1)),
            shading_strength=float(np.clip(shading_strength, 0, 1)),
            render_tile_size=int(np.clip(render_tile_size, 60, 600)),
        )
        print(f"[generate] PANT done — {generated_count} layers written")
        _notify_spring_boot(fabric_id, fabric_key, name.strip(), tag=tag.strip(), garment_type="JACKET")
        return {
            "ok": True,
            "fabric": {
                "key": fabric_key,
                "fabricId": fabric_id,
                "label": name.strip(),
                "swatchSrc": public_url(f"pant/generated-swatches/{fabric_id}.png"),
            },
            "generatedLayers": generated_count,
        }

    # ---- COAT branch ----------------------------------------------------
    if garment_type == "COAT":
        print(f"\n[generate] COAT fabric_id={fabric_id!r}")
        generated_count = fabric_generator.generate_coat_layers(
            fabric_pil=fabric_pil,
            fabric_id=fabric_id,
            coat_root=COAT_ASSETS_ROOT,
            texture_detail_strength=float(np.clip(texture_detail_strength, 0, 1)),
            shading_strength=float(np.clip(shading_strength, 0, 1)),
            render_tile_size=int(np.clip(render_tile_size, 60, 600)),
        )
        print(f"[generate] COAT done — {generated_count} layers written")
        _notify_spring_boot(fabric_id, fabric_key, name.strip(), tag=tag.strip(), garment_type="JACKET")
        return {
            "ok": True,
            "fabric": {
                "key": fabric_key,
                "fabricId": fabric_id,
                "label": name.strip(),
                "swatchSrc": public_url(f"coat/generated-swatches/{fabric_id}.png"),
            },
            "generatedLayers": generated_count,
        }

    # ---- BLAZER / SUIT branch (manifest-driven, dynamic asset root) -----
    #
    # Both garment types share the same flat-asset layout (base / lapels /
    # hip-pocket categories in <root>/manifest.json) and the same render
    # profile, so the dispatch is unified.  TAILORED_GARMENT_ROOTS maps the
    # incoming string to (asset_root, canonical_name).
    if garment_type not in TAILORED_GARMENT_ROOTS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported garment_type={garment_type!r}. "
                f"Expected one of: {sorted(set(TAILORED_GARMENT_ROOTS.keys()))}"
            ),
        )
    garment_root, canonical = TAILORED_GARMENT_ROOTS[garment_type]

    _CONFIG_SENTINELS = {
        "blazer": "blazer-white_config.json",
        "suit":   "suit-white_config.json",
    }
    config_sentinel = garment_root / _CONFIG_SENTINELS.get(canonical, "manifest.json")
    if not config_sentinel.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Config not found: public/assets/{canonical}/{config_sentinel.name}",
        )

    fabrics: list = _load_json(FABRICS_JSON) if FABRICS_JSON.exists() else []

    # ---- prepare per-garment directories --------------------------------
    swatches_dir   = garment_root / "generated-swatches"
    debug_root_dir = garment_root / "generated-fabrics"
    swatches_dir.mkdir(parents=True, exist_ok=True)
    source_dir = debug_root_dir / fabric_id
    source_dir.mkdir(parents=True, exist_ok=True)

    # ---- save source image (under <garment>/generated-fabrics/<id>/) ----
    fabric_pil.save(source_dir / "source.png", "PNG")

    # ---- render every fabricDependent layer ---------------------------------
    print(f"\n[generate] {canonical.upper()} fabric_id={fabric_id!r}")
    try:
        _clipped = dict(
            texture_detail_strength=float(np.clip(texture_detail_strength, 0, 1)),
            shading_strength=float(np.clip(shading_strength, 0, 1)),
            render_tile_size=int(np.clip(render_tile_size, 60, 600)),
        )
        if canonical == "blazer":
            generated_count = fabric_generator.generate_blazer_v2_layers(
                fabric_pil=fabric_pil, fabric_id=fabric_id,
                blazer_root=garment_root, **_clipped,
            )
        elif canonical == "suit":
            generated_count = fabric_generator.generate_suit_v2_layers(
                fabric_pil=fabric_pil, fabric_id=fabric_id,
                suit_root=garment_root, **_clipped,
            )
        else:
            generated_count = fabric_generator.generate_garment_layers(
                fabric_pil=fabric_pil, fabric_id=fabric_id,
                garment_root=garment_root, garment_type=canonical, **_clipped,
            )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    print(f"[generate] {canonical.upper()} done — {generated_count} layers written")

    # ---- update fabrics.json (registry only; cross-garment id uniqueness)
    # The template manifest doesn't reference per-fabric files, so we never
    # need to rebuild it on a new fabric upload.
    new_entry = {
        "key": fabric_key,
        "fabricId": fabric_id,
        "label": name.strip(),
        "subtitle": "Custom uploaded fabric",
        "swatchSrc": public_url(f"{canonical}/generated-swatches/{fabric_id}.png"),
        "color": None,
        "garmentType": canonical,
    }
    fabrics.append(new_entry)
    _save_json(FABRICS_JSON, fabrics)

    # ---- Cross-generate every other tailored garment manifest -----------
    # Every fabric upload (blazer OR suit) now also generates the missing
    # variants for the SIBLING tailored manifests (blazer↔suit) and tuxedo,
    # plus the vest + pant configs.  Each garment renders against its OWN
    # manifest's zone polygons, so the Zone Picker markings live in each
    # garment's manifest.json and are honoured per upload.
    clipped_detail   = float(np.clip(texture_detail_strength, 0, 1))
    clipped_shading  = float(np.clip(shading_strength, 0, 1))
    clipped_tile     = int(np.clip(render_tile_size, 60, 600))

    # All three tailored manifests (blazer, suit, tuxedo) use the same
    # categories+zones schema, so we drive them through the unified
    # generate_garment_layers function. Each manifest carries its own
    # Zone Picker polygons, so stripe/pattern rotation is preserved
    # per-garment.
    sibling_targets: list[tuple[Path, str]] = [
        (ASSETS_ROOT,        "blazer"),
        (SUIT_ASSETS_ROOT,   "suit"),
        (TUXEDO_ASSETS_ROOT, "tuxedo"),
    ]
    tuxedo_count = 0
    _sibling_clipped = dict(
        texture_detail_strength=clipped_detail,
        shading_strength=clipped_shading,
        render_tile_size=clipped_tile,
    )
    for target_root, target_canonical in sibling_targets:
        if target_canonical == canonical:
            continue  # primary upload already wrote this one
        print(f"[generate] cross-generating {target_canonical.upper()} layers for {fabric_id!r}")
        try:
            if target_canonical == "blazer":
                if not (target_root / "blazer-white_config.json").exists():
                    continue
                sibling_count = fabric_generator.generate_blazer_v2_layers(
                    fabric_pil=fabric_pil, fabric_id=fabric_id,
                    blazer_root=target_root, **_sibling_clipped,
                )
            elif target_canonical == "suit":
                if not (target_root / "suit-white_config.json").exists():
                    continue
                sibling_count = fabric_generator.generate_suit_v2_layers(
                    fabric_pil=fabric_pil, fabric_id=fabric_id,
                    suit_root=target_root, **_sibling_clipped,
                )
            else:
                if not (target_root / "manifest.json").exists():
                    continue
                sibling_count = fabric_generator.generate_garment_layers(
                    fabric_pil=fabric_pil, fabric_id=fabric_id,
                    garment_root=target_root, garment_type=target_canonical,
                    **_sibling_clipped,
                )
                if target_canonical == "tuxedo":
                    tuxedo_count = sibling_count
            print(f"[generate] {target_canonical.upper()} done — {sibling_count} layers written")
        except Exception as e:
            print(f"[generate] {target_canonical.upper()} generation failed: {e}")

    if (VEST_ASSETS_ROOT / "vest_config.json").exists():
        try:
            vest_count = fabric_generator.generate_vest_layers(
                fabric_pil=fabric_pil,
                fabric_id=fabric_id,
                vest_root=VEST_ASSETS_ROOT,
                texture_detail_strength=clipped_detail,
                shading_strength=clipped_shading,
                render_tile_size=clipped_tile,
            )
            print(f"[generate] VEST done — {vest_count} layers written")
        except Exception as e:
            print(f"[generate] VEST generation failed: {e}")

    if (PANT_ASSETS_ROOT / "pant_config.json").exists():
        try:
            pant_count = fabric_generator.generate_pant_layers(
                fabric_pil=fabric_pil,
                fabric_id=fabric_id,
                pant_root=PANT_ASSETS_ROOT,
                texture_detail_strength=clipped_detail,
                shading_strength=clipped_shading,
                render_tile_size=clipped_tile,
            )
            print(f"[generate] PANT done — {pant_count} layers written")
        except Exception as e:
            print(f"[generate] PANT generation failed: {e}")

    if (COAT_ASSETS_ROOT / "coat_config.json").exists():
        try:
            coat_count = fabric_generator.generate_coat_layers(
                fabric_pil=fabric_pil,
                fabric_id=fabric_id,
                coat_root=COAT_ASSETS_ROOT,
                texture_detail_strength=clipped_detail,
                shading_strength=clipped_shading,
                render_tile_size=clipped_tile,
            )
            print(f"[generate] COAT done — {coat_count} layers written")
        except Exception as e:
            print(f"[generate] COAT generation failed: {e}")

    # Spring Boot gets the canonical garment type — backend enum only
    # accepts JACKET / SHIRT today, so map suit → JACKET for now (the
    # platform treats a suit as a jacket-class fabric in its catalog).
    spring_type = "JACKET"
    _notify_spring_boot(fabric_id, fabric_key, name.strip(), tag=tag.strip(),
                        garment_type=spring_type)

    return {
        "ok": True,
        "garmentType": canonical,
        "fabric": new_entry,
        "generatedLayers": generated_count,
        "tuxedoLayers": tuxedo_count,
    }

import shutil

@app.delete("/api/fabrics/{fabric_id}")
async def delete_fabric(fabric_id: str):
    if fabric_id == "2191":
        raise HTTPException(status_code=400, detail="Cannot delete default fabric")
    fabrics = _load_json(FABRICS_JSON)
    original_count = len(fabrics)
    fabrics = [f for f in fabrics if f.get("fabricId") != fabric_id]
    if len(fabrics) == original_count:
        raise HTTPException(status_code=404, detail=f"Not found: {fabric_id}")
    _save_json(FABRICS_JSON, fabrics)
    # Per-fabric variant trees + swatches + debug, across every tailored
    # garment root we know about (blazer + suit, today).
    for tailored_root in {ASSETS_ROOT, SUIT_ASSETS_ROOT}:
        gen_tree = tailored_root / "generated" / fabric_id
        if gen_tree.exists():
            shutil.rmtree(gen_tree)
        swatch = tailored_root / "generated-swatches" / f"{fabric_id}.png"
        if swatch.exists():
            swatch.unlink()
        debug_tree = tailored_root / "generated-fabrics" / fabric_id
        if debug_tree.exists():
            shutil.rmtree(debug_tree)
    tuxedo_gen_dir = TUXEDO_ASSETS_ROOT / "generated" / fabric_id
    if tuxedo_gen_dir.exists():
        shutil.rmtree(tuxedo_gen_dir)
    vest_gen = VEST_ASSETS_ROOT / "generated" / fabric_id
    if vest_gen.exists():
        shutil.rmtree(vest_gen)
    pant_gen = PANT_ASSETS_ROOT / "generated" / fabric_id
    if pant_gen.exists():
        shutil.rmtree(pant_gen)
    coat_gen = COAT_ASSETS_ROOT / "generated" / fabric_id
    if coat_gen.exists():
        shutil.rmtree(coat_gen)
    delete_fabric_assets(["blazer", "suit", "tuxedo", "shirts", "vest", "pant", "coat"], fabric_id)
    return {"deleted": fabric_id}
