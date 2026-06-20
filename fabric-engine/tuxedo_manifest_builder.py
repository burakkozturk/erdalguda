#!/usr/bin/env python3
"""
Parses tuxedo PNG filenames and builds tuxedo_manifest.json.

File categories found in the source folder:
  - 2192_fabric  → fabric-dependent jacket layers
  - satin__1     → satin-trim jacket layers (lapel facing, buttons, pocket trim)
  - linings      → static lining layers
  - etiquetas    → static label/badge layer
  - pants        → trousers layers (fabric + satin)

Z-index scheme (assigned by role since filenames carry no __zNNN__ token):
  Pants body fabric     : 20
  Pants pockets fabric  : 25–26
  Pants satin stripe    : 30
  Pants satin buttons   : 35
  Jacket interior back  : 45–47
  Jacket body fabric    : 50
  Jacket lining static  : 46–47  (same visual level as interior)
  Breast pocket fabric  : 62
  Hip pocket fabric     : 65–66
  Jacket neck fabric    : 119
  Satin lapel facing    : 130
  Satin button covers   : 160
  Satin pocket trim     : 170
  Etiqueta (badge)      : 300
"""

import json
import re
from pathlib import Path

ASSET_DIR = Path(__file__).parent / "public" / "assets" / "tuxedo"
OUTPUT    = ASSET_DIR / "tuxedo_manifest.json"


# ---------------------------------------------------------------------------
# Z-index assignment
# ---------------------------------------------------------------------------

def get_zindex(fname: str) -> int:
    # ── Pants ──────────────────────────────────────────────────────────────
    if "__pants__" in fname:
        if "satin" in fname:
            return 35 if "buttons" in fname else 30
        if "length_long" in fname:
            return 20
        if "front_pocket" in fname:
            return 25
        if "back_pocket" in fname:
            return 26
        return 22

    # ── Static (linings / etiqueta) ────────────────────────────────────────
    if "etiquetas" in fname:
        return 300
    if "linings" in fname:
        return 47 if "espalda_arriba" in fname else 46

    # ── Satin jacket layers ────────────────────────────────────────────────
    if "satin__1" in fname:
        if "hip_pockets" in fname:
            return 170
        if "buttons__neck" in fname:   # satin button covers
            return 160
        if "neck_" in fname:           # satin lapel facing
            return 130
        return 128

    # ── Fabric jacket layers ───────────────────────────────────────────────
    if "interior__espalda_abajo" in fname:  return 45
    if "interior__espalda_arriba" in fname: return 46
    if "interior__sleeves" in fname:        return 47
    if "bottom_single_breasted" in fname:   return 50
    if "bottom_double_breasted" in fname:   return 50
    if "breast_pocket_classic" in fname:    return 62
    if "hip_pockets" in fname:
        return 65 if "double_welt" in fname else 66
    if "neck_" in fname:
        return 119

    return 100  # fallback


# ---------------------------------------------------------------------------
# Combination parsers
# ---------------------------------------------------------------------------

def parse_neck_combination(fname: str) -> dict | None:
    m = re.search(
        r"neck_(single_breasted|double_breasted)"
        r"__buttons_(\d+)"
        r"__lapel_(narrow|medium|wide)"
        r"__style_lapel_(notch|peak|round)",
        fname,
    )
    if not m:
        return None
    return {
        "breasted":   m.group(1),
        "buttons":    int(m.group(2)),
        "lapelWidth": m.group(3),
        "lapelStyle": m.group(4),
    }


