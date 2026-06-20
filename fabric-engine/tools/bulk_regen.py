#!/usr/bin/env python3
"""
Bulk-regenerate per-fabric layer PNGs for tailored garments.

Recovers fabrics that were originally uploaded as BLAZER (so their suit /
tuxedo / vest / pant variants were never produced) by replaying each
fabric's source.png through every garment pipeline. Reads the original
upload from `<garment>/generated-fabrics/<fabric_id>/source.png` and
writes the rendered variants to `<garment>/generated/<fabric_id>/...`.

Usage:
    cd fabric-engine
    python3 tools/bulk_regen.py            # all fabrics, all garments
    python3 tools/bulk_regen.py --targets suit tuxedo   # subset
    python3 tools/bulk_regen.py --only custom_beyaz custom_gri
    python3 tools/bulk_regen.py --skip-existing         # don't re-render

The script is idempotent: it reads existing source.pngs and reruns the
SAME fabric_generator functions main.py calls during upload, so the
output matches what an upload would have produced.
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import fabric_generator  # noqa: E402

BLAZER_ROOT = ROOT / "public/assets/blazer"
SUIT_ROOT   = ROOT / "public/assets/suit"
TUXEDO_ROOT = ROOT / "public/assets/tuxedo"
VEST_ROOT   = ROOT / "public/assets/vest"
PANT_ROOT   = ROOT / "public/assets/pant"

# Targets keyed by short name. Each entry returns the directory the
# generator writes into (so --skip-existing can short-circuit) and a
# render function that takes (fabric_pil, fabric_id).
def _gen_blazer(pil: Image.Image, fid: str) -> int:
    return fabric_generator.generate_blazer_v2_layers(
        fabric_pil=pil,
        fabric_id=fid,
        blazer_root=BLAZER_ROOT,
    )


def _gen_suit(pil: Image.Image, fid: str) -> int:
    return fabric_generator.generate_suit_v2_layers(
        fabric_pil=pil,
        fabric_id=fid,
        suit_root=SUIT_ROOT,
    )


def _gen_garment(garment_root: Path, canonical: str):
    def run(pil: Image.Image, fid: str) -> int:
        return fabric_generator.generate_garment_layers(
            fabric_pil=pil,
            fabric_id=fid,
            garment_root=garment_root,
            garment_type=canonical,
        )
    return run


def _gen_vest(pil: Image.Image, fid: str) -> int:
    return fabric_generator.generate_vest_layers(
        fabric_pil=pil,
        fabric_id=fid,
        vest_root=VEST_ROOT,
    )


def _gen_pant(pil: Image.Image, fid: str) -> int:
    return fabric_generator.generate_pant_layers(
        fabric_pil=pil,
        fabric_id=fid,
        pant_root=PANT_ROOT,
    )


TARGETS: dict[str, tuple[Path, callable, Path | None]] = {
    # name:    (output dir,                            renderer,                                          config sentinel)
    "blazer":  (BLAZER_ROOT / "generated",             _gen_blazer,                                       BLAZER_ROOT / "blazer-white_config.json"),
    "suit":    (SUIT_ROOT   / "generated",             _gen_suit,                                     SUIT_ROOT   / "suit-white_config.json"),
    "tuxedo":  (TUXEDO_ROOT / "generated",             _gen_garment(TUXEDO_ROOT, "tuxedo"),         TUXEDO_ROOT / "manifest.json"),
    "vest":    (VEST_ROOT   / "generated",             _gen_vest,                                   VEST_ROOT   / "vest_config.json"),
    "pant":    (PANT_ROOT   / "generated",             _gen_pant,                                   PANT_ROOT   / "pant_config.json"),
}


def discover_fabrics() -> list[tuple[str, Path]]:
    """Return (fabric_id, source.png_path) tuples for every fabric that
    has at least one source.png on disk. Searches the generated-fabrics
    debug tree of every tailored garment, preferring blazer (the most
    common upload type) when multiple copies exist."""
    sources: dict[str, Path] = {}
    for root in (BLAZER_ROOT, SUIT_ROOT):
        debug_root = root / "generated-fabrics"
        if not debug_root.exists():
            continue
        for src in debug_root.glob("*/source.png"):
            fid = src.parent.name
            if fid not in sources:
                sources[fid] = src
    return sorted(sources.items())


def regen_one(
    fabric_id: str,
    source_path: Path,
    targets: Iterable[str],
    skip_existing: bool,
) -> dict[str, int | str]:
    """Render `fabric_id` against each target. Returns per-target counts
    (or the string 'skipped' / 'error: ...')."""
    pil = Image.open(source_path).convert("RGB")
    results: dict[str, int | str] = {}
    for name in targets:
        if name not in TARGETS:
            results[name] = f"error: unknown target"
            continue
        out_dir, renderer, manifest_sentinel = TARGETS[name]
        if manifest_sentinel and not manifest_sentinel.exists():
            results[name] = "error: manifest missing"
            continue
        existing = out_dir / fabric_id
        if skip_existing and existing.exists() and any(existing.rglob("*.png")):
            results[name] = "skipped"
            continue
        try:
            count = renderer(pil, fabric_id)
            results[name] = count
        except Exception as exc:
            results[name] = f"error: {exc}"
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk-regen tailored fabric variants.")
    parser.add_argument(
        "--targets", nargs="+", default=list(TARGETS.keys()),
        choices=list(TARGETS.keys()),
        help="Which garments to render into (default: all).",
    )
    parser.add_argument(
        "--only", nargs="+", default=None,
        help="Only render these fabric_ids (default: all discovered).",
    )
    parser.add_argument(
        "--skip-existing", action="store_true",
        help="If the target output dir for a fabric already has PNGs, skip.",
    )
    args = parser.parse_args()

    discovered = discover_fabrics()
    if args.only:
        wanted = set(args.only)
        discovered = [(fid, p) for fid, p in discovered if fid in wanted]
        missing = wanted - {fid for fid, _ in discovered}
        for fid in sorted(missing):
            print(f"[bulk_regen] warning: requested fabric_id={fid!r} has no source.png on disk")

    if not discovered:
        print("[bulk_regen] no source.png files found under */generated-fabrics/*/source.png")
        return 1

    print(f"[bulk_regen] fabrics={len(discovered)}  targets={','.join(args.targets)}"
          f"  skip_existing={args.skip_existing}")
    t0 = time.time()
    totals: dict[str, int] = {t: 0 for t in args.targets}
    failures: list[tuple[str, str, str]] = []  # (fabric_id, target, message)
    for fid, src in discovered:
        print(f"\n[bulk_regen] === {fid} (source: {src.relative_to(ROOT)}) ===")
        per = regen_one(fid, src, args.targets, args.skip_existing)
        for target, val in per.items():
            if isinstance(val, int):
                totals[target] += val
                print(f"  {target}: {val} layer(s) written")
            else:
                print(f"  {target}: {val}")
                if isinstance(val, str) and val.startswith("error:"):
                    failures.append((fid, target, val))
    dt = time.time() - t0
    print("\n[bulk_regen] summary:")
    for t, n in totals.items():
        print(f"  {t}: {n} layer(s) total")
    if failures:
        print(f"\n[bulk_regen] {len(failures)} failure(s):")
        for fid, t, msg in failures:
            print(f"  {fid}/{t}: {msg}")
    print(f"\n[bulk_regen] done in {dt:.1f}s")
    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
