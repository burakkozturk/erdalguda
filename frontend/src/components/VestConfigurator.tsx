import { useEffect, useMemo, useRef, useState } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type { VestConfig, VestLapelShape, VestLapelWidth, VestStylePrefix } from '../types/vest';
import { vestLapelKey } from '../types/vest';
import { ConfiguratorAccordion } from './ConfiguratorAccordion';
import { IconChoiceGroup, type IconChoiceOption } from './IconChoiceCard';
import { VEST_LAPEL_SHAPE_ICONS, VEST_STYLE_ICONS } from '../data/configuratorIcons';
import {
  VEST_LAPEL_SHAPE_LABELS,
  VEST_LAPEL_WIDTH_LABELS,
  VEST_STYLE_LABELS,
} from '../data/configuratorLabels';
import { generatedLayerUrl } from '../data/assetUrls';
import {
  useBackgroundImagePreload,
  useViewerImageLoading,
} from '../hooks/useConfiguratorImageLoading';
import './JacketConfigurator.css';
import PremiumViewerLoader from './PremiumViewerLoader';

const FABRIC_ASSET_VERSION = 4;

// ---------------------------------------------------------------------------
// Display labels (Turkish)
// ---------------------------------------------------------------------------

const STYLE_OPTIONS: { value: VestStylePrefix; label: string }[] = [
  { value: 'single-4btn', label: VEST_STYLE_LABELS['single-4btn'] },
  { value: 'single-5btn', label: VEST_STYLE_LABELS['single-5btn'] },
  { value: 'double-6btn', label: VEST_STYLE_LABELS['double-6btn'] },
];

const WIDTH_OPTIONS: { value: VestLapelWidth; label: string }[] = [
  { value: 'narrow', label: VEST_LAPEL_WIDTH_LABELS.narrow },
  { value: 'medium', label: VEST_LAPEL_WIDTH_LABELS.medium },
];

const SHAPE_OPTIONS: { value: VestLapelShape; label: string }[] = [
  { value: 'notch', label: VEST_LAPEL_SHAPE_LABELS.notch },
  { value: 'peak',  label: VEST_LAPEL_SHAPE_LABELS.peak },
  { value: 'shawl', label: VEST_LAPEL_SHAPE_LABELS.shawl },
  { value: 'no',    label: VEST_LAPEL_SHAPE_LABELS.no },
];

// ---------------------------------------------------------------------------
// Config shapes from /api/vests/config
// ---------------------------------------------------------------------------

interface ConfigLayer {
  path: string;
  z: number;
  fabric: boolean;
  rotation?: number;
  zones?: unknown[] | null;
}

interface VestConfigJson {
  base: ConfigLayer[];
  lapels: Record<string, { layers: ConfigLayer[] }>;
  'hip-pocket': Record<string, { layers: ConfigLayer[] }>;
}

interface ViewerLayer {
  key: string;
  z: number;
  src: string;
  fallbackSrc?: string;
}

// ---------------------------------------------------------------------------
// Layer resolution
// ---------------------------------------------------------------------------

