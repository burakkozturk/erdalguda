#!/usr/bin/env python3
"""
web_zone_picker.py — browser-based polygon + rotation editor for fabric
layer PNGs.

Pure HTTP architecture (replaces the Tkinter version, which segfaulted on
macOS arm64 / Python 3.14 / Pillow):
  - Backend  = FastAPI on localhost.  Only does file I/O.
  - Frontend = one HTML page with HTML5 Canvas + vanilla JS.  All rendering
               happens in the browser via `createPattern` + `setTransform`.
  - The browser process is sandboxed and well-tested; no GC race with
               Python C extensions is possible.

Run:
    cd fabric-engine
    python3 tools/web_zone_picker.py            # opens http://localhost:8765
    python3 tools/web_zone_picker.py --port 9000
    python3 tools/web_zone_picker.py --root /path/to/assets --no-open

The tool stays running until you Ctrl+C in the terminal.  Saving never
closes the page; you just press the Save button (or Cmd/Ctrl+S in browser)
and the status bar turns green.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import webbrowser
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse
import uvicorn


# ─── argparse / configuration ────────────────────────────────────────────────

def parse_args():
    ap = argparse.ArgumentParser(
        description="Web-based polygon + rotation editor (no Tkinter)."
    )
    ap.add_argument(
        "--root",
        default=None,
        help="asset root directory (default: <this-script>/../public/assets)",
    )
    ap.add_argument("--host", default="127.0.0.1", help="bind host (default: 127.0.0.1)")
    ap.add_argument("--port", type=int, default=8765, help="server port (default: 8765)")
    ap.add_argument(
        "--no-open",
        action="store_true",
        help="don't auto-open the browser on startup",
    )
    return ap.parse_args()


ARGS = parse_args()

TOOL_DIR = Path(__file__).resolve().parent
DEFAULT_ROOT = (TOOL_DIR.parent / "public" / "assets").resolve()
ROOT = Path(ARGS.root).resolve() if ARGS.root else DEFAULT_ROOT

if not ROOT.exists() or not ROOT.is_dir():
    print(f"ERROR: asset root not found: {ROOT}", file=sys.stderr)
    sys.exit(2)


# ─── FastAPI app ─────────────────────────────────────────────────────────────

app = FastAPI(title="Zone Picker")


def _safe_path(rel: str) -> Path:
    """Resolve rel against ROOT, refuse anything that escapes ROOT."""
    rel = (rel or "").strip().lstrip("/")
    if not rel:
        raise HTTPException(400, "empty path")
    candidate = (ROOT / rel).resolve()
    try:
        candidate.relative_to(ROOT)
    except ValueError:
        raise HTTPException(403, f"path escapes asset root: {rel}")
    return candidate


@app.get("/", response_class=HTMLResponse)
def index():
    return HTMLResponse(HTML_PAGE)


@app.get("/api/browse")
def browse(dir: str = Query("", description="subdir relative to ROOT")):
    """List subdirectories and PNG files under ROOT/<dir>."""
    target = ROOT if not dir else _safe_path(dir)
    if not target.is_dir():
        raise HTTPException(404, f"not a directory: {dir}")

    dirs: list[dict] = []
    pngs: list[dict] = []
    for entry in sorted(target.iterdir(), key=lambda p: p.name.lower()):
        if entry.name.startswith("."):
            continue
        try:
            rel_str = str(entry.relative_to(ROOT))
        except ValueError:
            continue
        if entry.is_dir():
            dirs.append({"name": entry.name, "path": rel_str})
        elif entry.suffix.lower() == ".png":
            pngs.append({"name": entry.name, "path": rel_str})

    parent = ""
    if dir:
        parent_path = target.parent
        if parent_path == ROOT:
            parent = ""
        else:
            try:
                parent = str(parent_path.relative_to(ROOT))
            except ValueError:
                parent = ""
    return {"dir": dir, "parent": parent, "dirs": dirs, "pngs": pngs}


@app.get("/api/image")
def serve_image(path: str = Query(...)):
    p = _safe_path(path)
    if not p.exists() or p.suffix.lower() != ".png":
        raise HTTPException(404, f"png not found: {path}")
    return FileResponse(str(p), media_type="image/png")


@app.get("/api/zones")
def get_zones(path: str = Query(...)):
    """Return existing _zones.json beside <path>, or empty payload."""
    p = _safe_path(path)
    zones_path = p.with_name(p.stem + "_zones.json")
    if zones_path.exists():
        try:
            with open(zones_path, encoding="utf-8") as fh:
                return json.load(fh)
        except Exception as exc:
            raise HTTPException(500, f"failed to read existing zones: {exc}")
    return {"layerFile": p.name, "zones": []}


@app.post("/api/save")
def save_zones(payload: dict = Body(...)):
    """
    POST body:
      {
        "imagePath": "<ROOT-relative path to the PNG>",
        "zones": [{"polygon": [[x,y],...], "rotation": <deg>}, ...]
      }
    Writes <stem>_zones.json AND legacy <stem>_zones.py next to the PNG.
    """
    image_rel = payload.get("imagePath")
    zones_in = payload.get("zones")
    if not isinstance(image_rel, str) or not isinstance(zones_in, list):
        raise HTTPException(400, "imagePath (str) and zones (list) are required")

    p = _safe_path(image_rel)
    if not p.exists() or p.suffix.lower() != ".png":
        raise HTTPException(404, f"image not found: {image_rel}")

    # Normalise zones — drop anything < 3 points, coerce types.
    out_zones: list[dict] = []
    for z in zones_in:
        poly = z.get("polygon", []) if isinstance(z, dict) else []
        if not isinstance(poly, list) or len(poly) < 3:
            continue
        out_zones.append({
            "polygon": [
                [int(round(float(pt[0]))), int(round(float(pt[1])))]
                for pt in poly
            ],
            "rotation": float(z.get("rotation", 0)),
        })

    stem = p.stem
    json_path = p.with_name(f"{stem}_zones.json")
    py_path   = p.with_name(f"{stem}_zones.py")

    json_payload = {"layerFile": p.name, "zones": out_zones}
    json_text = json.dumps(json_payload, indent=2) + "\n"
    with open(json_path, "w", encoding="utf-8") as fh:
        fh.write(json_text)

    const_name = (
        "ZONES_" + stem.upper()
        .replace("-", "_").replace("+", "_").replace(".", "_")
    )
    py_lines = [
        f"# Zone config for {p.name}",
        "# Generated by tools/web_zone_picker.py",
        "# Polygons are in ORIGINAL pixel coords (origin top-left).",
        "",
        f"{const_name} = [",
    ]
    for z in out_zones:
        pts = ", ".join(f"({x}, {y})" for x, y in z["polygon"])
        py_lines.append("    {")
        py_lines.append(f'        "polygon": [{pts}],')
        py_lines.append(f'        "rotation": {z["rotation"]:.1f},')
        py_lines.append("    },")
    py_lines.append("]")
    py_lines.append("")
    with open(py_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(py_lines))

    return {
        "ok": True,
        "zones_count": len(out_zones),
        "json_path": str(json_path.relative_to(ROOT)),
        "py_path":   str(py_path.relative_to(ROOT)),
    }


# ─── HTML page (single string, served at GET /) ──────────────────────────────

HTML_PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Zone Picker</title>
<style>
  :root {
    --ivory: #f7f2e9;
    --cream: #fbf8f1;
    --charcoal: #171717;
    --navy: #152753;
    --muted: #716a60;
    --gold: #c6a15b;
    --border: rgba(35, 31, 26, 0.12);
    --surface: rgba(251, 248, 241, 0.96);
    --danger: #9f3f35;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif;
    background: linear-gradient(180deg, var(--cream), var(--ivory));
    color: var(--charcoal);
    height: 100vh;
    display: grid;
    grid-template-rows: 60px 1fr;
    grid-template-columns: 320px 1fr;
    grid-template-areas: "header header" "sidebar canvas";
    overflow: hidden;
  }
  header {
    grid-area: header;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 18px;
  }
  header h1 {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 800;
  }
  header h1::after {
    content: "";
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 8px;
    background: var(--gold);
    border-radius: 50%;
  }
  header .path-wrap {
    flex: 1;
    display: flex;
    gap: 6px;
    max-width: 720px;
  }
  header input.path {
    flex: 1;
    padding: 7px 10px;
    border: 1px solid var(--border);
    background: white;
    font-family: ui-monospace, "Menlo", monospace;
    font-size: 12px;
    border-radius: 6px;
  }
  header button {
    padding: 7px 14px;
    border: 1px solid var(--border);
    background: white;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    border-radius: 6px;
    white-space: nowrap;
  }
  header button:hover { background: var(--ivory); }
  header button.primary {
    background: var(--navy);
    color: var(--cream);
    border-color: var(--navy);
  }
  header button.primary:hover { background: #1d3469; }
  header .status {
    font-size: 12px;
    color: var(--muted);
    padding: 0 10px;
    min-width: 220px;
    max-width: 360px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
  }
  header .status.success { color: var(--gold); font-weight: 700; }
  header .status.error   { color: var(--danger); font-weight: 700; }

  aside {
    grid-area: sidebar;
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 14px;
    overflow-y: auto;
    font-size: 12px;
  }
  aside h2 {
    font-size: 10px;
    margin: 14px 0 6px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--navy);
    font-weight: 800;
  }
  aside h2:first-child { margin-top: 0; }

  .panel {
    border: 1px solid var(--border);
    background: white;
    border-radius: 6px;
  }
  .browse {
    max-height: 240px;
    overflow-y: auto;
  }
  .browse-item {
    padding: 5px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    border-bottom: 1px solid var(--border);
    font-family: ui-monospace, "Menlo", monospace;
    font-size: 11px;
  }
  .browse-item:hover { background: var(--ivory); }
  .browse-item:last-child { border-bottom: 0; }
  .browse-item .ico { width: 14px; text-align: center; flex: none; opacity: 0.7; }

  .zones-list {
    max-height: 200px;
    overflow-y: auto;
  }
  .zone-item {
    padding: 6px 10px;
    cursor: pointer;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: ui-monospace, "Menlo", monospace;
    font-size: 11px;
  }
  .zone-item:hover { background: var(--ivory); }
  .zone-item:last-child { border-bottom: 0; }
  .zone-item.active { background: var(--ivory); }
  .zone-color { width: 12px; height: 12px; border-radius: 2px; flex: none; }

  .rotation-control { padding: 10px; }
  .rotation-control .row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .rotation-control input[type=range] { flex: 1; }
  .rotation-control .value {
    font-family: ui-monospace, "Menlo", monospace;
    font-weight: 700;
    color: var(--navy);
    min-width: 50px;
    text-align: right;
    font-size: 13px;
  }
  .rotation-control .row.buttons { margin-bottom: 0; gap: 4px; }
  .rotation-control .row.buttons button {
    flex: 1;
    padding: 4px 0;
    border: 1px solid var(--border);
    background: var(--ivory);
    border-radius: 4px;
    font-size: 10px;
    cursor: pointer;
    font-family: ui-monospace, "Menlo", monospace;
  }
  .rotation-control .row.buttons button:hover { background: white; }

  .actions {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .actions button {
    flex: 1;
    padding: 6px 4px;
    border: 1px solid var(--border);
    background: white;
    cursor: pointer;
    font-size: 11px;
    border-radius: 4px;
  }
  .actions button:hover { background: var(--ivory); }

  .preview-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 6px 0;
    font-size: 12px;
  }

  .help {
    background: rgba(198, 161, 91, 0.08);
    border: 1px solid rgba(198, 161, 91, 0.3);
    border-radius: 6px;
    padding: 10px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.6;
  }
  .help kbd {
    background: white;
    padding: 1px 5px;
    border: 1px solid var(--border);
    border-radius: 3px;
    font-family: ui-monospace, "Menlo", monospace;
    font-size: 10px;
  }

  main {
    grid-area: canvas;
    background: #1c1c1c;
    overflow: auto;
    padding: 20px;
  }
  #canvasWrap {
    background: #0e0e0e;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    display: inline-block;
    line-height: 0;
  }
  #canvas {
    display: block;
    cursor: crosshair;
    max-width: 100%;
    height: auto;
  }
  .placeholder {
    color: rgba(255, 255, 255, 0.5);
    font-family: ui-monospace, "Menlo", monospace;
    font-size: 13px;
    padding: 100px 40px;
    text-align: center;
  }
</style>
</head>
<body>

<header>
  <h1>Zone Picker</h1>
  <div class="path-wrap">
    <input class="path" id="pathInput"
           placeholder="e.g. blazer/sb-1b-blazer/foo.png  (or click a PNG in the browser)">
    <button id="loadBtn">Load</button>
  </div>
  <span class="status" id="status">Ready.</span>
  <button class="primary" id="saveBtn">Save zones</button>
</header>

<aside>
  <h2>Browse asset root</h2>
  <div class="panel browse" id="browse"></div>

  <h2>Zones</h2>
  <div class="panel zones-list" id="zonesList">
    <div style="padding: 10px; color: var(--muted); font-style: italic;">
      No zones yet. Left-click on the image to start a polygon.
    </div>
  </div>

  <h2>Rotation (active zone)</h2>
  <div class="panel rotation-control">
    <div class="row">
      <input type="range" id="rotSlider" min="-180" max="180" step="1" value="0">
      <span class="value" id="rotValue">—</span>
    </div>
    <div class="row buttons">
      <button data-rot="-45">-45°</button>
      <button data-rot="-20">-20°</button>
      <button data-rot="0">0°</button>
      <button data-rot="20">+20°</button>
      <button data-rot="45">+45°</button>
    </div>
  </div>

  <h2>Actions</h2>
  <div class="actions">
    <button id="newZoneBtn">+ New</button>
    <button id="closeBtn">Close ⏎</button>
    <button id="undoBtn">Undo pt</button>
    <button id="delBtn">Delete</button>
  </div>
  <div class="preview-toggle">
    <input type="checkbox" id="previewToggle" checked>
    <label for="previewToggle">Live pinstripe preview</label>
  </div>

  <h2>Help</h2>
  <div class="help">
    <strong>Left-click:</strong> add point<br>
    <strong>Right-click:</strong> close polygon (auto-start a new one on next click)<br>
    <kbd>Enter</kbd> close · <kbd>Z</kbd> undo point · <kbd>Backspace</kbd> delete zone<br>
    <kbd>N</kbd> new zone · <kbd>P</kbd> toggle preview · <kbd>⌘S</kbd>/<kbd>Ctrl+S</kbd> save<br>
    Coords saved in <strong>original pixel space</strong>.
  </div>
</aside>

<main>
  <div id="canvasWrap">
    <canvas id="canvas" width="640" height="360"></canvas>
  </div>
</main>

<script>
'use strict';

const COLORS = ["#ff3b30","#34c759","#0a84ff","#ff9500",
                "#bf5af2","#ff2d92","#5ac8fa","#ffd60a"];

const state = {
  imagePath: null,
  image: null,           // HTMLImageElement (PNG)
  zones: [],             // {polygon:[[x,y],...], rotation:Number, closed:Bool}
  active: -1,
  preview: true,
  pinstripe: null,       // CanvasPattern
};

// ─── DOM refs ─────────────────────────────────────────────────────────────
const pathInput = document.getElementById('pathInput');
const loadBtn   = document.getElementById('loadBtn');
const saveBtn   = document.getElementById('saveBtn');
const statusEl  = document.getElementById('status');
const browseEl  = document.getElementById('browse');
const zonesEl   = document.getElementById('zonesList');
const rotSlider = document.getElementById('rotSlider');
const rotValue  = document.getElementById('rotValue');
const newBtn    = document.getElementById('newZoneBtn');
const closeBtn  = document.getElementById('closeBtn');
const undoBtn   = document.getElementById('undoBtn');
const delBtn    = document.getElementById('delBtn');
const previewT  = document.getElementById('previewToggle');
const canvas    = document.getElementById('canvas');
const ctx       = canvas.getContext('2d');

// ─── synthetic pinstripe pattern (high-contrast for visible rotation) ────
function makePinstripe() {
  const c = document.createElement('canvas');
  c.width = 24; c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#f5efe2';     // ivory
  g.fillRect(0, 0, 24, 24);
  g.fillStyle = '#101a3d';     // deep navy
  g.fillRect(0,  0, 2, 24);    // stripe 1
  g.fillRect(12, 0, 2, 24);    // stripe 2 (8px spacing, very visible)
  return ctx.createPattern(c, 'repeat');
}
state.pinstripe = makePinstripe();

// ─── status helper ───────────────────────────────────────────────────────
function setStatus(msg, kind = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

// ─── browser navigation ──────────────────────────────────────────────────
async function loadBrowse(dir = '') {
  try {
    const r = await fetch('/api/browse?dir=' + encodeURIComponent(dir));
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    browseEl.innerHTML = '';

    if (data.dir) {
      const up = document.createElement('div');
      up.className = 'browse-item';
      up.innerHTML = '<span class="ico">↑</span><span>.. ' +
                     (data.parent ? '(/' + data.parent + ')' : '(/)') + '</span>';
      up.onclick = () => loadBrowse(data.parent);
      browseEl.appendChild(up);
    }
    if (!data.dirs.length && !data.pngs.length && !data.dir) {
      browseEl.innerHTML = '<div style="padding:10px;color:#999">empty</div>';
      return;
    }
    for (const d of data.dirs) {
      const el = document.createElement('div');
      el.className = 'browse-item';
      el.innerHTML = '<span class="ico">▸</span><span>' + escapeHtml(d.name) + '/</span>';
      el.onclick = () => loadBrowse(d.path);
      browseEl.appendChild(el);
    }
    for (const p of data.pngs) {
      const el = document.createElement('div');
      el.className = 'browse-item';
      el.innerHTML = '<span class="ico">·</span><span>' + escapeHtml(p.name) + '</span>';
      el.onclick = () => loadImage(p.path);
      browseEl.appendChild(el);
    }
  } catch (e) {
    setStatus('Browse failed: ' + e.message, 'error');
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ─── load image (and any existing _zones.json) ───────────────────────────
function loadImage(path) {
  setStatus('Loading ' + path + '…');
  const img = new Image();
  img.onload = async () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    state.image = img;
    state.imagePath = path;
    pathInput.value = path;
    state.zones = [];
    state.active = -1;
    try {
      const r = await fetch('/api/zones?path=' + encodeURIComponent(path));
      if (r.ok) {
        const data = await r.json();
        state.zones = (data.zones || []).map(z => ({
          polygon: z.polygon.map(p => [Number(p[0]), Number(p[1])]),
          rotation: Number(z.rotation || 0),
          closed: true,
        }));
        state.active = state.zones.length ? 0 : -1;
      }
    } catch (e) { /* ignore */ }
    syncRotSlider();
    refreshZonesList();
    redraw();
    const note = state.zones.length
      ? ' (' + state.zones.length + ' existing zones loaded)' : '';
    setStatus('Loaded ' + path + '  ' +
              img.naturalWidth + '×' + img.naturalHeight + note);
  };
  img.onerror = () => setStatus('Failed to load image: ' + path, 'error');
  img.src = '/api/image?path=' + encodeURIComponent(path);
}

// ─── zone editing ────────────────────────────────────────────────────────
function newZone() {
  closeCurrent();
  state.zones.push({polygon: [], rotation: 0, closed: false});
  state.active = state.zones.length - 1;
  syncRotSlider();
  refreshZonesList();
  redraw();
}
function closeCurrent() {
  if (state.active < 0) return;
  const z = state.zones[state.active];
  if (z.polygon.length >= 3) z.closed = true;
  refreshZonesList();
  redraw();
}
function deleteActive() {
  if (state.active < 0) return;
  state.zones.splice(state.active, 1);
  state.active = Math.min(state.active, state.zones.length - 1);
  syncRotSlider();
  refreshZonesList();
  redraw();
}
function undoPoint() {
  if (state.active < 0) return;
  const z = state.zones[state.active];
  if (z.polygon.length) {
    z.polygon.pop();
    z.closed = false;
    refreshZonesList();
    redraw();
  }
}
function selectZone(i) {
  state.active = i;
  syncRotSlider();
  refreshZonesList();
  redraw();
}

function refreshZonesList() {
  if (!state.zones.length) {
    zonesEl.innerHTML =
      '<div style="padding:10px;color:#999;font-style:italic">' +
      'No zones yet. Left-click on the image to start a polygon.</div>';
    return;
  }
  zonesEl.innerHTML = '';
  state.zones.forEach((z, i) => {
    const color = COLORS[i % COLORS.length];
    const el = document.createElement('div');
    el.className = 'zone-item' + (i === state.active ? ' active' : '');
    const tag = z.closed ? '●' : '…';
    el.innerHTML =
      '<span class="zone-color" style="background:' + color + '"></span>' +
      '<span>Z' + i + ' ' + tag +
      '  pts=' + String(z.polygon.length).padStart(2,' ') +
      '  rot=' + z.rotation.toFixed(0).padStart(4,' ') + '°</span>';
    el.onclick = () => selectZone(i);
    zonesEl.appendChild(el);
  });
}

function syncRotSlider() {
  if (state.active >= 0) {
    const v = state.zones[state.active].rotation;
    rotSlider.value = v;
    rotValue.textContent = v.toFixed(0) + '°';
  } else {
    rotValue.textContent = '—';
  }
}

// ─── canvas interaction ──────────────────────────────────────────────────
function canvasCoords(evt) {
  // The canvas internal resolution is the PNG's original pixels.
  // CSS may scale it down; rect/scale converts back.
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  return [
    Math.round((evt.clientX - rect.left) * sx),
    Math.round((evt.clientY - rect.top) * sy),
  ];
}

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', (evt) => {
  if (!state.image) return;
  if (evt.button === 2) {           // right-click
    evt.preventDefault();
    closeCurrent();
    return;
  }
  if (evt.button !== 0) return;     // left only
  if (state.active < 0 || state.zones[state.active].closed) newZone();
  const [x, y] = canvasCoords(evt);
  state.zones[state.active].polygon.push([x, y]);
  refreshZonesList();
  redraw();
});

rotSlider.addEventListener('input', () => {
  if (state.active < 0) return;
  const v = Number(rotSlider.value);
  state.zones[state.active].rotation = v;
  rotValue.textContent = v.toFixed(0) + '°';
  refreshZonesList();
  redraw();
});

document.querySelectorAll('.rotation-control button[data-rot]').forEach(b => {
  b.addEventListener('click', () => {
    if (state.active < 0) return;
    const v = Number(b.dataset.rot);
    state.zones[state.active].rotation = v;
    rotSlider.value = v;
    rotValue.textContent = v.toFixed(0) + '°';
    refreshZonesList();
    redraw();
  });
});

newBtn.onclick   = newZone;
closeBtn.onclick = closeCurrent;
undoBtn.onclick  = undoPoint;
delBtn.onclick   = deleteActive;
previewT.onchange = () => { state.preview = previewT.checked; redraw(); };

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target !== rotSlider) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveZones();
    return;
  }
  if (e.key === 'z' || e.key === 'Z')          { undoPoint();   e.preventDefault(); }
  else if (e.key === 'Enter')                  { closeCurrent(); e.preventDefault(); }
  else if (e.key === 'Backspace' ||
           e.key === 'Delete')                 { deleteActive(); e.preventDefault(); }
  else if (e.key === 'n' || e.key === 'N')     { newZone();     e.preventDefault(); }
  else if (e.key === 'p' || e.key === 'P')     {
    state.preview = !state.preview;
    previewT.checked = state.preview;
    redraw();
    e.preventDefault();
  }
});

loadBtn.onclick = () => {
  const v = pathInput.value.trim();
  if (v) loadImage(v);
};
pathInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') loadBtn.click();
});

// ─── rendering ───────────────────────────────────────────────────────────
function redraw() {
  ctx.fillStyle = '#0e0e0e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (state.image) ctx.drawImage(state.image, 0, 0);

  // pinstripe inside each closed zone (live preview)
  if (state.preview) {
    state.zones.forEach(z => {
      if (z.closed && z.polygon.length >= 3) drawZonePinstripe(z);
    });
  }
  // outlines + points + active arrow
  state.zones.forEach((z, i) => {
    const color = COLORS[i % COLORS.length];
    const isActive = (i === state.active);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.beginPath();
    z.polygon.forEach((p, j) => {
      if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    if (z.closed) ctx.closePath();
    ctx.stroke();
    // points
    z.polygon.forEach((p, j) => {
      const r = (isActive && j === z.polygon.length - 1) ? 7 : 5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'white';
      ctx.stroke();
    });
    // rotation arrow at centroid (active + closed)
    if (z.closed && isActive && z.polygon.length >= 3) {
      const c = centroid(z.polygon);
      const len = Math.max(40, polygonRadius(z.polygon, c) * 0.5);
      const rad = z.rotation * Math.PI / 180;
      const dx =  Math.sin(rad) * len;
      const dy = -Math.cos(rad) * len;     // canvas y is down
      const ex = c[0] + dx, ey = c[1] + dy;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'white';
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // arrow head
      const headLen = 14;
      const ang = Math.atan2(dy, dx);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - headLen * Math.cos(ang - Math.PI / 6),
                 ey - headLen * Math.sin(ang - Math.PI / 6));
      ctx.lineTo(ex - headLen * Math.cos(ang + Math.PI / 6),
                 ey - headLen * Math.sin(ang + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.fill();
      // label
      ctx.fillStyle = 'white';
      ctx.font = 'bold 18px ui-monospace, Menlo, monospace';
      ctx.fillText(z.rotation.toFixed(0) + '°', ex + 8, ey);
    }
    ctx.restore();
  });
}

function drawZonePinstripe(z) {
  ctx.save();
  // clip to polygon
  ctx.beginPath();
  z.polygon.forEach((p, j) => {
    if (j === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.clip();
  // overlay at 70% opacity
  ctx.globalAlpha = 0.75;
  // rotate pattern around polygon centroid
  const c = centroid(z.polygon);
  ctx.translate(c[0], c[1]);
  ctx.rotate(z.rotation * Math.PI / 180);  // matches PIL.Image.rotate convention
  ctx.translate(-c[0], -c[1]);
  ctx.fillStyle = state.pinstripe;
  // fill a generous box so rotated pattern fully covers the polygon
  const r = polygonRadius(z.polygon, c) * 1.6 + 60;
  ctx.fillRect(c[0] - r, c[1] - r, r * 2, r * 2);
  ctx.restore();
}

function centroid(poly) {
  let sx = 0, sy = 0;
  for (const p of poly) { sx += p[0]; sy += p[1]; }
  return [sx / poly.length, sy / poly.length];
}
function polygonRadius(poly, c) {
  let r = 0;
  for (const p of poly) {
    const dx = p[0] - c[0], dy = p[1] - c[1];
    const d = Math.hypot(dx, dy);
    if (d > r) r = d;
  }
  return r;
}

// ─── save (POST to backend) ──────────────────────────────────────────────
async function saveZones() {
  if (!state.imagePath) {
    setStatus('Load an image first.', 'error');
    return;
  }
  const closed = state.zones.filter(z => z.closed && z.polygon.length >= 3);
  setStatus('Saving…');
  try {
    const r = await fetch('/api/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        imagePath: state.imagePath,
        zones: closed.map(z => ({polygon: z.polygon, rotation: z.rotation})),
      }),
    });
    if (!r.ok) {
      const txt = await r.text();
      throw new Error(txt || (r.status + ' ' + r.statusText));
    }
    const data = await r.json();
    setStatus('Saved! ' + data.zones_count + ' zones → ' + data.json_path,
              'success');
  } catch (e) {
    setStatus('Save failed: ' + e.message, 'error');
  }
}
saveBtn.onclick = saveZones;

// ─── boot ────────────────────────────────────────────────────────────────
loadBrowse('');
</script>
</body>
</html>
"""


# ─── entry point ─────────────────────────────────────────────────────────────

def _open_browser_after_delay(url: str, delay_s: float = 0.8):
    def _open():
        try:
            webbrowser.open(url)
        except Exception:
            pass
    t = threading.Timer(delay_s, _open)
    t.daemon = True
    t.start()


def main():
    url = f"http://{ARGS.host}:{ARGS.port}/"
    print(f"[web_zone_picker] asset root: {ROOT}")
    print(f"[web_zone_picker] open: {url}")
    print(f"[web_zone_picker] Ctrl+C to stop the server.")
    if not ARGS.no_open:
        _open_browser_after_delay(url)
    uvicorn.run(app, host=ARGS.host, port=ARGS.port, log_level="warning")


if __name__ == "__main__":
    main()
