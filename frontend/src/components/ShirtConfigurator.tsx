import { useEffect, useMemo, useRef, useState } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type { ShirtConfig, ShirtFit } from '../types/shirt';
import { ConfiguratorAccordion } from './ConfiguratorAccordion';
import { IconChoiceGroup, type IconChoiceOption } from './IconChoiceCard';
import {
  SHIRT_COLLAR_ICONS,
  SHIRT_CUFF_ICONS,
  SHIRT_FIT_ICONS,
} from '../data/configuratorIcons';
import {
  SHIRT_COLLAR_LABELS,
  SHIRT_CUFF_LABELS,
  SHIRT_FIT_LABELS,
} from '../data/configuratorLabels';
import { generatedLayerUrl } from '../data/assetUrls';
import {
  useBackgroundImagePreload,
  useViewerImageLoading,
} from '../hooks/useConfiguratorImageLoading';
import './JacketConfigurator.css';
import PremiumViewerLoader from './PremiumViewerLoader';

// ---------------------------------------------------------------------------
// Display names (Turkish)
// ---------------------------------------------------------------------------

const COLLAR_LABELS: Record<string, string> = {
  ...SHIRT_COLLAR_LABELS,
};

const CUFF_LABELS: Record<string, string> = {
  ...SHIRT_CUFF_LABELS,
};

const FABRIC_ASSET_VERSION = 4;

// ---------------------------------------------------------------------------
// Config shapes from /api/shirts/config
// ---------------------------------------------------------------------------

interface ConfigLayer {
  path: string;
  z: number;
  fabric: boolean;
  rotation?: number;
  zones?: unknown[] | null;
}

interface ShirtConfigJson {
  base: ConfigLayer[];
  collars: Record<string, {
    label: string;
    buttons: Record<string, ConfigLayer[]>;
  }>;
  cuffs: Record<string, {
    layers: ConfigLayer[];
  }>;
}

interface ViewerLayer {
  key: string;
  z: number;
  src: string;
  isShadow?: boolean;
}

// ---------------------------------------------------------------------------
// Layer resolution
// ---------------------------------------------------------------------------