function buildLayers(
  config: VestConfigJson,
  stylePrefix: string,
  lapelStyle: string,
  fabricKey: string,
): ViewerLayer[] {
  // fabricKey is the fabricId (already underscores); replace just in case
  const fabricDir = fabricKey.replace(/-/g, '_');

  const rawLayers: ConfigLayer[] = [
    ...config.base,
    ...(config.lapels[lapelStyle]?.layers ?? []),
  ];

  // Show only the correct back panel and bottom hem for the selected breasted style.
  // double-6btn uses espalda+double_breasted; single-4/5btn uses espalda+single_breasted.
  // The bottom_single_breasted hem layer has no double-breasted equivalent, so hide it for DB.
  const filteredLayers = rawLayers.filter(layer => {
    const filename = layer.path.split('/').pop() ?? '';
    if (stylePrefix === 'double-6btn') {
      if (filename.includes('bottom_single_breasted')) return false;
      if (filename.includes('espalda+single_breasted')) return false;
    } else {
      if (filename.includes('espalda+double_breasted')) return false;
      if (filename.includes('bottom_double_breasted')) return false;
    }
    return true;
  });

  filteredLayers.sort((a, b) => a.z - b.z);

  const result: ViewerLayer[] = [];
  for (const layer of filteredLayers) {
    const filename = layer.path.split('/').pop() ?? '';
    const relativePath = layer.path.replace(/^vest\//, '');
    const templateSrc = `/assets/vest/${relativePath}`;
    if (layer.fabric) {
      if (!fabricKey) continue;
      result.push({
        key: layer.path,
        z: layer.z,
        src: generatedLayerUrl('vest', fabricDir, filename, FABRIC_ASSET_VERSION),
        fallbackSrc: templateSrc,
      });
    } else {
      result.push({ key: layer.path, z: layer.z, src: templateSrc });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VestConfiguratorProps {
  value: VestConfig;
  onChange: (config: VestConfig) => void;
  readOnly?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only';
  showUpload?: boolean;
  viewerBackground?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VestConfigurator({
  value,
  onChange,
  readOnly = false,
  mode = 'full',
  viewerBackground,
}: VestConfiguratorProps) {
  const [vestConfig, setVestConfig] = useState<VestConfigJson | null>(null);
  const [fabrics, setFabrics] = useState<FabricResponse[]>([]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialValueRef = useRef(value);

  useEffect(() => {
    fetch('/assets/vest/vest_config.json')
      .then((r) => {
        if (!r.ok) throw new Error('vest_config yüklenemedi');
        return r.json() as Promise<VestConfigJson>;
      })
      .then(setVestConfig)
      .catch(() => {});
  }, []);

  useEffect(() => {
    getFabrics('JACKET')
      .then((data) => {
        setFabrics(data);
        if (data.length > 0 && !initialValueRef.current.fabricKey) {
          const first = data[0];
          onChangeRef.current({
            ...initialValueRef.current,
            fabricKey: first.fabricId,
            fabricLabel: first.name,
          });
        }
      })
      .catch(() => {});
  }, []);

  const layers = useMemo<ViewerLayer[]>(() => {
    if (!vestConfig) return [];
    return buildLayers(vestConfig, value.stylePrefix, vestLapelKey(value), value.fabricKey);
  }, [vestConfig, value.stylePrefix, value.lapelWidth, value.lapelShape, value.fabricKey]);

  const effectiveFabricKey = value.fabricKey || fabrics[0]?.fabricId || '';
  const viewerImageUrls = useMemo(() => layers.map((layer) => layer.src), [layers]);
  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const backgroundPreloadUrls = useMemo(() => {
    if (!vestConfig) return [];
    return fabrics
      .map((fabric) => fabric.fabricId)
      .filter((fabricId) => fabricId && fabricId !== effectiveFabricKey)
      .slice(0, 6)
      .flatMap((fabricId) => (
        buildLayers(vestConfig, value.stylePrefix, vestLapelKey(value), fabricId)
          .filter((layer) => layer.src.includes('/generated/'))
          .sort((a, b) => a.z - b.z)
          .map((layer) => layer.src)
      ));
  }, [effectiveFabricKey, fabrics, value, vestConfig]);
  useBackgroundImagePreload(backgroundPreloadUrls);

  // ---------------------------------------------------------------------------
  // Reusable JSX blocks
  // ---------------------------------------------------------------------------

  const fabricBar = fabrics.length > 0 ? (
    <div className="jc-fabricBar">
      <span className="jc-fabricBarLabel">Kumaş</span>
      <div className="jc-fabricCards">
        {fabrics.map((fabric) => (
          <button
            key={fabric.fabricId}
            type="button"
            className={fabric.fabricId === effectiveFabricKey ? 'jc-fabricCard active' : 'jc-fabricCard'}
            onClick={() => onChange({ ...value, fabricKey: fabric.fabricId, fabricLabel: fabric.name })}
            disabled={readOnly}
          >
            <div className="jc-fabricSwatch">
              {fabric.swatchUrl ? (
                <img
                  src={fabric.swatchUrl}
                  alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="jc-fabricSwatchFallback" />
              )}
            </div>
            <div className="jc-fabricInfo">
              <span className="jc-fabricLabel">{fabric.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // All Vest selectors here drive visual layer composition (vestLapelKey).
  // No data-only fields on Vest — only restyle the input UI.
  const styleOptions: IconChoiceOption<VestStylePrefix>[] = STYLE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: VEST_STYLE_ICONS[opt.value],
  }));
  const widthOptions: IconChoiceOption<VestLapelWidth>[] = WIDTH_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: undefined,
    fallback: <span className="icon-choice-card-placeholder">{opt.label.slice(0, 2)}</span>,
  }));
  const shapeOptions: IconChoiceOption<VestLapelShape>[] = SHAPE_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
    iconSrc: VEST_LAPEL_SHAPE_ICONS[opt.value],
  }));

  const styleBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<VestStylePrefix>
        label="Stil"
        value={value.stylePrefix}
        options={styleOptions}
        onChange={(next) => onChange({ ...value, stylePrefix: next })}
        disabled={readOnly}
      />
      {value.lapelShape !== 'shawl' && value.lapelShape !== 'no' && (
        <IconChoiceGroup<VestLapelWidth>
          label="Yaka Genişliği"
          value={value.lapelWidth}
          options={widthOptions}
          onChange={(next) => onChange({ ...value, lapelWidth: next })}
          disabled={readOnly}
        />
      )}
      <IconChoiceGroup<VestLapelShape>
        label="Yaka"
        value={value.lapelShape}
        options={shapeOptions}
        onChange={(next) => onChange({ ...value, lapelShape: next })}
        disabled={readOnly}
      />
    </div>
  );

  const viewerInner = (
    <div className="jc-viewer">
      {layers.map((layer) => (
        <img
          key={layer.key}
          src={layer.src}
          alt=""
          className="jc-layer"
          style={{ zIndex: layer.z }}
          draggable={false}
          onError={(e) => {
            const img = e.currentTarget as HTMLImageElement;
            if (layer.fallbackSrc && !img.dataset.fellBack) {
              img.dataset.fellBack = '1';
              img.src = layer.fallbackSrc;
            } else {
              img.style.display = 'none';
            }
          }}
        />
      ))}
      <PremiumViewerLoader active={viewerLoading} />
    </div>
  );

  // ---------------------------------------------------------------------------
  // Mode-specific renders
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
    return (
      <ConfiguratorAccordion
        sections={[
          { key: 'fabric', title: 'Kumaş', content: fabricBar },
          { key: 'style', title: 'Stil', content: styleBar },
        ]}
      />
    );
  }

  // mode === 'full'
  return (
    <div className="jc-root">
      {fabricBar}
      {styleBar}
      <div className="jc-viewerCard">{viewerInner}</div>
    </div>
  );
}
