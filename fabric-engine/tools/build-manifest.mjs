/**
 * build-manifest.mjs — flat-directory + master-JSON manifest builder.
 *
 * The legacy build (one folder per style — sb-1b-blazer, sb-2b-blazer, …)
 * has been replaced with a single flat asset directory per garment:
 *
 *   public/assets/<garment>/
 *     <garment>_master_assets_config.json
 *     base/<file>.png
 *     lapels/<file>.png
 *     hip-pocket/<file>.png
 *     misc/<file>.png
 *
 * Layer hierarchy + z-index live in the master JSON.  Variant info
 * (breast style, button count, lapel width, lapel style, pocket style…)
 * is encoded in the filename via `+`-separated tokens, e.g.:
 *
 *   neck_single_breasted+buttons_2+lapel_medium+style_lapel_notch.png
 *   breast_pocket_classic+neck_single_breasted+buttons_1+lapel_wide+style_lapel_peak.png
 *   hip_pockets_with_flap+fit_slim+third.png
 *   interior+espalda_abajo+length_long.png
 *   bottom_single_breasted+length_long+hemline_open.png
 *
 * Run from the fabric-engine/ directory:
 *   node tools/build-manifest.mjs
 *
 * Output (per garment that has a master config):
 *   public/assets/<garment>/manifest.json
 *
 * For every layer, if a sibling `<stem>_zones.json` exists next to the PNG
 * (typically produced by tools/web_zone_picker.py), its zones array is
 * inlined into the manifest entry as `zones: [{polygon, rotation}, …]`.
 */

