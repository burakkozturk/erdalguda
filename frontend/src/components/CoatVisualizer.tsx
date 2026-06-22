import { useMemo, type ReactElement } from 'react';
import type { CoatConfig } from '../types/coat';
import { COAT_STYLE_PARAMS } from '../types/coat';
import { generatedLayerUrl } from '../data/assetUrls';
import { useViewerImageLoading } from '../hooks/useConfiguratorImageLoading';
import PremiumViewerLoader from './PremiumViewerLoader';
import './JacketConfigurator.css';

// ---------------------------------------------------------------------------
// coat_config.json schema (exported so CoatConfigurator can type the fetch)
// ---------------------------------------------------------------------------

export interface CoatConfigLayerJSON {
  path: string;
  z: number;
  fabric: boolean;
}

export interface CoatConfigEntryJSON {
  label: string;
  layers: CoatConfigLayerJSON[];
}

export interface CoatConfigJSON {
  base: CoatConfigLayerJSON[];
  style:            Record<string, CoatConfigEntryJSON>;
  bottoms:          Record<string, CoatConfigEntryJSON>;
  pockets:          Record<string, CoatConfigEntryJSON>;
  'shoulder-accents'?: Record<string, CoatConfigEntryJSON>;
  'sleeve-accents'?:   Record<string, CoatConfigEntryJSON>;
}

// ---------------------------------------------------------------------------
// Resolved layer — one entry per PNG that will be rendered
// ---------------------------------------------------------------------------

export interface ResolvedCoatLayer {
  id:              string;
  src:             string;
  file:            string;
  /** Basename only — matches the flat layout fabric_generator.py writes:
   *  out_dir / template_path.name  (no subdirectories) */
  generatedFile:   string;
  zIndex:          number;
  fabricDependent: boolean;
}

// ---------------------------------------------------------------------------
// Layer resolution engine
//
// Z-index layer order (bottom → top):
//   z91  interior back
//   z95  interior arriba (collar-dependent)
//   z100 style top body
//   z105 interior sleeves (fabric)
//   z120 chest piece
//   z125 interior sleeves overlay
//   z140 bottom / skirt
//   z150 pockets
//   z175 button overlay (fabric)
//   z180 button overlay (non-fabric)
//   z500 hanger
// ---------------------------------------------------------------------------

const COAT_ASSET_ROOT    = '/assets/coat';
const COAT_FABRIC_VERSION = 1;

