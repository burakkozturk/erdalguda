import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type { JacketConfig, JacketFit, JacketVent } from '../types/jacket';
import { ConfiguratorAccordion } from './ConfiguratorAccordion';
import { IconChoiceGroup, type IconChoiceOption } from './IconChoiceCard';
import {
  JACKET_BREAST_ICONS,
  JACKET_BUTTON_ICONS,
  JACKET_FIT_ICONS,
  JACKET_LAPEL_STYLE_ICONS,
  JACKET_LAPEL_WIDTH_ICONS,
  JACKET_POCKET_ICONS,
  JACKET_VENT_ICONS,
} from '../data/configuratorIcons';
import {
  BREAST_STYLE_LABELS,
  JACKET_FIT_LABELS,
  JACKET_LAPEL_WIDTH_LABELS,
  JACKET_VENT_LABELS,
  LAPEL_STYLE_LABELS,
  POCKET_STYLE_LABELS,
} from '../data/configuratorLabels';
import { generatedLayerUrl } from '../data/assetUrls';
import {
  useBackgroundImagePreload,
  useViewerImageLoading,
} from '../hooks/useConfiguratorImageLoading';
import './JacketConfigurator.css';
import PremiumViewerLoader from './PremiumViewerLoader';

// ---------------------------------------------------------------------------
// Manifest schema  (new flat-directory + master-JSON architecture)
//
// Served at /assets/blazer/manifest.json (symlink → fabric-engine/.../blazer)
// Produced by tools/build-manifest.mjs.
// ---------------------------------------------------------------------------

type BreastStyle = 'single' | 'double' | 'mao';
type LapelWidth  = 'slim' | 'standard' | 'wide';
type LapelStyle  = 'notch' | 'peak' | 'shawl' | 'mao';
type PocketStyle = 'with_flap' | 'double_welted' | 'patched';

interface ManifestLayerOptions {
  breastStyle?: BreastStyle;
  buttonCount?: number;
  lapelWidth?: LapelWidth;
  lapelStyle?: LapelStyle;
  pocketStyle?: PocketStyle;
  fit?: 'slim';
  third?: boolean;
  length?: 'long';
  hemline?: 'open';
  bodyPart?: string;
  hasBreastPocket?: boolean;
}

interface ManifestLayer {
  id: string;
  category: 'base' | 'lapels' | 'hip-pocket' | 'misc' | string;
  file: string;
  src: string;
  zIndex: number;
  kind: 'base' | 'neck' | 'neckWithBreastPocket' | 'hipPocket' | 'breastPocket' | 'misc' | string;
  options: ManifestLayerOptions;
  fabricDependent: boolean;
}

interface BlazerManifest {
  garment: string;
  assetRoot: string;
  categories: Record<string, ManifestLayer[]>;
}

type Fabric = FabricResponse;

interface GenerateResponse {
  ok: boolean;
  fabric?: { key: string };
  detail?: string;
}

// ---------------------------------------------------------------------------
// Selection state — what the user is configuring.
// Derived from / projected back into the persisted JacketConfig.
// ---------------------------------------------------------------------------

interface Selection {
  breastStyle: BreastStyle;
  buttonCount: number;              // 0 for mao
  lapelWidth: LapelWidth;
  lapelStyle: LapelStyle;
  pocketStyle: PocketStyle;
  pocketThird: boolean;
}

const DEFAULT_SELECTION: Selection = {
  breastStyle: 'single',
  buttonCount: 2,
  lapelWidth: 'standard',
  lapelStyle: 'notch',
  pocketStyle: 'with_flap',
  pocketThird: false,
};

// Bump this whenever fabric_generator.py / bulk_regen.py regenerates the
// per-fabric variants. The query string appears on every generated/* URL,
// so the browser refetches PNGs instead of serving the stale cached copies.
const FABRIC_ASSET_VERSION = 4;

// ---------------------------------------------------------------------------
// Option presentation tables
// ---------------------------------------------------------------------------

const BREAST_STYLES: Array<{ value: BreastStyle; label: string }> = [
  { value: 'single', label: BREAST_STYLE_LABELS.single },
  { value: 'double', label: BREAST_STYLE_LABELS.double },
  { value: 'mao',    label: BREAST_STYLE_LABELS.mao },
];

