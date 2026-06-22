// SuitConfigurator — dedicated configurator for the SUIT (Takım Elbise)
// product type.
//
// Mirrors the structure of JacketConfigurator but hard-targets /assets/suit/
// AND carries the suit-specific transform logic: the suit manifest contains
// BOTH jacket and pant artwork authored at the same canvas centre, so each
// layer is classified jacket-vs-pant by filename and translated up/down so
// the two halves sit side-by-side instead of on top of each other.

import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { generateFabric, getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type { JacketConfig, JacketFit, JacketVent } from '../types/jacket';
import type {
  PantConfig,
  PantDrape,
  PantFasteningStyle,
  PantFit,
  PantLegStyle,
  PantPleatStyle,
} from '../types/pant';
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
  PANT_DRAPE_ICONS,
  PANT_FASTENING_ICONS,
  PANT_FIT_ICONS,
  PANT_LEG_STYLE_ICONS,
  PANT_PLEAT_ICONS,
} from '../data/configuratorIcons';
import {
  BREAST_STYLE_LABELS,
  JACKET_FIT_LABELS,
  JACKET_LAPEL_WIDTH_LABELS,
  JACKET_VENT_LABELS,
  LAPEL_STYLE_LABELS,
  PANT_DRAPE_LABELS,
  PANT_FASTENING_LABELS,
  PANT_FIT_LABELS,
  PANT_LEG_STYLE_LABELS,
  PANT_PLEAT_LABELS,
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
// Manifest schema
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

interface SuitManifest {
  garment: string;
  assetRoot: string;
  categories: Record<string, ManifestLayer[]>;
}

type Fabric = FabricResponse;

// ---------------------------------------------------------------------------
// Selection state
// ---------------------------------------------------------------------------

interface Selection {
  breastStyle: BreastStyle;
  buttonCount: number;
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
// so the browser refetches PNGs instead of serving the stale cached copies
// from the previous render (Zone Picker rotations were not visible because
// of this exact stale cache).
const FABRIC_ASSET_VERSION = 4;

// Suit-specific: Mao is intentionally NOT offered here (kept in the
// JacketConfigurator).  The type still includes 'mao' so existing persisted
// configs with a mao styleKey roundtrip without errors.
const BREAST_STYLES: Array<{ value: BreastStyle; label: string }> = [
  { value: 'single', label: BREAST_STYLE_LABELS.single },
  { value: 'double', label: BREAST_STYLE_LABELS.double },
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
// styleKey persistence (shared format with the other configurators)
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
  // Coerce legacy mao suit selections to single — the SUIT configurator no
  // longer offers Mao.  Without this, an order saved as mao would land with
  // no breast-style button active and an empty button-count list.
  const sanitisedParsed = parsed && parsed.breastStyle === 'mao'
    ? { breastStyle: 'single' as const, buttonCount: 2 }
    : parsed;
  const lapelStyle = (value.lapelStyle as LapelStyle) || DEFAULT_SELECTION.lapelStyle;
  const lapelWidth = (value.lapelWidth as LapelWidth) || DEFAULT_SELECTION.lapelWidth;
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
    breastStyle: sanitisedParsed?.breastStyle ?? DEFAULT_SELECTION.breastStyle,
    buttonCount: sanitisedParsed?.buttonCount ?? DEFAULT_SELECTION.buttonCount,
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
// Suit-specific layer classification
//
// The suit manifest mixes jacket-half and pant-half artwork at the same
// canvas centre. Each layer is classified by filename so we can apply a
// translateY split at render time. zIndex is unreliable for this — some
// jacket lining panels (notably `interior+espalda_abajo+length_long`) sit
// at zIndex 45 alongside the pant base.
// ---------------------------------------------------------------------------

type SuitPart = 'jacket' | 'pant';

function classifySuitLayer(layer: ManifestLayer): SuitPart {
  const s = `${layer.file} ${layer.id}`.toLowerCase();
  if (s.includes('pant')) return 'pant';
  if (
    s.includes('pleats_') ||
    s.includes('front_pocket') ||
    s.includes('back_pocket') ||
    s.includes('+cut_')
  ) {
    return 'pant';
  }
  return 'jacket';
}

// Per-layer transform applied to every suit layer. Applied per-image (not
// on a wrapper) so each layer keeps its own zIndex within the shared viewer
// stacking context — lapels still draw above the body, breast pocket still
// above lapels, etc.
const SUIT_LAYER_TRANSFORM: Record<SuitPart, string> = {
  jacket: 'scale(0.78) translateY(-22%)',
  pant:   'scale(0.78) translateY(55%)',
};

// ---------------------------------------------------------------------------
// Layer composition
// ---------------------------------------------------------------------------

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

function composeLayers(manifest: SuitManifest, sel: Selection): ComposeResult {
  const cat = manifest.categories;
  const baseLayers      = cat.base          ?? [];
  const lapelLayers     = cat.lapels        ?? [];
  const hipPocketLayers = cat['hip-pocket'] ?? [];

  const picked: ManifestLayer[] = [];
  const missing: string[] = [];
  let suppressedBreastPocket = false;

  for (const l of baseLayers) {
    if (baseLayerMatches(l, sel.breastStyle)) picked.push(l);
  }

  if (sel.breastStyle === 'mao') {
    const mao = lapelLayers.find(
      (l) => l.kind === 'neck' && l.options.breastStyle === 'mao',
    );
    if (mao) picked.push(mao);
    else     missing.push('Mao yakası katmanı bulunamadı');
  } else {
    // Same fix as JacketConfigurator: always render the plain neck/lapel
    // and use neckWithBreastPocket purely as an additive overlay, because
    // the generated file only contains the pocket flap.
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

  for (const l of hipPocketLayers) {
    if (l.kind === 'breastPocket') {
      if (sel.breastStyle === 'mao')     continue;
      if (suppressedBreastPocket)        continue;
      picked.push(l);
      continue;
    }
    if (l.kind === 'hipPocket') {
      if (l.options.pocketStyle !== sel.pocketStyle) continue;
      const layerIsThird = !!l.options.third;
      // See JacketConfigurator — keep the standard L+R hip pockets always
      // and additively add the +third overlay (which only contains the
      // small ticket pocket).
      if (!layerIsThird) {
        picked.push(l);
      } else if (sel.pocketThird) {
        picked.push(l);
      }
    }
  }

  // Mirror of the guard in JacketConfigurator — force back interior lining
  // layers strictly behind the body shell.  Without this, a manifest tie
  // (e.g. both interior+espalda_arriba_mao and negra_mao at zIndex 120) or
  // a typo can let the lining slip on top of the body and the back-neck
  // reads as a transparent hole instead of showing the lining.
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
      const data = await generateFabric({ name: name.trim(), file, garmentType: 'SUIT' });
      if (!data.ok) throw new Error(data.detail ?? 'Generation failed');
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

export interface SuitConfiguratorProps {
  value: JacketConfig;
  onChange: (config: JacketConfig) => void;
  pantValue?: PantConfig;
  onPantChange?: (config: PantConfig) => void;
  readOnly?: boolean;
  showUpload?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only' | 'controls-all';
  activeTab?: 'fabric' | 'style' | 'pants';
  viewerBackground?: string;
}

export default function SuitConfigurator({
  value,
  onChange,
  pantValue,
  onPantChange,
  readOnly = false,
  showUpload = false,
  mode = 'full',
  activeTab = 'fabric',
  viewerBackground,
}: SuitConfiguratorProps) {
  const [manifest, setManifest] = useState<SuitManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [suitOptionsTab, setSuitOptionsTab] = useState<'jacket' | 'pant'>('jacket');

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const onPantChangeRef = useRef(onPantChange);
  useEffect(() => { onPantChangeRef.current = onPantChange; });
  const initialValueRef = useRef(value);
  const initialPantValueRef = useRef(pantValue);

  useEffect(() => {
    fetch('/assets/suit/manifest.json')
      .then((r) => {
        if (!r.ok) {
          throw new Error(`suit/manifest.json yüklenemedi (HTTP ${r.status})`);
        }
        return r.json() as Promise<SuitManifest>;
      })
      .then((data) => {
        setManifest(data);
        if (!initialValueRef.current.styleKey) {
          onChangeRef.current(applySelection(initialValueRef.current, DEFAULT_SELECTION));
        }
      })
      .catch((err: Error) => {
        console.error(err);
        setManifestError(err.message);
      });
  }, []);

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
          if (!initialPantValueRef.current?.fabricKey) {
            onPantChangeRef.current?.({
              fasteningStyle: 'centered',
              pleatStyle: 'none',
              fit: 'normal',
              legStyle: 'straight',
              drape: 'none',
              fabricKey: first.fabricId,
              fabricLabel: first.name,
            });
          }
        }
      })
      .catch(console.error);
  }, []);

  const selection = useMemo(() => deriveSelection(value), [value]);

  const composed = useMemo<ComposeResult>(() => {
    if (!manifest) return { layers: [], suppressedBreastPocket: false, missing: [] };
    return composeLayers(manifest, selection);
  }, [manifest, selection]);

  const effectiveFabricKey = value.fabricKey || fabrics[0]?.key || '';

  const activeFabricId = useMemo(
    () => fabrics.find((f) => f.key === effectiveFabricKey)?.fabricId ?? null,
    [fabrics, effectiveFabricKey],
  );
  const activeFabric = useMemo(
    () => fabrics.find((f) => f.key === effectiveFabricKey) ?? null,
    [effectiveFabricKey, fabrics],
  );

  const effectivePantValue: PantConfig = pantValue ?? {
    fasteningStyle: 'centered',
    pleatStyle: 'none',
    fit: 'normal',
    legStyle: 'straight',
    drape: 'none',
    fabricKey: activeFabricId ?? '',
    fabricLabel: activeFabric?.name ?? value.fabricLabel,
  };

  useEffect(() => {
    if (!activeFabric || !onPantChange) return;
    if (
      pantValue?.fabricKey === activeFabric.fabricId &&
      pantValue?.fabricLabel === activeFabric.name
    ) {
      return;
    }
    onPantChange({
      ...effectivePantValue,
      fabricKey: activeFabric.fabricId,
      fabricLabel: activeFabric.name,
    });
  }, [
    activeFabric?.fabricId,
    activeFabric?.name,
    onPantChange,
    pantValue?.fabricKey,
    pantValue?.fabricLabel,
  ]);

  const viewerImageUrls = useMemo(() => (
    composed.layers.flatMap((layer) => {
      if (activeFabricId && layer.fabricDependent) {
        return [
          layer.src,
          generatedLayerUrl('suit', activeFabricId, layer.file, FABRIC_ASSET_VERSION),
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
      layerFiles.map((file) => generatedLayerUrl('suit', fabricId, file, FABRIC_ASSET_VERSION))
    ));
  }, [activeFabricId, composed.layers, fabrics]);
  useBackgroundImagePreload(backgroundPreloadUrls);


  function update(sel: Selection) {
    onChange(applySelection(value, sel));
  }

  function setBreastStyle(v: BreastStyle) {
    const next: Selection = { ...selection, breastStyle: v };
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
      if (found) {
        onPantChange?.({
          ...effectivePantValue,
          fabricKey: found.fabricId,
          fabricLabel: found.name,
        });
      }
    } catch (err) {
      console.error('Yeniden yükleme başarısız:', err);
    }
  }

  const isMao = selection.breastStyle === 'mao';

  // -----------------------------------------------------------------------
  // Icon-driven inputs. The icons are purely UI — every onChange routes
  // through the SAME setter that was wired to the old text buttons, so the
  // visual layer composition (composeLayers) is unchanged.
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
            onClick={() => {
              onChange({ ...value, fabricKey: fabric.key, fabricLabel: fabric.name });
              onPantChange?.({
                ...effectivePantValue,
                fabricKey: fabric.fabricId,
                fabricLabel: fabric.name,
              });
            }}
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

  // Data-only Jacket/Suit features. The visual composition functions
  // (composeLayers, classifySuitLayer) do NOT read these state keys, so the
  // PNG layer stack stays exactly the same regardless of fit/vent selection.
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

  function setFit(next: JacketFit) {
    onChange({ ...value, fit: next });
  }
  function setVent(next: JacketVent) {
    onChange({ ...value, vent: next });
  }

  const pantFasteningValue: PantFasteningStyle = effectivePantValue.fasteningStyle ?? 'centered';
  const pantPleatValue: PantPleatStyle = effectivePantValue.pleatStyle ?? 'none';
  const pantFitValue: PantFit = effectivePantValue.fit ?? 'normal';
  const pantLegValue: PantLegStyle = effectivePantValue.legStyle ?? 'straight';
  const pantDrapeValue: PantDrape = effectivePantValue.drape ?? 'none';

  const pantFasteningOptions: IconChoiceOption<PantFasteningStyle>[] = [
    'centered',
    'no-button',
    'off-centered',
    'off-centered-buttonless',
  ].map((style) => ({
    value: style as PantFasteningStyle,
    label: PANT_FASTENING_LABELS[style],
    iconSrc: PANT_FASTENING_ICONS[style as keyof typeof PANT_FASTENING_ICONS],
  }));

  const pantPleatOptions: IconChoiceOption<PantPleatStyle>[] = [
    'none',
    'single-pleated',
    'double-pleated',
  ].map((style) => ({
    value: style as PantPleatStyle,
    label: PANT_PLEAT_LABELS[style],
    iconSrc: PANT_PLEAT_ICONS[style as keyof typeof PANT_PLEAT_ICONS],
  }));

  const pantFitOptions: IconChoiceOption<PantFit>[] = [
    { value: 'slim', label: PANT_FIT_LABELS.slim, iconSrc: PANT_FIT_ICONS.slim },
    { value: 'normal', label: PANT_FIT_LABELS.normal, iconSrc: PANT_FIT_ICONS.normal },
  ];

  const pantLegOptions: IconChoiceOption<PantLegStyle>[] = [
    { value: 'straight', label: PANT_LEG_STYLE_LABELS.straight, iconSrc: PANT_LEG_STYLE_ICONS.straight },
    { value: 'cuffed', label: PANT_LEG_STYLE_LABELS.cuffed, iconSrc: PANT_LEG_STYLE_ICONS.cuffed },
  ];

  const pantDrapeOptions: IconChoiceOption<PantDrape>[] = [
    { value: 'none', label: PANT_DRAPE_LABELS.none, iconSrc: PANT_DRAPE_ICONS.none },
    { value: 'light', label: PANT_DRAPE_LABELS.light, iconSrc: PANT_DRAPE_ICONS.light },
    { value: 'full', label: PANT_DRAPE_LABELS.full, iconSrc: PANT_DRAPE_ICONS.full },
  ];

  function updatePantConfig(patch: Partial<PantConfig>) {
    onPantChange?.({
      ...effectivePantValue,
      fabricKey: effectivePantValue.fabricKey || activeFabricId || '',
      fabricLabel: effectivePantValue.fabricLabel || activeFabric?.name || value.fabricLabel,
      ...patch,
    });
  }

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
      {/* Data-only features below — see types/jacket.ts. */}
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

  const pantOptionBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<PantFit>
        label="Pantolon Fit"
        value={pantFitValue}
        options={pantFitOptions}
        onChange={(next) => updatePantConfig({ fit: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantFasteningStyle>
        label="Pantolon Bel"
        value={pantFasteningValue}
        options={pantFasteningOptions}
        onChange={(next) => updatePantConfig({ fasteningStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantDrape>
        label="Pantolon Döküm"
        value={pantDrapeValue}
        options={pantDrapeOptions}
        onChange={(next) => updatePantConfig({ drape: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantLegStyle>
        label="Pantolon Paça"
        value={pantLegValue}
        options={pantLegOptions}
        onChange={(next) => updatePantConfig({ legStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantPleatStyle>
        label="Pantolon Pile"
        value={pantPleatValue}
        options={pantPleatOptions}
        onChange={(next) => updatePantConfig({ pleatStyle: next })}
        disabled={readOnly}
      />
    </div>
  );

  // Every suit layer gets a transform: jacket halves shift up, pant halves
  // shift down. Applied per-image so the manifest's authored zIndex still
  // sorts siblings within the shared viewer stacking context.
  const viewerInner = (
    <div className="jc-viewer">
      {!manifest && !manifestError && (
        <div className="jc-viewerEmpty">manifest yükleniyor…</div>
      )}
      {manifestError && (
        <div className="jc-viewerEmpty jc-viewerError">manifest: {manifestError}</div>
      )}
      {composed.layers.flatMap((layer) => {
        // Per-component shader rendering: every layer (lapels, sleeves,
        // hip-pocket, base, pant cut, pleats, …) requests its own per-fabric
        // PNG from the suit's generated/ output. Those PNGs are produced by
        // fabric_generator.py against the suit manifest's zone polygons, so
        // stripe/pattern rotation honours the Zone Picker markings per
        // component. Missing variants are hidden via onError, leaving the
        // bare template visible — exactly the JacketConfigurator recipe.
        const part = classifySuitLayer(layer);
        const transform = SUIT_LAYER_TRANSFORM[part];
        const baseStyle: React.CSSProperties = {
          zIndex: layer.zIndex,
          transform,
          transformOrigin: '50% 50%',
        };
        const isFabric = !!activeFabricId && layer.fabricDependent;
        const fabricUrl = isFabric
          ? generatedLayerUrl('suit', activeFabricId, layer.file, FABRIC_ASSET_VERSION)
          : null;
        const elements: ReactElement[] = [];

        if (fabricUrl) {
          // Render ONLY the per-fabric PNG. It already bakes the template's
          // greyscale shading and preserves the template alpha exactly, so the
          // bare template beneath is redundant — and because the template is
          // near-white while the fabric is dark, stacking it leaked a white
          // fringe through every anti-aliased layer edge (the "white lines").
          // Fall back to the bare template (once) only if the variant is missing.
          elements.push(
            <img
              key={`suit::${layer.id}::${activeFabricId}`}
              src={fabricUrl}
              alt={layer.id}
              className="jc-layer"
              style={baseStyle}
              draggable={false}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.dataset.fellBack) return;
                img.dataset.fellBack = '1';
                img.src = layer.src;
              }}
            />,
          );
        } else {
          elements.push(
            <img
              key={`suit::${layer.id}::template`}
              src={layer.src}
              alt={layer.id}
              className="jc-layer"
              style={baseStyle}
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

  const suitTabbedOptions = (
    <div className="suit-config-tabs">
      <div className="suit-config-tabList" role="tablist" aria-label="Takım elbise özellikleri">
        <button
          type="button"
          className={suitOptionsTab === 'jacket' ? 'suit-config-tab active' : 'suit-config-tab'}
          onClick={() => setSuitOptionsTab('jacket')}
          role="tab"
          aria-selected={suitOptionsTab === 'jacket'}
        >
          Ceket Özellikleri
        </button>
        <button
          type="button"
          className={suitOptionsTab === 'pant' ? 'suit-config-tab active' : 'suit-config-tab'}
          onClick={() => setSuitOptionsTab('pant')}
          role="tab"
          aria-selected={suitOptionsTab === 'pant'}
        >
          Pantolon Özellikleri
        </button>
      </div>
      <div className="suit-config-tabPanel" role="tabpanel">
        {suitOptionsTab === 'jacket' ? (
          <>
            {styleBar}
            {optionBar}
            {missingPanel}
          </>
        ) : (
          pantOptionBar
        )}
      </div>
    </div>
  );

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
    if (activeTab === 'pants') {
      return <div className="jc-root">{pantOptionBar}</div>;
    }
    return (
      <div className="jc-root">
        {suitTabbedOptions}
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
            title: 'Özellikler',
            content: suitTabbedOptions,
          },
        ]}
      />
    );
  }

  return (
    <div className="jc-root">
      {styleBar}
      {showUpload && !readOnly && (
        <UploadPanel onGenerated={handleFabricGenerated} />
      )}
      {fabricBar}
      {suitTabbedOptions}
      {viewerCard}
    </div>
  );
}