function buildLayers(
  config: ShirtConfigJson,
  collarStyle: string,
  collarButtons: '1' | '2',
  cuffStyle: string,
  fabricKey: string,
): ViewerLayer[] {
  // fabricKey uses hyphens ("custom-my-fabric"); Python output dir uses underscores.
  const fabricDir = fabricKey.replace(/-/g, '_');

  const rawLayers: ConfigLayer[] = [
    ...config.base,
    ...(config.collars[collarStyle]?.buttons[collarButtons] ?? []),
    ...(config.cuffs[cuffStyle]?.layers ?? []),
  ];

  rawLayers.sort((a, b) => a.z - b.z);

  const result: ViewerLayer[] = [];
  for (const layer of rawLayers) {
    const filename = layer.path.split('/').pop() ?? '';
    // The `sombra` (studio drop-shadow) base PNG is rendered on a white
    // canvas, so against a dark background its off-white halo reads as a
    // glow around the shirt.  We still keep it — but flag it so the
    // component can render it with mix-blend-mode: multiply: white pixels
    // disappear on any background, while the dark studio shadow survives
    // on light backgrounds.
    const isShadow = filename.includes('sombra');
    if (layer.fabric) {
      if (!fabricKey) continue;
      result.push({
        key: layer.path,
        z: layer.z,
        src: generatedLayerUrl('shirts', fabricDir, filename, FABRIC_ASSET_VERSION),
        isShadow,
      });
    } else {
      // Strip leading "shirts/" from path to get the subfolder-relative path.
      const relativePath = layer.path.replace(/^shirts\//, '');
      result.push({
        key: layer.path,
        z: layer.z,
        src: `/assets/shirts/${relativePath}`,
        isShadow,
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShirtConfiguratorProps {
  value: ShirtConfig;
  onChange: (config: ShirtConfig) => void;
  readOnly?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only' | 'controls-all';
  activeTab?: 'fabric' | 'collar' | 'cuff';
  showUpload?: boolean;
  viewerBackground?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ShirtConfigurator({
  value,
  onChange,
  readOnly = false,
  mode = 'full',
  activeTab = 'fabric',
  viewerBackground,
}: ShirtConfiguratorProps) {
  const [shirtConfig, setShirtConfig] = useState<ShirtConfigJson | null>(null);
  const [fabrics, setFabrics] = useState<FabricResponse[]>([]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialValueRef = useRef(value);

  useEffect(() => {
    fetch('/api/shirts/config')
      .then((r) => {
        if (!r.ok) throw new Error('shirt_config yüklenemedi');
        return r.json() as Promise<ShirtConfigJson>;
      })
      .then(setShirtConfig)
      .catch(console.error);
  }, []);

  useEffect(() => {
    getFabrics('SHIRT')
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

  const layers = useMemo(() => {
    if (!shirtConfig) return [];
    return buildLayers(
      shirtConfig,
      value.collarStyle,
      value.collarButtons,
      value.cuffStyle,
      value.fabricKey,
    );
  }, [shirtConfig, value.collarStyle, value.collarButtons, value.cuffStyle, value.fabricKey]);

  const collarStyles = shirtConfig ? Object.keys(shirtConfig.collars) : [];
  const cuffStyles = shirtConfig
    ? Object.keys(shirtConfig.cuffs).filter((k) => !k.startsWith('_'))
    : [];

  const effectiveFabricKey = value.fabricKey || fabrics[0]?.key || '';
  const viewerImageUrls = useMemo(() => layers.map((layer) => layer.src), [layers]);
  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const backgroundPreloadUrls = useMemo(() => {
    if (!shirtConfig) return [];
    return fabrics
      .map((fabric) => fabric.key)
      .filter((fabricKey) => fabricKey && fabricKey !== effectiveFabricKey)
      .slice(0, 6)
      .flatMap((fabricKey) => (
        buildLayers(
          shirtConfig,
          value.collarStyle,
          value.collarButtons,
          value.cuffStyle,
          fabricKey,
        )
          .filter((layer) => layer.src.includes('/generated/'))
          .sort((a, b) => a.z - b.z)
          .map((layer) => layer.src)
      ));
  }, [
    effectiveFabricKey,
    fabrics,
    shirtConfig,
    value.collarButtons,
    value.collarStyle,
    value.cuffStyle,
  ]);
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
            key={fabric.key}
            type="button"
            className={fabric.key === effectiveFabricKey ? 'jc-fabricCard active' : 'jc-fabricCard'}
            onClick={() => onChange({ ...value, fabricKey: fabric.key, fabricLabel: fabric.name })}
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

  // Icon-card option lists. Note: collarStyle/cuffStyle drive visual layer
  // composition (see buildLayers above) — we ONLY restyle the inputs.
  const collarOptions: IconChoiceOption<string>[] = collarStyles.map((style) => ({
    value: style,
    label: COLLAR_LABELS[style] ?? style,
    iconSrc: SHIRT_COLLAR_ICONS[style],
  }));
  const cuffOptions: IconChoiceOption<string>[] = cuffStyles.map((style) => ({
    value: style,
    label: CUFF_LABELS[style] ?? style,
    iconSrc: SHIRT_CUFF_ICONS[style],
  }));
  const collarButtonOptions: IconChoiceOption<'1' | '2'>[] = [
    { value: '1', label: '1 Düğme', iconSrc: undefined, fallback: <span className="icon-choice-card-placeholder">1</span> },
    { value: '2', label: '2 Düğme', iconSrc: undefined, fallback: <span className="icon-choice-card-placeholder">2</span> },
  ];

  // Data-only Fit (no visual effect).
  const fitValue: ShirtFit = (value.fit as ShirtFit | undefined) ?? 'normal';
  const fitOptions: IconChoiceOption<ShirtFit>[] = [
    { value: 'slim',   label: SHIRT_FIT_LABELS.slim,   iconSrc: SHIRT_FIT_ICONS.slim   },
    { value: 'normal', label: SHIRT_FIT_LABELS.normal, iconSrc: SHIRT_FIT_ICONS.normal },
  ];

  const collarBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<string>
        label="Yaka Stili"
        value={value.collarStyle}
        options={collarOptions}
        onChange={(next) => onChange({ ...value, collarStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<'1' | '2'>
        label="Düğme Sayısı"
        value={value.collarButtons}
        options={collarButtonOptions}
        onChange={(next) => onChange({ ...value, collarButtons: next })}
        disabled={readOnly}
      />
    </div>
  );

  const cuffBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<string>
        label="Manşet Stili"
        value={value.cuffStyle}
        options={cuffOptions}
        onChange={(next) => onChange({ ...value, cuffStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<ShirtFit>
        label="Kesim"
        value={fitValue}
        options={fitOptions}
        onChange={(next) => onChange({ ...value, fit: next })}
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
          style={{
            zIndex: layer.z,
            // Studio shadow PNG ships with a white canvas — multiply makes
            // the white pixels invisible on dark backgrounds (white × dark
            // = dark, so the halo disappears) while the actual shadow
            // pixels still subtract light on lighter backdrops.
            mixBlendMode: layer.isShadow ? 'multiply' : undefined,
          }}
          draggable={false}
          onError={() => console.error('Gömlek katmanı yüklenemedi:', layer.src)}
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
    if (activeTab === 'fabric') return <div className="jc-root">{fabricBar}</div>;
    if (activeTab === 'collar') return <div className="jc-root">{collarBar}</div>;
    return <div className="jc-root">{cuffBar}</div>;
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
                {collarBar}
                {cuffBar}
              </>
            ),
          },
        ]}
      />
    );
  }

  // mode === 'full'
  return (
    <div className="jc-root">
      {fabricBar}
      {collarBar}
      {cuffBar}
      <div className="jc-viewerCard">{viewerInner}</div>
    </div>
  );
}