def parse_pocket_combination(fname: str) -> dict | None:
    if "double_welt" in fname:
        ptype = "double_welt_third" if "__third" in fname else "double_welt"
    elif "with_flap" in fname:
        ptype = "with_flap_third" if "__third" in fname else "with_flap"
    else:
        return None
    return {"pocketType": ptype}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    files = sorted(f.name for f in ASSET_DIR.glob("*.png"))
    print(f"Found {len(files)} PNG files in {ASSET_DIR.relative_to(Path(__file__).parent)}")

    static_layers: list[dict] = []
    satin_layers:  list[dict] = []
    fabric_layers: list[dict] = []
    pants_layers:  list[dict] = []

    unclassified: list[str] = []

    for fname in files:
        z = get_zindex(fname)

        # ── Pants ───────────────────────────────────────────────────────────
        if "__pants__" in fname:
            if "2192_fabric" in fname:
                pants_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "pants_fabric", "fabricDependent": True,
                })
            else:  # satin
                pants_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "pants_satin", "fabricDependent": False,
                })
            continue

        # ── Static ──────────────────────────────────────────────────────────
        if "linings" in fname or "etiquetas" in fname:
            static_layers.append({
                "file": fname, "zIndex": z, "kind": "static",
            })
            continue

        # ── Satin jacket ────────────────────────────────────────────────────
        if "satin__1" in fname:
            if "hip_pockets" in fname:
                satin_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "satin_pocket",
                    "combination": parse_pocket_combination(fname),
                })
            elif "buttons__neck" in fname:
                satin_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "satin_buttons",
                    "combination": parse_neck_combination(fname),
                })
            elif "neck_" in fname:
                satin_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "satin_lapel",
                    "combination": parse_neck_combination(fname),
                })
            else:
                satin_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "satin", "combination": None,
                })
            continue

        # ── Fabric jacket ───────────────────────────────────────────────────
        if "2192_fabric" in fname:
            if "interior__" in fname or "bottom_single_breasted" in fname or "bottom_double_breasted" in fname:
                fabric_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "base", "fabricDependent": True, "combination": None,
                })
            elif "breast_pocket_classic" in fname:
                fabric_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "breastPocket", "fabricDependent": True, "combination": None,
                })
            elif "hip_pockets" in fname:
                fabric_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "hipPocket", "fabricDependent": True,
                    "combination": parse_pocket_combination(fname),
                })
            elif "neck_" in fname:
                fabric_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "neck", "fabricDependent": True,
                    "combination": parse_neck_combination(fname),
                })
            else:
                fabric_layers.append({
                    "file": fname, "zIndex": z,
                    "kind": "unknown", "fabricDependent": True, "combination": None,
                })
            continue

        unclassified.append(fname)

    # Sort by z-index within each bucket
    for bucket in (static_layers, satin_layers, fabric_layers, pants_layers):
        bucket.sort(key=lambda x: (x["zIndex"], x["file"]))

    if unclassified:
        print(f"\nWARNING: {len(unclassified)} unclassified files:")
        for f in unclassified:
            print(f"  {f}")

    manifest = {
        "fabricId": "2192",
        "static_layers": static_layers,
        "satin_layers": satin_layers,
        "fabric_layers": fabric_layers,
        "pants_layers": pants_layers,
        "options": {
            "styles": [
                "single_breasted_1",
                "single_breasted_2",
                "single_breasted_3",
                "double_breasted_2",
                "double_breasted_4",
                "double_breasted_6",
            ],
            "lapelStyles":  ["notch", "peak", "shawl"],
            "lapelWidths":  ["narrow", "medium", "wide"],
            "pockets":      [
                "no_pocket",
                "double_welt",
                "double_welt_third",
                "with_flap",
                "with_flap_third",
            ],
        },
    }

    OUTPUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"\nWrote → {OUTPUT}")

    # ── Summary ─────────────────────────────────────────────────────────────
    sl   = satin_layers
    fl   = fabric_layers
    pl   = pants_layers
    stl  = static_layers

    def count(lst, kind):
        return sum(1 for x in lst if x["kind"] == kind)

    total = len(stl) + len(sl) + len(fl) + len(pl)

    print(f"""
=== MANIFEST SUMMARY ===
  static_layers  : {len(stl)}
  satin_layers   : {len(sl)}
    satin_lapel    {count(sl, 'satin_lapel'):>3}   (lapel facing, z=130)
    satin_buttons  {count(sl, 'satin_buttons'):>3}   (button covers, z=160)
    satin_pocket   {count(sl, 'satin_pocket'):>3}   (pocket trim, z=170)
  fabric_layers  : {len(fl)}
    base           {count(fl, 'base'):>3}   (interior + body, z=45–50)
    breastPocket   {count(fl, 'breastPocket'):>3}   (z=62)
    hipPocket      {count(fl, 'hipPocket'):>3}   (z=65–66)
    neck           {count(fl, 'neck'):>3}   (lapel fabric, z=119)
  pants_layers   : {len(pl)}
    pants_fabric   {count(pl, 'pants_fabric'):>3}
    pants_satin    {count(pl, 'pants_satin'):>3}
  ─────────────────────
  TOTAL          : {total}
""")

    # Verify neck style options derived from actual files
    styles_found = set()
    for layer in fl:
        if layer["kind"] == "neck" and layer["combination"]:
            c = layer["combination"]
            key = f"{c['breasted']}_{c['buttons']}"
            styles_found.add(key)
    print(f"Neck style combos found: {sorted(styles_found)}")

    lapel_widths = {
        c["combination"]["lapelWidth"]
        for c in fl
        if c["kind"] == "neck" and c["combination"]
    }
    lapel_styles = {
        c["combination"]["lapelStyle"]
        for c in fl
        if c["kind"] == "neck" and c["combination"]
    }
    print(f"Lapel widths: {sorted(lapel_widths)}")
    print(f"Lapel styles: {sorted(lapel_styles)}")

    pockets_found = {
        c["combination"]["pocketType"]
        for c in fl
        if c["kind"] == "hipPocket" and c["combination"]
    }
    print(f"Pocket types: {sorted(pockets_found)}")


if __name__ == "__main__":
    main()
