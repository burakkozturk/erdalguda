import { useEffect, useMemo, useRef, useState } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type { TuxedoConfig, TuxedoStyle, LapelStyle, LapelWidth, PocketStyle } from '../types/tuxedo';
import { ConfiguratorAccordion } from './ConfiguratorAccordion';
import { IconChoiceGroup, type IconChoiceOption } from './IconChoiceCard';
import {
  JACKET_BUTTON_ICONS,
  JACKET_LAPEL_STYLE_ICONS,
  JACKET_LAPEL_WIDTH_ICONS,
  JACKET_POCKET_ICONS,
} from '../data/configuratorIcons';
import {
  JACKET_LAPEL_WIDTH_LABELS,
  LAPEL_STYLE_LABELS as SHARED_LAPEL_STYLE_LABELS,
  POCKET_STYLE_LABELS as SHARED_POCKET_STYLE_LABELS,
  TUXEDO_STYLE_LABELS,
} from '../data/configuratorLabels';
import { generatedLayerUrl } from '../data/assetUrls';
import {
  useBackgroundImagePreload,
  useViewerImageLoading,
} from '../hooks/useConfiguratorImageLoading';
import './TuxedoConfigurator.css';
import PremiumViewerLoader from './PremiumViewerLoader';

// ---------------------------------------------------------------------------
// Manifest types — match the shape produced by tools/build-manifest.mjs.
// ---------------------------------------------------------------------------

interface ManifestLayerOptions {
  breastStyle?: 'single' | 'double' | 'mao';
  buttonCount?: number;
  lapelWidth?: 'slim' | 'standard' | 'wide';
  lapelStyle?: 'notch' | 'peak' | 'shawl' | 'mao';
  pocketStyle?: 'with_flap' | 'double_welted' | 'patched';
  third?: boolean;
  bodyPart?: string;
  length?: 'long';
  hemline?: 'open';
}

interface ManifestLayer {
  id: string;
  category: string;
  file: string;
  src: string;
  zIndex: number;
  kind: string;
  options: ManifestLayerOptions;
  fabricDependent?: boolean;
}

// Bump this whenever fabric_generator.py regenerates the per-fabric variants.
// Cache-buster query string forces the browser to refetch generated PNGs
// instead of serving a stale cached copy.
const FABRIC_ASSET_VERSION = 4;

interface TuxedoManifest {
  garment: string;
  assetRoot?: string;
  categories?: {
    base?: ManifestLayer[];
    lapels?: ManifestLayer[];
    'hip-pocket'?: ManifestLayer[];
    misc?: ManifestLayer[];
  };
}

interface ViewerLayer {
  key: string;
  src: string;
  file: string;
  zIndex: number;
  isPants: boolean;
  fabricDependent: boolean;
}

// ---------------------------------------------------------------------------
// Option labels (Turkish)
// ---------------------------------------------------------------------------

const STYLE_LABELS: Record<TuxedoStyle, string> = {
  single_breasted_1: TUXEDO_STYLE_LABELS.single_breasted_1,
  single_breasted_2: TUXEDO_STYLE_LABELS.single_breasted_2,
  double_breasted_2: TUXEDO_STYLE_LABELS.double_breasted_2,
  double_breasted_4: TUXEDO_STYLE_LABELS.double_breasted_4,
  double_breasted_6: TUXEDO_STYLE_LABELS.double_breasted_6,
};

const LAPEL_STYLE_LABELS: Record<LapelStyle, string> = {
  notch: SHARED_LAPEL_STYLE_LABELS.notch,
  peak:  SHARED_LAPEL_STYLE_LABELS.peak,
  shawl: SHARED_LAPEL_STYLE_LABELS.shawl,
};

const LAPEL_WIDTH_LABELS: Record<LapelWidth, string> = {
  narrow: JACKET_LAPEL_WIDTH_LABELS.narrow,
  medium: JACKET_LAPEL_WIDTH_LABELS.medium,
  wide:   JACKET_LAPEL_WIDTH_LABELS.wide,
};

const POCKET_STYLE_LABELS: Record<PocketStyle, string> = {
  no_pocket:         SHARED_POCKET_STYLE_LABELS.no_pocket,
  double_welt:       SHARED_POCKET_STYLE_LABELS.double_welt,
  double_welt_third: SHARED_POCKET_STYLE_LABELS.double_welt_third,
  with_flap:         SHARED_POCKET_STYLE_LABELS.with_flap,
  with_flap_third:   SHARED_POCKET_STYLE_LABELS.with_flap_third,
};

