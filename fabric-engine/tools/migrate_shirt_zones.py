#!/usr/bin/env python3
"""
migrate_shirt_zones.py — one-shot batch migration.

Walks fabric-engine/public/assets/shirts/, finds every `*_zones.py` file,
loads its ZONES_* list, and writes a sibling `*_zones.json` in the new
manifest format consumed by build-manifest.mjs and the zone_picker tool.

Old format (input):
    ZONES_FOO = [
        {"polygon": [(213, 113), ...], "rotation": 0},
        ...
    ]

New format (output):
    {
      "layerFile": "<sibling_png_name>",
      "zones": [
        {"polygon": [[213, 113], ...], "rotation": 0},
        ...
      ]
    }

Usage:
    cd fabric-engine
    python3 tools/migrate_shirt_zones.py              # dry-run preview
    python3 tools/migrate_shirt_zones.py --write      # actually write JSON
    python3 tools/migrate_shirt_zones.py --write --root public/assets/shirts
"""

from __future__ import annotations

import argparse
import json
import sys
import traceback
from pathlib import Path


def find_zones_py(root: Path) -> list[Path]:
    return sorted(root.rglob("*_zones.py"))


def load_zones_const(py_path: Path) -> list[dict]:
    """
    Exec the file in an isolated namespace and return the first list-typed
    variable whose name starts with `ZONES_`. We control these files (we
    wrote them ourselves) so exec is safe; ast.literal_eval would fail
    because the polygon literals use tuples and the values include comments.
    """
    src = py_path.read_text(encoding="utf-8")
    ns: dict = {}
    try:
        exec(compile(src, str(py_path), "exec"), ns)
    except Exception as exc:
        raise RuntimeError(f"could not exec {py_path.name}: {exc}") from exc

    for name, val in ns.items():
        if name.startswith("ZONES_") and isinstance(val, list):
            return val
    raise RuntimeError(f"no ZONES_* list found in {py_path.name}")


def normalise_zones(raw_zones: list) -> list[dict]:
    """Convert tuple polygons → list polygons; coerce rotation to float."""
    out = []
    for z in raw_zones:
        poly = z.get("polygon") if isinstance(z, dict) else None
        if not poly:
            continue
        out.append({
            "polygon": [[int(x), int(y)] for x, y in poly],
            "rotation": float(z.get("rotation", 0)),
        })
    return out


def find_sibling_png(zones_py: Path) -> str:
    """Try to locate the matching PNG by stripping `_zones` from the stem."""
    stem = zones_py.stem
    if stem.endswith("_zones"):
        base = stem[: -len("_zones")]
        candidate = zones_py.with_name(f"{base}.png")
        if candidate.exists():
            return candidate.name
    # Fallback: any PNG with the longest common prefix in the same directory
    pngs = list(zones_py.parent.glob("*.png"))
    if not pngs:
        return ""
    pngs.sort(key=lambda p: -len(p.stem))
    return pngs[0].name


def main():
    ap = argparse.ArgumentParser(description="Migrate shirt _zones.py → _zones.json")
    ap.add_argument("--root",  default="public/assets/shirts",
                    help="directory to scan (default: public/assets/shirts)")
    ap.add_argument("--write", action="store_true",
                    help="actually write JSON files (default: dry-run preview)")
    ap.add_argument("--overwrite", action="store_true",
                    help="overwrite existing _zones.json files")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        print(f"ERROR: root not found: {root}", file=sys.stderr)
        sys.exit(2)

    py_files = find_zones_py(root)
    print(f"Found {len(py_files)} _zones.py files under {root}\n")

    n_ok = n_skipped = n_failed = 0
    n_with_rotation = 0
    rotations_seen = set()

    for py in py_files:
        json_path = py.with_name(py.stem + ".json")

        if json_path.exists() and not args.overwrite:
            n_skipped += 1
            continue

        try:
            raw = load_zones_const(py)
            zones = normalise_zones(raw)
        except Exception as exc:
            print(f"  FAIL  {py.relative_to(root)}: {exc}")
            n_failed += 1
            continue

        payload = {
            "layerFile": find_sibling_png(py),
            "zones": zones,
        }

        non_zero = sum(1 for z in zones if z["rotation"] != 0)
        rotations_seen.update(z["rotation"] for z in zones)
        if non_zero:
            n_with_rotation += 1

        if args.write:
            json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
            print(f"  OK    {py.relative_to(root).with_suffix('.json')}  "
                  f"({len(zones)} zones, {non_zero} non-zero rot)")
        else:
            print(f"  PLAN  {py.relative_to(root).with_suffix('.json')}  "
                  f"({len(zones)} zones, {non_zero} non-zero rot)")
        n_ok += 1

    print()
    print(f"Summary: {n_ok} converted, {n_skipped} skipped (already exist), "
          f"{n_failed} failed")
    print(f"         {n_with_rotation} files have at least one non-zero rotation")
    print(f"         distinct rotation values seen: {sorted(rotations_seen)}")
    if not args.write:
        print("\n(dry-run; re-run with --write to actually create the JSON files)")


if __name__ == "__main__":
    main()