import { readdir, readFile, writeFile, access, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_ROOT = join(__dirname, '..', 'public', 'assets');


// ── Filename-token grammar ───────────────────────────────────────────────────
//
// Each filename stem is split on `+`.  Each token is then matched against the
// rules below to populate the layer's `options` and infer its `kind`.

const LAPEL_WIDTH = {
  lapel_narrow: 'slim',
  lapel_medium: 'standard',
  lapel_wide:   'wide',
};
const LAPEL_STYLE = {
  style_lapel_notch: 'notch',
  style_lapel_peak:  'peak',
  style_lapel_round: 'shawl',
};

// Hip-pocket prefixes — match longest first so `…with_flap` beats `…with`.
const POCKET_STYLES = [
  { prefix: 'hip_pockets_double_welt', value: 'double_welted' },
  { prefix: 'hip_pockets_with_flap',   value: 'with_flap' },
  { prefix: 'hip_pockets_patched',     value: 'patched' },
];

function parseTokens(stem) {
  const tokens = stem.split('+');
  const opts = {};
  const unknown = [];
  let kind = null;
  let hasBreastPocket = false;

  for (const raw of tokens) {
    const t = raw.trim();
    if (!t) continue;

    // — breast pocket (overlay prefix only, lapels-category)
    if (t === 'breast_pocket_classic') {
      hasBreastPocket = true;
      continue;
    }

    // — neck variants
    if (t === 'neck_single_breasted') { opts.breastStyle = 'single'; kind ||= 'neck'; continue; }
    if (t === 'neck_double_breasted') { opts.breastStyle = 'double'; kind ||= 'neck'; continue; }
    if (t === 'neck_mao')             { opts.breastStyle = 'mao';    kind ||= 'neck'; continue; }

    // — bottom variants (base-category, paired with a neck breastStyle)
    if (t === 'bottom_single_breasted') {
      opts.bodyPart = 'bottom';
      opts.breastStyle ||= 'single';
      kind ||= 'base';
      continue;
    }
    if (t === 'bottom_double_breasted') {
      opts.bodyPart = 'bottom';
      opts.breastStyle ||= 'double';
      kind ||= 'base';
      continue;
    }
    if (t === 'bottom_mao') {
      opts.bodyPart = 'bottom';
      opts.breastStyle ||= 'mao';
      kind ||= 'base';
      continue;
    }

    // — interior body parts (base-category)
    if (t === 'interior')                                            { kind ||= 'base'; continue; }
    if (t === 'espalda_abajo' || t === 'espalda_arriba'
        || t === 'espalda_arriba_mao')                               { opts.bodyPart = t;        kind ||= 'base'; continue; }
    if (t === 'sleeves')                                             { opts.bodyPart = 'sleeves'; kind ||= 'base'; continue; }
    if (t === 'negra' || t === 'negra_mao')                          { opts.bodyPart = t;         kind ||= 'base'; continue; }

    // — buttons
    if (t.startsWith('buttons_')) {
      const n = parseInt(t.slice('buttons_'.length), 10);
      if (!Number.isNaN(n)) opts.buttonCount = n;
      continue;
    }

    // — lapel width / style
    if (t in LAPEL_WIDTH) { opts.lapelWidth = LAPEL_WIDTH[t]; continue; }
    if (t in LAPEL_STYLE) { opts.lapelStyle = LAPEL_STYLE[t]; continue; }

    // — hip-pocket style (longest-prefix match)
    let pocketMatched = false;
    for (const ps of POCKET_STYLES) {
      if (t.startsWith(ps.prefix)) {
        opts.pocketStyle = ps.value;
        kind ||= 'hipPocket';
        pocketMatched = true;
        break;
      }
    }
    if (pocketMatched) continue;

    // — assorted modifiers
    if (t === 'fit_slim')      { opts.fit = 'slim';      continue; }
    if (t === 'third')         { opts.third = true;      continue; }
    if (t === 'length_long')   { opts.length = 'long';   continue; }
    if (t === 'hemline_open')  { opts.hemline = 'open';  continue; }

    unknown.push(t);
  }

  if (hasBreastPocket) {
    opts.hasBreastPocket = true;
    // A lapels-category file with a breast_pocket_classic prefix is a
    // *combined* neck + breast-pocket render; treat it as its own kind so
    // the consumer can swap it in when the user enables a breast pocket.
    kind = 'neckWithBreastPocket';
  }

  if (unknown.length) opts.unknownTokens = unknown;
  return { kind, options: opts };
}


// ── Kind classification fallback (when tokens don't decide) ──────────────────
//
// Some files contain only generic tokens like `breast_pocket_classic.png`
// (in hip-pocket/) or sit in `misc/`.  We use the *directory* the entry was
// declared under as a last resort.

function fallbackKind(categoryKey, stem) {
  if (stem === 'breast_pocket_classic') return 'breastPocket';
  switch (categoryKey) {
    case 'base':       return 'base';
    case 'lapels':     return 'neck';
    case 'hip-pocket': return 'hipPocket';
    case 'misc':       return 'misc';
    default:           return categoryKey;
  }
}


// ── Sibling zones loader (output of tools/web_zone_picker.py) ────────────────

async function loadZonesForLayer(garmentDir, relPngPath) {
  const stem = relPngPath.replace(/\.png$/i, '');
  const zonesPath = join(garmentDir, `${stem}_zones.json`);
  try {
    await access(zonesPath);
  } catch {
    return null;
  }
  try {
    const raw = JSON.parse(await readFile(zonesPath, 'utf8'));
    const zones = Array.isArray(raw) ? raw : raw.zones;
    if (!Array.isArray(zones)) return null;
    const clean = zones
      .filter(z => z && Array.isArray(z.polygon) && z.polygon.length >= 3)
      .map(z => ({
        polygon: z.polygon.map(p => [Number(p[0]), Number(p[1])]),
        rotation: Number(z.rotation ?? 0),
      }));
    return clean.length ? clean : null;
  } catch (err) {
    console.warn(`  [warn] failed to parse ${zonesPath}: ${err.message}`);
    return null;
  }
}


// ── Build manifest for ONE garment ───────────────────────────────────────────

async function buildGarment(garment, garmentDir, masterPath) {
  let master;
  try {
    master = JSON.parse(await readFile(masterPath, 'utf8'));
  } catch (err) {
    console.error(`  [error] cannot read ${basename(masterPath)}: ${err.message}`);
    return null;
  }
  const layersByCategory = master?.layers;
  if (!layersByCategory || typeof layersByCategory !== 'object') {
    console.error(`  [error] master config missing "layers" object`);
    return null;
  }

  const categories = {};
  const counters = { byCategory: {}, byKind: {}, total: 0, withZones: 0, missingFiles: 0 };

  for (const [catKey, entries] of Object.entries(layersByCategory)) {
    if (!Array.isArray(entries)) continue;
    const out = [];

    for (const entry of entries) {
      const file = entry?.file;
      if (typeof file !== 'string' || !file.endsWith('.png')) {
        console.warn(`  [warn] ${garment}/${catKey}: skipping entry with no file: ${JSON.stringify(entry)}`);
        continue;
      }

      // verify PNG exists on disk
      const fullPath = join(garmentDir, file);
      try {
        await access(fullPath);
      } catch {
        console.warn(`  [warn] ${garment}: missing PNG ${file}`);
        counters.missingFiles++;
        continue;
      }

      const stem = basename(file, '.png');
      const parsed = parseTokens(stem);
      const kind = parsed.kind || fallbackKind(catKey, stem);
      const zones = await loadZonesForLayer(garmentDir, file);

      const layer = {
        id: stem,
        category: catKey,
        file,
        src: `/assets/${garment}/${file}`,
        zIndex: typeof entry.zIndex === 'number' ? entry.zIndex : 100,
        kind,
        options: parsed.options,
        fabricDependent: entry.fabricDependent !== false,
      };
      if (zones) {
        layer.zones = zones;
        counters.withZones++;
      }
      out.push(layer);

      counters.total++;
      counters.byKind[kind] = (counters.byKind[kind] ?? 0) + 1;
    }

    // Sort within category by zIndex, then id (stable)
    out.sort((a, b) => a.zIndex - b.zIndex || a.id.localeCompare(b.id));
    categories[catKey] = out;
    counters.byCategory[catKey] = out.length;
  }

  return {
    manifest: {
      garment,
      assetRoot: `/assets/${garment}`,
      generatedFrom: basename(masterPath),
      categories,
      totals: counters,
    },
    counters,
  };
}


// ── Locate master configs and drive the build ────────────────────────────────

async function listGarmentDirs() {
  let entries;
  try {
    entries = await readdir(ASSETS_ROOT, { withFileTypes: true });
  } catch (err) {
    console.error(`[fatal] cannot read ${ASSETS_ROOT}: ${err.message}`);
    process.exit(2);
  }
  const dirs = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const garmentDir = join(ASSETS_ROOT, e.name);
    const masterName = `${e.name}_master_assets_config.json`;
    const masterPath = join(garmentDir, masterName);
    try {
      await access(masterPath);
      dirs.push({ garment: e.name, garmentDir, masterPath });
    } catch {
      // no master config — skip this garment silently
    }
  }
  return dirs;
}