const ALL_STYLES: TuxedoStyle[] = [
  'single_breasted_1',
  'single_breasted_2',
  'double_breasted_2',
  'double_breasted_4',
  'double_breasted_6',
];
const ALL_LAPEL_STYLES: LapelStyle[]  = ['notch', 'peak', 'shawl'];
const ALL_LAPEL_WIDTHS: LapelWidth[]  = ['narrow', 'medium', 'wide'];
const ALL_POCKET_STYLES: PocketStyle[] = [
  'no_pocket', 'double_welt', 'double_welt_third', 'with_flap', 'with_flap_third',
];

// ---------------------------------------------------------------------------
// Layer resolution
// ---------------------------------------------------------------------------

function parseStyle(style: TuxedoStyle): { breasted: string; buttons: number } {
  const parts = style.split('_');
  const buttons = parseInt(parts[parts.length - 1], 10);
  const breasted = parts.slice(0, -1).join('_'); // 'single_breasted' | 'double_breasted'
  return { breasted, buttons };
}

// ---------------------------------------------------------------------------
// Pant classification — the build-manifest output does NOT separate jacket
// from pant layers, so we detect pants by filename token (same strategy as
// SuitConfigurator.classifySuitLayer).
// ---------------------------------------------------------------------------

const PANT_TOKENS = ['pant', 'pantalon', 'pleats_', 'front_pocket', 'back_pocket', '+cut_'];

function isPantLayer(file: string): boolean {
  const s = file.toLowerCase();
  return PANT_TOKENS.some((t) => s.includes(t));
}

// Map TuxedoConfig's LapelWidth ('narrow' | 'medium' | 'wide') to the
// manifest's lapelWidth ('slim' | 'standard' | 'wide') produced by the
// build-manifest token parser.
const LAPEL_WIDTH_TO_MANIFEST: Record<LapelWidth, 'slim' | 'standard' | 'wide'> = {
  narrow: 'slim',
  medium: 'standard',
  wide:   'wide',
};

// Map TuxedoConfig's PocketStyle to the manifest's pocketStyle + third flag.
function tuxedoPocketToManifest(p: PocketStyle): {
  pocketStyle: 'with_flap' | 'double_welted' | null;
  third: boolean;
} {
  switch (p) {
    case 'no_pocket':         return { pocketStyle: null,           third: false };
    case 'with_flap':         return { pocketStyle: 'with_flap',    third: false };
    case 'with_flap_third':   return { pocketStyle: 'with_flap',    third: true  };
    case 'double_welt':       return { pocketStyle: 'double_welted', third: false };
    case 'double_welt_third': return { pocketStyle: 'double_welted', third: true  };
  }
}