export function resolveCoatLayers(cfg: CoatConfig, json: CoatConfigJSON): ResolvedCoatLayer[] {
  const params         = COAT_STYLE_PARAMS[cfg.style];
  const internalStyle  = params.internalStyle;
  const baseCollar     = params.collarStyle;

  const { lapelStyle, lapelLength, lapelWidth, fastening, pocketStyle } = cfg;

  // "trench" fastening overrides the collar to the classic-trench collar variant.
  // This activates the 'simple-classic-trench' top piece and matching bottom.
  const effectiveCollar = (fastening === 'trench' && internalStyle === 'simple')
    ? 'classic'
    : baseCollar;

  const layers: ResolvedCoatLayer[] = [];

  function addLayer(l: CoatConfigLayerJSON) {
    // fabric_generator.py writes: out_dir / template_path.name  (flat, no subdirs)
    // so the S3 key is coat/generated/{fabricId}/{basename}, not the full path.
    const basename = l.path.split('/').pop() ?? l.path;
    layers.push({
      id:              l.path,
      src:             `${COAT_ASSET_ROOT}/${l.path}`,
      file:            l.path,
      generatedFile:   basename,
      zIndex:          l.z,
      fabricDependent: l.fabric,
    });
  }

  function addEntry(entry: CoatConfigEntryJSON | undefined) {
    entry?.layers.forEach(addLayer);
  }

  // ── 1. Structural base layers (always rendered) ──────────────────────────
  const STRUCTURAL = new Set([
    'coat__z91__interior+espalda.png',
    'coat__z105__interior+sleeves.png',
    'coat__z125__interior+sleeves.png',
  ]);
  json.base
    .filter((l) => STRUCTURAL.has(l.path.split('/').pop() ?? ''))
    .forEach(addLayer);

  // ── 2. Hanger (standup collar has a taller variant) ──────────────────────
  const hangerFile = effectiveCollar === 'standup'
    ? 'coat__z500__hanger_standup.png'
    : 'coat__z500__hanger.png';
  const hangerLayer = json.base.find((l) => l.path.endsWith(hangerFile));
  if (hangerLayer) addLayer(hangerLayer);

  // ── 3. z95 arriba — inner collar-dependent upper facing ──────────────────
  if (internalStyle === 'simple') {
    let arribaFile: string | null = null;
    if (effectiveCollar === 'classic') {
      arribaFile = 'coat__z95__interior+arriba+style_simple+collar_classic+fastening_trench.png';
    } else if (effectiveCollar === 'standup') {
      arribaFile = 'coat__z95__interior+arriba+style_simple+collar_standup.png';
    }
    if (arribaFile) {
      const a = json.base.find((l) => l.path.endsWith(arribaFile!));
      if (a) addLayer(a);
    }
  }

  // ── 4. Style key → top body piece ────────────────────────────────────────
  let styleKey: string;
  if (effectiveCollar === 'standup') {
    const len = lapelLength === 'long' ? 'long' : 'short';
    styleKey = `simple-standup-${len}-boton_standard`;
  } else if (effectiveCollar === 'classic') {
    styleKey = 'simple-classic-trench';
  } else if (internalStyle === 'crossed') {
    const ls = lapelStyle === 'ulster' ? 'ulster' : 'notched';
    styleKey = `crossed-flap-${ls}`;
  } else {
    // simple + flap: full matrix of lapel style / width / fastening / length
    const ls = lapelStyle === 'notch'   ? 'notched'
             : lapelStyle === 'ulster'  ? 'notched'   // ulster not authored for simple-flap
             : lapelStyle;
    styleKey = `simple-flap-${lapelLength}-${lapelWidth}-${ls}-${fastening}`;
  }
  addEntry(json.style[styleKey]);

  // ── 5. Bottom piece ───────────────────────────────────────────────────────
  if (effectiveCollar !== 'standup') {
    let bottomKey: string;
    if (effectiveCollar === 'classic') {
      const lenNorm = lapelLength === 'long' ? 'long' : 'short';
      bottomKey = `simple-classic-bottom-${lenNorm}-trench`;
    } else if (internalStyle === 'crossed') {
      bottomKey = 'crossed-flap-bottom-short';
    } else {
      const lenNorm = lapelLength === 'long' ? 'long' : 'short';
      bottomKey = `simple-flap-bottom-${lenNorm}-${fastening}`;
    }
    addEntry(json.bottoms[bottomKey]);
  }

  // ── 6. Button overlays — only for simple-flap (standard/hidden fastening) ─
  if (internalStyle === 'simple' && effectiveCollar === 'flap') {
    const btnSuffix = lapelLength === 'long' ? 'long' : 'classic';
    for (const btnFile of [
      `coat__z175__buttons+lapel_lenght_${btnSuffix}.png`,
      `coat__z180__buttons+lapel_lenght_${btnSuffix}.png`,
    ]) {
      const btn = json.base.find((l) => l.path.endsWith(btnFile));
      if (btn) addLayer(btn);
    }
  }

  // ── 7. Pockets ────────────────────────────────────────────────────────────
  addEntry(json.pockets[`pockets_type_${pocketStyle}-fit_waisted`]);

  return layers.sort((a, b) => a.zIndex - b.zIndex);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoatVisualizerProps {
  value:         CoatConfig;
  coatJson:      CoatConfigJSON | null;
  activeFabricId: string | null;
  mode?:         'standalone' | 'embedded';
  background?:   string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CoatVisualizer({
  value,
  coatJson,
  activeFabricId,
  mode = 'embedded',
  background,
}: CoatVisualizerProps) {
  const resolvedLayers = useMemo<ResolvedCoatLayer[]>(() => {
    if (!coatJson) return [];
    return resolveCoatLayers(value, coatJson);
  }, [coatJson, value]);

  const viewerImageUrls = useMemo(
    () =>
      resolvedLayers.flatMap((layer) => {
        if (activeFabricId && layer.fabricDependent) {
          return [
            layer.src,
            // generatedFile = basename only, matching fabric_generator.py flat output
            generatedLayerUrl('coat', activeFabricId, layer.generatedFile, COAT_FABRIC_VERSION),
          ];
        }
        return [layer.src];
      }),
    [activeFabricId, resolvedLayers],
  );

  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const layerStack = resolvedLayers.flatMap((layer): ReactElement[] => {
    const isFabric  = !!activeFabricId && layer.fabricDependent;
    const fabricUrl = isFabric
      ? generatedLayerUrl('coat', activeFabricId, layer.generatedFile, COAT_FABRIC_VERSION)
      : null;

    if (fabricUrl) {
      return [
        <img
          key={`coat::${layer.id}::${activeFabricId}`}
          src={fabricUrl}
          alt=""
          className="jc-layer"
          style={{ zIndex: layer.zIndex }}
          draggable={false}
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (img.dataset.fellBack) return;
            img.dataset.fellBack = '1';
            img.src = layer.src;
          }}
        />,
      ];
    }
    return [
      <img
        key={`coat::${layer.id}::template`}
        src={layer.src}
        alt=""
        className="jc-layer"
        style={{ zIndex: layer.zIndex }}
        draggable={false}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />,
    ];
  });

  const viewer = (
    <div className="jc-viewer">
      {!coatJson && <div className="jc-viewerEmpty">katmanlar yükleniyor…</div>}
      {layerStack}
      <PremiumViewerLoader active={viewerLoading} />
    </div>
  );

  if (mode === 'standalone') {
    return (
      <div
        className="jc-viewer-standalone"
        style={background ? { background } : undefined}
      >
        {viewer}
      </div>
    );
  }

  return <div className="jc-viewerCard">{viewer}</div>;
}