const BUTTON_COUNTS_BY_BREAST: Record<BreastStyle, number[]> = {
  single: [1, 2, 3],
  double: [2, 4, 6],
  mao:    [],
};

const LAPEL_WIDTHS: Array<{ value: LapelWidth; label: string }> = [
  { value: 'slim',     label: JACKET_LAPEL_WIDTH_LABELS.slim },
  { value: 'standard', label: JACKET_LAPEL_WIDTH_LABELS.standard },
  { value: 'wide',     label: JACKET_LAPEL_WIDTH_LABELS.wide },
];

const LAPEL_STYLES: Array<{ value: LapelStyle; label: string }> = [
  { value: 'notch', label: LAPEL_STYLE_LABELS.notch },
  { value: 'peak',  label: LAPEL_STYLE_LABELS.peak },
  { value: 'shawl', label: LAPEL_STYLE_LABELS.shawl },
];

const POCKET_STYLES: Array<{ value: PocketStyle; label: string }> = [
  { value: 'with_flap',     label: POCKET_STYLE_LABELS.with_flap },
  { value: 'double_welted', label: POCKET_STYLE_LABELS.double_welted },
  { value: 'patched',       label: POCKET_STYLE_LABELS.patched },
];

// ---------------------------------------------------------------------------
// styleKey ↔ (breastStyle, buttonCount) for backward-compat persistence.
//
// The persisted JacketConfig still carries `styleKey` (e.g. "sb-2b-blazer")
// because the backend Order entity is keyed on it.  We parse it on the way
// in and rebuild it on every change.
// ---------------------------------------------------------------------------

function parseStyleKey(key: string | undefined): { breastStyle: BreastStyle; buttonCount: number } | null {
  if (!key) return null;
  const lower = key.toLowerCase();
  if (lower.startsWith('mao')) return { breastStyle: 'mao', buttonCount: 0 };
  const m = lower.match(/^(sb|db)-(\d+)b/);
  if (!m) return null;
  return {
    breastStyle: m[1] === 'sb' ? 'single' : 'double',
    buttonCount: parseInt(m[2], 10),
  };
}

function buildStyleKey(breastStyle: BreastStyle, buttonCount: number): string {
  if (breastStyle === 'mao') return 'mao-blazer';
  const prefix = breastStyle === 'single' ? 'sb' : 'db';
  return `${prefix}-${buttonCount}b-blazer`;
}

function deriveSelection(value: JacketConfig): Selection {
  const parsed = parseStyleKey(value.styleKey);
  const lapelStyle = (value.lapelStyle as LapelStyle) || DEFAULT_SELECTION.lapelStyle;
  const lapelWidth = (value.lapelWidth as LapelWidth) || DEFAULT_SELECTION.lapelWidth;
  // pocketStyle in the legacy data could be "with_flap_x3" / "double_welted_x3";
  // split into pocketStyle + pocketThird flag.
  const rawPocket = value.pocketStyle || DEFAULT_SELECTION.pocketStyle;
  let pocketStyle: PocketStyle = DEFAULT_SELECTION.pocketStyle;
  let pocketThird = false;
  if (rawPocket.endsWith('_x3')) {
    pocketThird = true;
    const base = rawPocket.slice(0, -3);
    if (base === 'with_flap' || base === 'double_welted' || base === 'patched') {
      pocketStyle = base;
    }
  } else if (rawPocket === 'with_flap' || rawPocket === 'double_welted' || rawPocket === 'patched') {
    pocketStyle = rawPocket;
  }

  return {
    breastStyle: parsed?.breastStyle ?? DEFAULT_SELECTION.breastStyle,
    buttonCount: parsed?.buttonCount ?? DEFAULT_SELECTION.buttonCount,
    lapelWidth,
    lapelStyle: lapelStyle === 'mao' ? DEFAULT_SELECTION.lapelStyle : lapelStyle,
    pocketStyle,
    pocketThird,
  };
}

function applySelection(value: JacketConfig, sel: Selection): JacketConfig {
  const styleKey = buildStyleKey(sel.breastStyle, sel.buttonCount);
  const pocketString = sel.pocketThird ? `${sel.pocketStyle}_x3` : sel.pocketStyle;
  return {
    ...value,
    styleKey,
    lapelStyle: sel.breastStyle === 'mao' ? 'mao' : sel.lapelStyle,
    lapelWidth: sel.breastStyle === 'mao' ? '' : sel.lapelWidth,
    pocketStyle: pocketString,
  };
}