function buildLayers(config: TuxedoConfig, manifest: TuxedoManifest): ViewerLayer[] {
  // Guard: optional chaining + fallback empty arrays so a partially-loaded
  // or unexpected-shape manifest can never trip an "undefined is not iterable"
  // / "Cannot read .map of undefined" exception during render.
  const baseLayers  = manifest.categories?.base          ?? [];
  const lapelLayers = manifest.categories?.lapels        ?? [];
  const pocketLayers = manifest.categories?.['hip-pocket'] ?? [];

  const { breasted, buttons } = parseStyle(config.style);
  const wantBreastStyle: 'single' | 'double' =
    breasted === 'double_breasted' ? 'double' : 'single';
  const wantLapelWidth = LAPEL_WIDTH_TO_MANIFEST[config.lapelWidth];
  const wantLapelStyle = config.lapelStyle; // notch | peak | shawl — same names in manifest
  const { pocketStyle: wantPocketStyle, third: wantThird } =
    tuxedoPocketToManifest(config.pocketStyle);

  function srcFor(layer: ManifestLayer): string {
    // Bare template path. The per-fabric overlay is rendered separately
    // on top of this in the viewer (see render block below), so a missing
    // per-fabric PNG leaves the template visible as a defensive fallback.
    return layer.src || `/assets/tuxedo/${layer.file}`;
  }

  function make(layer: ManifestLayer, isPants: boolean): ViewerLayer {
    return {
      key: `${layer.zIndex}_${layer.file}`,
      src: srcFor(layer),
      file: layer.file,
      zIndex: layer.zIndex,
      isPants,
      fabricDependent: layer.fabricDependent ?? false,
    };
  }

  // A. BASE — all base layers; pants vs jacket determined by filename.
  const pickedBase: ViewerLayer[] = (baseLayers ?? []).map((l) =>
    make(l, isPantLayer(l.file)),
  );

  // B. LAPEL / NECK — match by options against the user's selection.
  //    The lapels category contains both kind='neck' and 'neckWithBreastPocket';
  //    we pick a single matching neck, plus the wide-lapel integrated breast-
  //    pocket variant when applicable.
  const pickedLapel: ViewerLayer[] = [];
  let suppressedBreastPocket = false;

  const wideEligible =
    wantLapelWidth === 'wide' &&
    ((wantBreastStyle === 'single' && (buttons === 1 || buttons === 2)) ||
     (wantBreastStyle === 'double' && buttons === 2));

  if (wideEligible) {
    const combined = (lapelLayers ?? []).find(
      (l) =>
        l.kind === 'neckWithBreastPocket' &&
        l.options?.breastStyle === wantBreastStyle &&
        l.options?.buttonCount === buttons &&
        l.options?.lapelWidth === wantLapelWidth &&
        l.options?.lapelStyle === wantLapelStyle,
    );
    if (combined) {
      pickedLapel.push(make(combined, false));
      suppressedBreastPocket = true;
    }
  }

  if (!suppressedBreastPocket) {
    const plainNeck = (lapelLayers ?? []).find(
      (l) =>
        l.kind === 'neck' &&
        l.options?.breastStyle === wantBreastStyle &&
        l.options?.buttonCount === buttons &&
        l.options?.lapelWidth === wantLapelWidth &&
        l.options?.lapelStyle === wantLapelStyle,
    );
    if (plainNeck) pickedLapel.push(make(plainNeck, false));
  }

  // C. HIP-POCKET / BREAST-POCKET — match by options. Standalone breast
  //    pocket is suppressed when a neckWithBreastPocket variant was chosen.
  const pickedPocket: ViewerLayer[] = [];
  for (const layer of pocketLayers ?? []) {
    // The manifest stores the standalone breast pocket under kind='neckWithBreastPocket'
    // inside the hip-pocket category (file: breast_pocket_classic.png).
    if (layer.kind === 'breastPocket' || layer.kind === 'neckWithBreastPocket') {
      if (suppressedBreastPocket) continue;
      if (config.lapelStyle === 'shawl') continue; // shawl lapels: no breast pocket
      pickedPocket.push(make(layer, false));
      continue;
    }
    if (layer.kind === 'hipPocket') {
      if (wantPocketStyle === null) continue; // no_pocket
      if (
        layer.options?.pocketStyle === wantPocketStyle &&
        !!layer.options?.third === wantThird
      ) {
        pickedPocket.push(make(layer, false));
      }
    }
  }

  const result = [...pickedBase, ...pickedLapel, ...pickedPocket].sort(
    (a, b) => a.zIndex - b.zIndex || a.key.localeCompare(b.key),
  );

  console.log(
    '[Tuxedo] base:', pickedBase.length,
    'lapel:', pickedLapel.length,
    'pocket:', pickedPocket.length,
    'total:', result.length,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TuxedoConfiguratorProps {
  value: TuxedoConfig;
  onChange: (config: TuxedoConfig) => void;
  readOnly?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only' | 'controls-all';
  activeTab?: 'fabric' | 'style';
  showUpload?: boolean;
  viewerBackground?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TuxedoConfigurator({
  value,
  onChange,
  readOnly = false,
  mode = 'full',
  activeTab = 'fabric',
  viewerBackground,
}: TuxedoConfiguratorProps) {
  const [manifest, setManifest] = useState<TuxedoManifest | null>(null);
  const [fabrics, setFabrics] = useState<FabricResponse[]>([]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    fetch('/assets/tuxedo/manifest.json')
      .then((r) => {
        if (!r.ok) throw new Error('tuxedo/manifest.json yüklenemedi');
        return r.json() as Promise<TuxedoManifest>;
      })
      .then(setManifest)
      .catch(console.error);
  }, []);

  useEffect(() => {
    getFabrics('JACKET')
      .then(setFabrics)
      .catch(console.error);
  }, []);

  const layers = useMemo<ViewerLayer[]>(() => {
    if (!manifest) return [];
    return buildLayers(value, manifest);
  }, [manifest, value]);

  // Map selected fabricKey → fabricId for per-fabric PNG routing. The
  // TuxedoConfigurator stores the fabricId directly in value.fabricKey on
  // click, but we still validate it against the loaded fabric list so a
  // stale persisted value doesn't generate broken URLs.
  const activeFabricId = useMemo(
    () => fabrics.find((f) => f.fabricId === value.fabricKey)?.fabricId ?? null,
    [fabrics, value.fabricKey],
  );

  const viewerImageUrls = useMemo(() => (
    layers.flatMap((layer) => {
      if (activeFabricId && layer.fabricDependent) {
        return [
          layer.src,
          generatedLayerUrl('tuxedo', activeFabricId, layer.file, FABRIC_ASSET_VERSION),
        ];
      }
      return [layer.src];
    })
  ), [activeFabricId, layers]);
  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const backgroundPreloadUrls = useMemo(() => {
    const fabricIds = fabrics
      .map((fabric) => fabric.fabricId)
      .filter((fabricId): fabricId is string => Boolean(fabricId && fabricId !== activeFabricId))
      .slice(0, 6);
    const layerFiles = layers
      .filter((layer) => layer.fabricDependent)
      .sort((a, b) => {
        const aBase = a.file.toLowerCase().includes('base') ? 0 : 1;
        const bBase = b.file.toLowerCase().includes('base') ? 0 : 1;
        return aBase - bBase || a.zIndex - b.zIndex;
      })
      .map((layer) => layer.file);

    return fabricIds.flatMap((fabricId) => (
      layerFiles.map((file) => generatedLayerUrl('tuxedo', fabricId, file, FABRIC_ASSET_VERSION))
    ));
  }, [activeFabricId, fabrics, layers]);
  useBackgroundImagePreload(backgroundPreloadUrls);

  // ---------------------------------------------------------------------------
  // Reusable JSX blocks
  // ---------------------------------------------------------------------------

  const fabricBar = fabrics.length > 0 ? (
    <div className="tc-fabricBar">
      <span className="tc-fabricBarLabel">Kumaş</span>
      <div className="tc-fabricCards">
        {fabrics.map((fabric) => (
          <button
            key={fabric.key}
            type="button"
            className={fabric.fabricId === value.fabricKey ? 'tc-fabricCard active' : 'tc-fabricCard'}
            onClick={() => onChange({ ...value, fabricKey: fabric.fabricId, fabricLabel: fabric.name })}
            disabled={readOnly}
          >
            <div className="tc-fabricSwatch">
              {fabric.swatchUrl ? (
                <img
                  src={fabric.swatchUrl}
                  alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="tc-fabricSwatchFallback" />
              )}
            </div>
            <div className="tc-fabricInfo">
              <span className="tc-fabricLabel">{fabric.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Icon-card options. TuxedoStyle encodes both breast-style and button-count
  // ('single_breasted_1' → single+1) — we map to the shared jacket button
  // icons so the look matches Suit/Jacket. The layer composition function
  // `buildLayers` still consumes these state values as-is.
  function tuxedoStyleIcon(style: TuxedoStyle): string | undefined {
    const m = style.match(/^(single|double)_breasted_(\d)$/);
    if (!m) return undefined;
    const key = `${m[1]}-${m[2]}` as keyof typeof JACKET_BUTTON_ICONS;
    return JACKET_BUTTON_ICONS[key];
  }

  const tuxedoStyleOptions: IconChoiceOption<TuxedoStyle>[] = ALL_STYLES.map((s) => ({
    value: s,
    label: STYLE_LABELS[s],
    iconSrc: tuxedoStyleIcon(s),
  }));

  // Width mapping: narrow/medium/wide → slim/standard/wide on jacket icons.
  const widthIconMap: Record<LapelWidth, string | undefined> = {
    narrow: JACKET_LAPEL_WIDTH_ICONS.slim,
    medium: JACKET_LAPEL_WIDTH_ICONS.standard,
    wide:   JACKET_LAPEL_WIDTH_ICONS.wide,
  };

  const lapelStyleOptions: IconChoiceOption<LapelStyle>[] = ALL_LAPEL_STYLES.map((ls) => ({
    value: ls,
    label: LAPEL_STYLE_LABELS[ls],
    iconSrc: JACKET_LAPEL_STYLE_ICONS[ls],
  }));
  const lapelWidthOptions: IconChoiceOption<LapelWidth>[] = ALL_LAPEL_WIDTHS.map((lw) => ({
    value: lw,
    label: LAPEL_WIDTH_LABELS[lw],
    iconSrc: widthIconMap[lw],
  }));
  const pocketOptions: IconChoiceOption<PocketStyle>[] = ALL_POCKET_STYLES.map((ps) => ({
    value: ps,
    label: POCKET_STYLE_LABELS[ps],
    iconSrc: JACKET_POCKET_ICONS[ps as keyof typeof JACKET_POCKET_ICONS],
  }));

  const styleBar = (
    <IconChoiceGroup<TuxedoStyle>
      label="Smokin Stili"
      value={value.style}
      options={tuxedoStyleOptions}
      onChange={(next) => onChange({ ...value, style: next })}
      disabled={readOnly}
    />
  );

  const optionBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<LapelStyle>
        label="Yaka Stili"
        value={value.lapelStyle}
        options={lapelStyleOptions}
        onChange={(next) => onChange({ ...value, lapelStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<LapelWidth>
        label="Yaka Genişliği"
        value={value.lapelWidth}
        options={lapelWidthOptions}
        onChange={(next) => onChange({ ...value, lapelWidth: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PocketStyle>
        label="Cep Stili"
        value={value.pocketStyle}
        options={pocketOptions}
        onChange={(next) => onChange({ ...value, pocketStyle: next })}
        disabled={readOnly}
      />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Mode-specific renders
  // ---------------------------------------------------------------------------

  // Per-layer transforms — matches the SuitConfigurator pattern. Jacket
  // halves shift up, pant halves shift down. Applied per-image so each
  // layer keeps its own zIndex within the shared viewer stacking context.
  const TUXEDO_LAYER_TRANSFORM = {
    jacket: 'scale(0.78) translateY(-22%)',
    pant:   'scale(0.78) translateY(30%)',
  } as const;

  const viewerStack = (
    <div className="tc-viewer">
      {layers.flatMap((layer) => {
        const baseStyle: React.CSSProperties = {
          zIndex: layer.zIndex,
          transform: layer.isPants
            ? TUXEDO_LAYER_TRANSFORM.pant
            : TUXEDO_LAYER_TRANSFORM.jacket,
          transformOrigin: '50% 50%',
        };
        const elements = [
          <img
            key={`${layer.key}::template`}
            src={layer.src}
            alt=""
            className="tc-layer"
            style={baseStyle}
            draggable={false}
            onError={() => console.error('Tuxedo katmanı yüklenemedi:', layer.src)}
          />,
        ];
        if (activeFabricId && layer.fabricDependent) {
          // Per-fabric overlay produced by fabric_generator.py against the
          // tuxedo manifest. Renders on top of the bare template at the
          // same zIndex; onError hides it so a missing variant falls back
          // to the template silently.
          const fabricUrl = generatedLayerUrl(
            'tuxedo',
            activeFabricId,
            layer.file,
            FABRIC_ASSET_VERSION,
          );
          elements.push(
            <img
              key={`${layer.key}::${activeFabricId}`}
              src={fabricUrl}
              alt=""
              className="tc-layer"
              style={baseStyle}
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />,
          );
        }
        return elements;
      })}
      <PremiumViewerLoader active={viewerLoading} />
    </div>
  );

  if (mode === 'viewer-only') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: viewerBackground || 'transparent',
        }}
      >
        {viewerStack}
      </div>
    );
  }

  if (mode === 'controls-only') {
    if (activeTab === 'fabric') return <div className="tc-root">{fabricBar}</div>;
    return (
      <div className="tc-root">
        {styleBar}
        {optionBar}
      </div>
    );
  }

  if (mode === 'controls-all') {
    return (
      <ConfiguratorAccordion
        sections={[
          { key: 'fabric', title: 'Kumaş', content: fabricBar },
          {
            key: 'style',
            title: 'Stil',
            content: (
              <>
                {styleBar}
                {optionBar}
              </>
            ),
          },
        ]}
      />
    );
  }

  // mode === 'full'
  return (
    <div className="tc-root">
      {fabricBar}
      {styleBar}
      {optionBar}
      <div className="tc-viewerCard">{viewerStack}</div>
    </div>
  );
}