async function main() {
  const garments = await listGarmentDirs();
  if (!garments.length) {
    console.error(`[fatal] no *_master_assets_config.json found under ${ASSETS_ROOT}`);
    process.exit(2);
  }

  console.log(`Building manifests under ${ASSETS_ROOT}\n`);

  let grandTotal = 0;
  for (const { garment, garmentDir, masterPath } of garments) {
    console.log(`▸ ${garment}  (${basename(masterPath)})`);
    const result = await buildGarment(garment, garmentDir, masterPath);
    if (!result) continue;
    const { manifest, counters } = result;

    const outPath = join(garmentDir, 'manifest.json');
    await writeFile(outPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

    const catStr = Object.entries(counters.byCategory)
      .map(([k, n]) => `${k}×${n}`).join('  ');
    const kindStr = Object.entries(counters.byKind)
      .map(([k, n]) => `${k}×${n}`).join('  ');
    console.log(`    layers: ${counters.total}   [${catStr}]`);
    console.log(`    kinds:  [${kindStr}]`);
    if (counters.withZones) {
      console.log(`    zones:  ${counters.withZones} layer(s) have polygon zones`);
    }
    if (counters.missingFiles) {
      console.log(`    [warn] ${counters.missingFiles} missing PNG(s) on disk`);
    }
    console.log(`    wrote: ${outPath}`);
    console.log();
    grandTotal += counters.total;
  }

  console.log(`Done.  ${garments.length} garment(s), ${grandTotal} total layers.`);
}

main().catch(err => { console.error(err); process.exit(1); });