// ---------------------------------------------------------------------------
// Layer composition rules
// ---------------------------------------------------------------------------

// Some base body parts are MAO-only or non-MAO-only.  When the master JSON
// doesn't expose a breastStyle, we infer from the bodyPart name.
function baseLayerMatches(layer: ManifestLayer, breastStyle: BreastStyle): boolean {
  const opts = layer.options;
  if (opts.breastStyle) return opts.breastStyle === breastStyle;

  const bp = opts.bodyPart;
  const isMaoSpecific    = bp === 'espalda_arriba_mao' || bp === 'negra_mao';
  const isNonMaoSpecific = bp === 'espalda_arriba'     || bp === 'negra';
  if (isMaoSpecific)    return breastStyle === 'mao';
  if (isNonMaoSpecific) return breastStyle !== 'mao';
  return true;
}

// Wide-lapel + (SB1 / SB2 / DB2) is the *only* combination authored as a
// neckWithBreastPocket variant in the master config.  When eligible, the
// configurator swaps in that integrated layer and suppresses the standalone
// breast_pocket overlay so the chest pocket isn't drawn twice.
function isPocketEligibleCut(sel: Selection): boolean {
  if (sel.lapelWidth !== 'wide') return false;
  if (sel.breastStyle === 'single') return sel.buttonCount === 1 || sel.buttonCount === 2;
  if (sel.breastStyle === 'double') return sel.buttonCount === 2;
  return false;
}

interface ComposeResult {
  layers: ManifestLayer[];
  suppressedBreastPocket: boolean;
  missing: string[];
}

function composeLayers(manifest: BlazerManifest, sel: Selection): ComposeResult {
  const cat = manifest.categories;
  const baseLayers      = cat.base          ?? [];
  const lapelLayers     = cat.lapels        ?? [];
  const hipPocketLayers = cat['hip-pocket'] ?? [];

  const picked: ManifestLayer[] = [];
  const missing: string[] = [];
  let suppressedBreastPocket = false;

  // BASE — keep every layer whose breast-style constraint matches
  for (const l of baseLayers) {
    if (baseLayerMatches(l, sel.breastStyle)) picked.push(l);
  }

  // LAPEL / NECK
  if (sel.breastStyle === 'mao') {
    const mao = lapelLayers.find(
      (l) => l.kind === 'neck' && l.options.breastStyle === 'mao',
    );
    if (mao) picked.push(mao);
    else     missing.push('Mao yakası katmanı bulunamadı');
  } else {
    // Always render the plain neck/lapel.  The `neckWithBreastPocket` files
    // sound like they're a combined lapel+pocket replacement, but in
    // practice the generated asset only contains the breast pocket flap —
    // so when we treated it as a replacement, the lapel disappeared for the
    // wide-lapel combos that have a neckWithBreastPocket variant.
    const plain = lapelLayers.find(
      (l) =>
        l.kind === 'neck' &&
        l.options.breastStyle === sel.breastStyle &&
        l.options.buttonCount === sel.buttonCount &&
        l.options.lapelWidth === sel.lapelWidth &&
        l.options.lapelStyle === sel.lapelStyle,
    );
    if (plain) picked.push(plain);
    else       missing.push(
      `Yaka katmanı bulunamadı: ${sel.breastStyle}-${sel.buttonCount}b ` +
      `${sel.lapelWidth} ${sel.lapelStyle}`,
    );

    // ALSO add the integrated breast-pocket overlay when eligible — it
    // stacks above the lapel as the pocket flap.  Setting
    // suppressedBreastPocket=true keeps the standalone breast pocket from
    // the hip-pocket category off so we don't double-draw it.
    if (isPocketEligibleCut(sel)) {
      const withPocket = lapelLayers.find(
        (l) =>
          l.kind === 'neckWithBreastPocket' &&
          l.options.breastStyle === sel.breastStyle &&
          l.options.buttonCount === sel.buttonCount &&
          l.options.lapelWidth === sel.lapelWidth &&
          l.options.lapelStyle === sel.lapelStyle,
      );
      if (withPocket) {
        picked.push(withPocket);
        suppressedBreastPocket = true;
      }
    }
  }

  // HIP-POCKET CATEGORY — hip pockets + standalone breast pocket overlay
  for (const l of hipPocketLayers) {
    if (l.kind === 'breastPocket') {
      // Render the standalone breast pocket UNLESS suppressed by a
      // neckWithBreastPocket variant or by the mao breast style.
      if (sel.breastStyle === 'mao')     continue;
      if (suppressedBreastPocket)        continue;
      picked.push(l);
      continue;
    }
    if (l.kind === 'hipPocket') {
      if (l.options.pocketStyle !== sel.pocketStyle) continue;
      const layerIsThird = !!l.options.third;
      // The standard left+right hip pockets always render.  When the user
      // enables the triple-pocket toggle, ALSO render the +third overlay —
      // the +third PNG is just the small ticket pocket, not all three
      // pockets, so it must stack ADDITIVELY on top of the base pair.
      if (!layerIsThird) {
        picked.push(l);
      } else if (sel.pocketThird) {
        picked.push(l);
      }
    }
  }

  // Defensive z-order guard: the back interior lining (espalda_arriba /
  // espalda_abajo) MUST render behind the body shell.  When the body part is
  // transparent at the back-neck V, the lining peeks through; if their
  // zIndex slips above the body's (manifest typo, ambiguous tie at z=120 in
  // the mao set, …) the lining instead covers the body and the back-neck
  // looks like a transparent hole.  Force them strictly below the matching
  // body layer.
  const bodyPart: 'negra' | 'negra_mao' = sel.breastStyle === 'mao' ? 'negra_mao' : 'negra';
  const bodyLayer = picked.find((l) => l.options.bodyPart === bodyPart);
  if (bodyLayer) {
    const liningBodyParts = sel.breastStyle === 'mao'
      ? new Set(['espalda_arriba_mao', 'espalda_abajo'])
      : new Set(['espalda_arriba', 'espalda_abajo']);
    const finalPicked: ManifestLayer[] = picked.map((l) => {
      if (liningBodyParts.has(l.options.bodyPart ?? '') && l.zIndex >= bodyLayer.zIndex) {
        return { ...l, zIndex: bodyLayer.zIndex - 1 };
      }
      return l;
    });
    finalPicked.sort((a, b) => a.zIndex - b.zIndex || a.file.localeCompare(b.file));
    return { layers: finalPicked, suppressedBreastPocket, missing };
  }

  picked.sort((a, b) => a.zIndex - b.zIndex || a.file.localeCompare(b.file));

  return { layers: picked, suppressedBreastPocket, missing };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface OptionGroupProps<T extends string | number> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

function OptionGroup<T extends string | number>({
  label, options, value, onChange, disabled,
}: OptionGroupProps<T>) {
  return (
    <div className="jc-optionGroup">
      <span className="jc-optionGroupLabel">{label}</span>
      <div className="jc-optionButtons">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            className={opt.value === value ? 'jc-optionButton active' : 'jc-optionButton'}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <div className="jc-optionGroup">
      <span className="jc-optionGroupLabel">{label}</span>
      <div className="jc-optionButtons">
        <button
          type="button"
          className={checked ? 'jc-optionButton active' : 'jc-optionButton'}
          onClick={() => onChange(!checked)}
          disabled={disabled}
        >
          {checked ? 'Açık' : 'Kapalı'}
        </button>
      </div>
    </div>
  );
}

interface FabricCardProps {
  fabric: Fabric;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function FabricCard({ fabric, isActive, onClick, disabled }: FabricCardProps) {
  return (
    <button
      type="button"
      className={isActive ? 'jc-fabricCard active' : 'jc-fabricCard'}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="jc-fabricSwatch">
        {fabric.swatchUrl ? (
          <img
            src={fabric.swatchUrl}
            alt=""
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="jc-fabricSwatchFallback" />
        )}
      </div>
      <div className="jc-fabricInfo">
        <span className="jc-fabricLabel">{fabric.name}</span>
        <span className="jc-fabricSubtitle">{fabric.label}</span>
      </div>
    </button>
  );
}

interface UploadPanelProps {
  onGenerated: (fabricKey: string) => Promise<void>;
}

function UploadPanel({ onGenerated }: UploadPanelProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  function pickFile(f: File | null | undefined) {
    if (!f || !f.type.startsWith('image/')) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setStatus('idle');
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim() || status === 'loading') return;
    setStatus('loading');
    setError('');
    try {
      const body = new FormData();
      body.append('name', name.trim());
      body.append('file', file);
      const res = await fetch('http://localhost:8080/api/fabrics/generate', { 
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('erdal_guda_auth_token')}`
        },
        body 
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok) throw new Error(data.detail ?? 'Generation failed');
      setStatus('success');
      if (data.fabric) await onGenerated(data.fabric.key);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Generation failed');
    }
  }

  return (
    <div className="jc-uploadPanel">
      <h3 className="jc-uploadPanelTitle">Özel kumaş yükle</h3>
      <form className="jc-uploadForm" onSubmit={(e) => void handleSubmit(e)}>
        <div
          className={`jc-uploadZone${isDragging ? ' dragOver' : ''}${preview ? ' hasPreview' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            pickFile(e.dataTransfer.files[0]);
          }}
        >
          {preview ? (
            <img src={preview} alt="Kumaş önizleme" className="jc-uploadPreview" />
          ) : (
            <span className="jc-uploadPrompt">
              Görsel sürükleyin
              <br />veya seçmek için tıklayın
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            className="jc-uploadInput"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </div>

        <div className="jc-uploadControls">
          <input
            className="jc-uploadName"
            type="text"
            placeholder="Kumaş adı (ör. Bordo Yün)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === 'loading'}
          />
          <button
            type="submit"
            className="jc-uploadSubmit"
            disabled={!file || !name.trim() || status === 'loading'}
          >
            {status === 'loading' ? 'Oluşturuluyor…' : 'Oluştur'}
          </button>
        </div>

        {status === 'error'   && <p className="jc-uploadError">{error}</p>}
        {status === 'success' && <p className="jc-uploadSuccess">Tamamlandı — kumaş eklendi!</p>}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface JacketConfiguratorProps {
  value: JacketConfig;
  onChange: (config: JacketConfig) => void;
  readOnly?: boolean;
  showUpload?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only' | 'controls-all';
  activeTab?: 'fabric' | 'style';
  viewerBackground?: string;
}

export default function JacketConfigurator({
  value,
  onChange,
  readOnly = false,
  showUpload = false,
  mode = 'full',
  activeTab = 'fabric',
  viewerBackground,
}: JacketConfiguratorProps) {
  const [manifest, setManifest] = useState<BlazerManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);

  // Stable refs so the mount-time effects can call onChange without
  // re-running when the parent rebinds the callback or value.
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialValueRef = useRef(value);

  // Fetch the blazer manifest once on mount.
  useEffect(() => {
    fetch('/assets/blazer/manifest.json')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`blazer/manifest.json yüklenemedi (HTTP ${r.status})`);
        }
        return r.json() as Promise<BlazerManifest>;
      })
      .then((data) => {
        setManifest(data);
        // Seed a default styleKey only if the persisted config is empty.
        if (!initialValueRef.current.styleKey) {
          onChangeRef.current(applySelection(initialValueRef.current, DEFAULT_SELECTION));
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setManifestError(err.message);
      });
  }, []);

  // Fetch fabrics once on mount
  useEffect(() => {
    getFabrics('JACKET')
      .then((data) => {
        setFabrics(data);
        if (data.length > 0 && !initialValueRef.current.fabricKey) {
          const first = data[0];
          onChangeRef.current({
            ...initialValueRef.current,
            fabricKey: first.key,
            fabricLabel: first.name,
          });
        }
      })
      .catch(console.error);
  }, []);

  // Derive selection from value on every render (cheap)
  const selection = useMemo(() => deriveSelection(value), [value]);

  // Memoised layer composition
  const composed = useMemo<ComposeResult>(() => {
    if (!manifest) return { layers: [], suppressedBreastPocket: false, missing: [] };
    return composeLayers(manifest, selection);
  }, [manifest, selection]);

  const effectiveFabricKey = value.fabricKey || fabrics[0]?.key || '';

  // Map the selected fabricKey → fabricId so we can fetch the per-fabric
  // PNG variant rendered by fabric-engine. Falls back to the template if
  // either the fabric is unknown or no per-fabric variant has been
  // generated yet (the <img onError> handler then restores the template src).
  const activeFabricId = useMemo(
    () => fabrics.find((f) => f.key === effectiveFabricKey)?.fabricId ?? null,
    [fabrics, effectiveFabricKey],
  );

  const viewerImageUrls = useMemo(() => (
    composed.layers.flatMap((layer) => {
      if (activeFabricId && layer.fabricDependent) {
        return [
          layer.src,
          generatedLayerUrl('blazer', activeFabricId, layer.file, FABRIC_ASSET_VERSION),
        ];
      }
      return [layer.src];
    })
  ), [activeFabricId, composed.layers]);
  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const backgroundPreloadUrls = useMemo(() => {
    const fabricIds = fabrics
      .map((fabric) => fabric.fabricId)
      .filter((fabricId): fabricId is string => Boolean(fabricId && fabricId !== activeFabricId))
      .slice(0, 6);
    const layerFiles = composed.layers
      .filter((layer) => layer.fabricDependent)
      .sort((a, b) => {
        const aBase = a.category === 'base' ? 0 : 1;
        const bBase = b.category === 'base' ? 0 : 1;
        return aBase - bBase || a.zIndex - b.zIndex;
      })
      .map((layer) => layer.file);

    return fabricIds.flatMap((fabricId) => (
      layerFiles.map((file) => generatedLayerUrl('blazer', fabricId, file, FABRIC_ASSET_VERSION))
    ));
  }, [activeFabricId, composed.layers, fabrics]);
  useBackgroundImagePreload(backgroundPreloadUrls);

  // ---------------------------------------------------------------------------
  // Handlers — every selection mutation routes through applySelection so the
  // persisted JacketConfig (styleKey + legacy fields) stays in sync.
  // ---------------------------------------------------------------------------

  function update(sel: Selection) {
    onChange(applySelection(value, sel));
  }

  function setBreastStyle(v: BreastStyle) {
    const next: Selection = { ...selection, breastStyle: v };
    // Normalise buttonCount when switching breast styles
    const valid = BUTTON_COUNTS_BY_BREAST[v];
    if (v === 'mao') {
      next.buttonCount = 0;
    } else if (!valid.includes(selection.buttonCount)) {
      next.buttonCount = valid.includes(2) ? 2 : valid[0];
    }
    update(next);
  }

  function setButtonCount(n: number)      { update({ ...selection, buttonCount: n }); }
  function setLapelWidth(v: LapelWidth)   { update({ ...selection, lapelWidth: v }); }
  function setLapelStyle(v: LapelStyle)   { update({ ...selection, lapelStyle: v }); }
  function setPocketStyle(v: PocketStyle) { update({ ...selection, pocketStyle: v }); }
  function setPocketThird(v: boolean)     { update({ ...selection, pocketThird: v }); }

  async function handleFabricGenerated(newFabricKey: string) {
    try {
      const newFabrics = await getFabrics('JACKET');
      setFabrics(newFabrics);
      const found = newFabrics.find((f) => f.key === newFabricKey);
      onChange({
        ...value,
        fabricKey: newFabricKey,
        fabricLabel: found?.name ?? newFabricKey,
      });
    } catch (err) {
      console.error('Yeniden yükleme başarısız:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Reusable JSX blocks
  // ---------------------------------------------------------------------------

  const isMao = selection.breastStyle === 'mao';

  // -----------------------------------------------------------------------
  // Icon-driven inputs. UI restyle only — visual layer composition logic
  // (composeLayers, missing-overlay matching) reads the same selection
  // state, so the rendered PNG stack is unchanged.
  // -----------------------------------------------------------------------

  const breastStyleOptions: IconChoiceOption<BreastStyle>[] = BREAST_STYLES.map((bs) => ({
    value: bs.value,
    label: bs.label,
    iconSrc: JACKET_BREAST_ICONS[bs.value],
  }));

  const styleBar = (
    <IconChoiceGroup<BreastStyle>
      label="Yaka Kesimi"
      value={selection.breastStyle}
      options={breastStyleOptions}
      onChange={setBreastStyle}
      disabled={readOnly}
    />
  );

  const fabricBar = fabrics.length > 0 ? (
    <div className="jc-fabricBar">
      <span className="jc-fabricBarLabel">Kumaş</span>
      <div className="jc-fabricCards">
        {fabrics.map((fabric) => (
          <FabricCard
            key={fabric.key}
            fabric={fabric}
            isActive={fabric.key === effectiveFabricKey}
            onClick={() =>
              onChange({ ...value, fabricKey: fabric.key, fabricLabel: fabric.name })
            }
            disabled={readOnly}
          />
        ))}
      </div>
    </div>
  ) : null;

  const buttonCountOptions: IconChoiceOption<number>[] = BUTTON_COUNTS_BY_BREAST[selection.breastStyle].map((n) => {
    const iconKey = `${selection.breastStyle}-${n}` as keyof typeof JACKET_BUTTON_ICONS;
    return {
      value: n,
      label: `${n} düğme`,
      iconSrc: JACKET_BUTTON_ICONS[iconKey],
    };
  });

  const lapelWidthOptions: IconChoiceOption<LapelWidth>[] = LAPEL_WIDTHS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: JACKET_LAPEL_WIDTH_ICONS[opt.value],
  }));

  const lapelStyleOptions: IconChoiceOption<LapelStyle>[] = LAPEL_STYLES.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: JACKET_LAPEL_STYLE_ICONS[opt.value],
  }));

  const pocketOptions: IconChoiceOption<PocketStyle>[] = POCKET_STYLES.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: JACKET_POCKET_ICONS[opt.value],
  }));

  // ---- Data-only features (no visual effect) ---------------------------
  const fitValue: JacketFit = (value.fit as JacketFit | undefined) ?? 'regular';
  const ventValue: JacketVent = (value.vent as JacketVent | undefined) ?? 'single';

  const fitOptions: IconChoiceOption<JacketFit>[] = [
    { value: 'slim',    label: JACKET_FIT_LABELS.slim,    iconSrc: JACKET_FIT_ICONS.slim    },
    { value: 'regular', label: JACKET_FIT_LABELS.regular, iconSrc: JACKET_FIT_ICONS.regular },
  ];

  const ventOptions: IconChoiceOption<JacketVent>[] = [
    { value: 'single', label: JACKET_VENT_LABELS.single, iconSrc: JACKET_VENT_ICONS.single },
    { value: 'double', label: JACKET_VENT_LABELS.double, iconSrc: JACKET_VENT_ICONS.double },
    { value: 'none',   label: JACKET_VENT_LABELS.none,   iconSrc: JACKET_VENT_ICONS.none   },
  ];

  function setFit(next: JacketFit)  { onChange({ ...value, fit: next });  }
  function setVent(next: JacketVent) { onChange({ ...value, vent: next }); }

  const optionBar = (
    <div className="icon-choice-stack">
      {!isMao && (
        <IconChoiceGroup<number>
          label="Düğme sayısı"
          value={selection.buttonCount}
          options={buttonCountOptions}
          onChange={setButtonCount}
          disabled={readOnly}
        />
      )}
      {!isMao && (
        <IconChoiceGroup<LapelWidth>
          label="Yaka genişliği"
          value={selection.lapelWidth}
          options={lapelWidthOptions}
          onChange={setLapelWidth}
          disabled={readOnly}
        />
      )}
      {!isMao && (
        <IconChoiceGroup<LapelStyle>
          label="Yaka tipi"
          value={selection.lapelStyle}
          options={lapelStyleOptions}
          onChange={setLapelStyle}
          disabled={readOnly}
        />
      )}
      <IconChoiceGroup<PocketStyle>
        label="Cep stili"
        value={selection.pocketStyle}
        options={pocketOptions}
        onChange={setPocketStyle}
        disabled={readOnly}
      />
      {selection.pocketStyle !== 'patched' && (
        <div className="jc-optionGroup">
          <span className="jc-optionGroupLabel">Üçlü cep (×3)</span>
          <div className="jc-optionButtons">
            <button
              type="button"
              className={selection.pocketThird ? 'jc-optionButton active' : 'jc-optionButton'}
              onClick={() => setPocketThird(!selection.pocketThird)}
              disabled={readOnly}
            >
              {selection.pocketThird ? 'Açık' : 'Kapalı'}
            </button>
          </div>
        </div>
      )}
      <IconChoiceGroup<JacketFit>
        label="Kesim"
        value={fitValue}
        options={fitOptions}
        onChange={setFit}
        disabled={readOnly}
      />
      <IconChoiceGroup<JacketVent>
        label="Arka Yırtmaç"
        value={ventValue}
        options={ventOptions}
        onChange={setVent}
        disabled={readOnly}
      />
    </div>
  );

  const viewerInner = (
    <div className="jc-viewer">
      {!manifest && !manifestError && (
        <div className="jc-viewerEmpty">manifest yükleniyor…</div>
      )}
      {manifestError && (
        <div className="jc-viewerEmpty jc-viewerError">manifest: {manifestError}</div>
      )}
      {composed.layers.flatMap((layer) => {
        // Strategy: for each fabric-dependent layer we render TWO images at
        // the same zIndex:
        //   1. the bare template — provides the silhouette and the
        //      greyscale shading baked into the master art (creases,
        //      button shadows, edge anti-aliasing).  Also acts as a
        //      content fallback when the per-fabric variant is empty
        //      (e.g. the jacket's `negra` body, whose generated output is
        //      mostly blank — without this, the interior lining behind it
        //      reads as a transparent hole).
        //   2. the per-fabric variant on top with mix-blend-mode: multiply
        //      — stamps the fabric tone INTO the bare template's
        //      greyscale, so the colour picks up every fold and shadow
        //      from the bare art.  This is what makes the shirt's render
        //      feel rich, and pulling the same recipe into the jacket
        //      pipeline closes the quality gap.
        const isFabric = !!activeFabricId && layer.fabricDependent;
        const fabricUrl = isFabric
          ? generatedLayerUrl('blazer', activeFabricId, layer.file, FABRIC_ASSET_VERSION)
          : null;
        const elements: ReactElement[] = [];

        if (fabricUrl) {
          elements.push(
            <img
              key={`blazer::${layer.id}::shading`}
              src={layer.src}
              alt=""
              className="jc-layer"
              style={{ zIndex: layer.zIndex }}
              draggable={false}
              onError={() => console.error('Katman yüklenemedi:', layer.src)}
            />,
          );
          // The Python renderer bakes the multiply blend against the bare
          // template directly into this PNG, so the frontend renders it as a
          // plain <img> — no mix-blend-mode, no filters. The bare template
          // beneath remains as a defensive fallback for layers whose
          // per-fabric output is intentionally near-blank.
          elements.push(
            <img
              key={`blazer::${layer.id}::${activeFabricId}`}
              src={fabricUrl}
              alt={layer.id}
              className="jc-layer"
              style={{ zIndex: layer.zIndex }}
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
              }}
            />,
          );
        } else {
          elements.push(
            <img
              key={`blazer::${layer.id}::template`}
              src={layer.src}
              alt={layer.id}
              className="jc-layer"
              style={{ zIndex: layer.zIndex }}
              draggable={false}
              onError={() => console.error('Katman yüklenemedi:', layer.src)}
            />,
          );
        }
        return elements;
      })}
      <PremiumViewerLoader active={viewerLoading} />
    </div>
  );

  const viewerCard = <div className="jc-viewerCard">{viewerInner}</div>;

  const missingPanel = composed.missing.length > 0 ? (
    <div className="jc-missingPanel">
      <h3>Eksik katmanlar</h3>
      <ul>
        {composed.missing.map((m) => <li key={m}>{m}</li>)}
      </ul>
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Mode-specific renders (signatures unchanged from old component)
  // ---------------------------------------------------------------------------

  if (mode === 'viewer-only') {
    return (
      <div
        className="jc-viewer-standalone"
        style={viewerBackground ? { background: viewerBackground } : undefined}
      >
        {viewerInner}
      </div>
    );
  }

  if (mode === 'controls-only') {
    if (activeTab === 'fabric') {
      return <div className="jc-root">{fabricBar}</div>;
    }
    return (
      <div className="jc-root">
        {styleBar}
        {optionBar}
        {missingPanel}
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
                {missingPanel}
              </>
            ),
          },
        ]}
      />
    );
  }

  // mode === 'full' (default)
  return (
    <div className="jc-root">
      {styleBar}
      {showUpload && !readOnly && (
        <UploadPanel onGenerated={handleFabricGenerated} />
      )}
      {fabricBar}
      {optionBar}
      {missingPanel}
      {viewerCard}
    </div>
  );
}
