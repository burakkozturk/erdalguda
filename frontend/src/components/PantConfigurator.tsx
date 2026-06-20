import { useEffect, useMemo, useRef, useState } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
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
  PANT_DRAPE_ICONS,
  PANT_FASTENING_ICONS,
  PANT_FIT_ICONS,
  PANT_LEG_STYLE_ICONS,
  PANT_PLEAT_ICONS,
} from '../data/configuratorIcons';
import {
  PANT_DRAPE_LABELS,
  PANT_FASTENING_LABELS,
  PANT_FIT_LABELS,
  PANT_LEG_STYLE_LABELS,
  PANT_PLEAT_LABELS,
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

const FASTENING_LABELS: Record<PantFasteningStyle, string> = {
  centered: PANT_FASTENING_LABELS.centered,
  'no-button': PANT_FASTENING_LABELS['no-button'],
  'off-centered': PANT_FASTENING_LABELS['off-centered'],
  'off-centered-buttonless': PANT_FASTENING_LABELS['off-centered-buttonless'],
};

const PLEAT_LABELS: Record<PantPleatStyle, string> = {
  none: PANT_PLEAT_LABELS.none,
  'single-pleated': PANT_PLEAT_LABELS['single-pleated'],
  'double-pleated': PANT_PLEAT_LABELS['double-pleated'],
};

// ---------------------------------------------------------------------------
// Config shapes from /api/pants/config
// ---------------------------------------------------------------------------

interface ConfigLayer {
  path: string;
  z: number;
  fabric: boolean;
  rotation?: number;
  zones?: unknown[] | null;
}

interface PantConfigJson {
  base: ConfigLayer[];
  fastenings: Record<string, { layers: ConfigLayer[] }>;
  pleats: Record<string, { layers: ConfigLayer[] }>;
}

interface ViewerLayer {
  key: string;
  z: number;
  src: string;
}

// ---------------------------------------------------------------------------
// Layer resolution
// ---------------------------------------------------------------------------

function buildLayers(
  config: PantConfigJson,
  fasteningStyle: string,
  pleatStyle: string,
  fabricKey: string,
): ViewerLayer[] {
  const fabricDir = fabricKey.replace(/-/g, '_');

  const rawLayers: ConfigLayer[] = [
    ...config.base,
    ...(config.fastenings[fasteningStyle]?.layers ?? []),
    ...(config.pleats[pleatStyle]?.layers ?? []),
  ];

  // UI filters (config kept intact so standalone pipeline still produces them):
  //  - zapatos: decorative shoe layer, hidden in configurator
  //  - all z=30 layers: dark silhouette/positioning masks (base body mask + fastening masks)
  const filteredLayers = rawLayers.filter((layer) => {
    const filename = layer.path.split('/').pop() ?? '';
    if (filename.includes('zapatos')) return false;
    if (layer.z === 30) return false;
    return true;
  });

  filteredLayers.sort((a, b) => a.z - b.z);

  const result: ViewerLayer[] = [];
  for (const layer of filteredLayers) {
    const filename = layer.path.split('/').pop() ?? '';
    if (layer.fabric) {
      if (!fabricKey) continue;
      result.push({
        key: layer.path,
        z: layer.z,
        src: generatedLayerUrl('pant', fabricDir, filename, FABRIC_ASSET_VERSION),
      });
    } else {
      // Static: /assets/pant/{path-without-leading-"pants/"}
      const relativePath = layer.path.replace(/^pants\//, '');
      result.push({ key: layer.path, z: layer.z, src: `/assets/pant/${relativePath}` });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PantConfiguratorProps {
  value: PantConfig;
  onChange: (config: PantConfig) => void;
  readOnly?: boolean;
  mode?: 'full' | 'viewer-only' | 'controls-only';
  showUpload?: boolean;
  viewerBackground?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PantConfigurator({
  value,
  onChange,
  readOnly = false,
  mode = 'full',
  viewerBackground,
}: PantConfiguratorProps) {
  const [pantConfig, setPantConfig] = useState<PantConfigJson | null>(null);
  const [fabrics, setFabrics] = useState<FabricResponse[]>([]);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialValueRef = useRef(value);

  useEffect(() => {
    fetch('/api/pants/config')
      .then((r) => {
        if (!r.ok) throw new Error('pant_config yüklenemedi');
        return r.json() as Promise<PantConfigJson>;
      })
      .then(setPantConfig)
      .catch(console.error);
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
      .catch(console.error);
  }, []);

  const layers = useMemo<ViewerLayer[]>(() => {
    if (!pantConfig) return [];
    return buildLayers(pantConfig, value.fasteningStyle, value.pleatStyle, value.fabricKey);
  }, [pantConfig, value.fasteningStyle, value.pleatStyle, value.fabricKey]);

  const fasteningStyles = Object.keys(FASTENING_LABELS) as PantFasteningStyle[];
  const pleatStyles = Object.keys(PLEAT_LABELS) as PantPleatStyle[];
  const effectiveFabricKey = value.fabricKey || fabrics[0]?.fabricId || '';
  const viewerImageUrls = useMemo(() => layers.map((layer) => layer.src), [layers]);
  const viewerLoading = useViewerImageLoading(viewerImageUrls);

  const backgroundPreloadUrls = useMemo(() => {
    if (!pantConfig) return [];
    return fabrics
      .map((fabric) => fabric.fabricId)
      .filter((fabricId) => fabricId && fabricId !== effectiveFabricKey)
      .slice(0, 6)
      .flatMap((fabricId) => (
        buildLayers(pantConfig, value.fasteningStyle, value.pleatStyle, fabricId)
          .filter((layer) => layer.src.includes('/generated/'))
          .sort((a, b) => a.z - b.z)
          .map((layer) => layer.src)
      ));
  }, [effectiveFabricKey, fabrics, pantConfig, value.fasteningStyle, value.pleatStyle]);
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

  // Icon-card option lists. fasteningStyle and pleatStyle drive layer
  // composition (see buildLayers above); fit/legStyle/drape are data-only.
  const fasteningOptions: IconChoiceOption<PantFasteningStyle>[] = fasteningStyles.map((style) => ({
    value: style,
    label: FASTENING_LABELS[style],
    iconSrc: PANT_FASTENING_ICONS[style],
  }));
  const pleatOptions: IconChoiceOption<PantPleatStyle>[] = pleatStyles.map((style) => ({
    value: style,
    label: PLEAT_LABELS[style],
    iconSrc: PANT_PLEAT_ICONS[style],
  }));

  // Data-only features below (no visual effect on the rendered PNG stack).
  const fitValue: PantFit = (value.fit as PantFit | undefined) ?? 'normal';
  const legValue: PantLegStyle = (value.legStyle as PantLegStyle | undefined) ?? 'straight';
  const drapeValue: PantDrape = (value.drape as PantDrape | undefined) ?? 'none';

  const fitOptions: IconChoiceOption<PantFit>[] = [
    { value: 'slim',   label: PANT_FIT_LABELS.slim,   iconSrc: PANT_FIT_ICONS.slim   },
    { value: 'normal', label: PANT_FIT_LABELS.normal, iconSrc: PANT_FIT_ICONS.normal },
  ];
  const legOptions: IconChoiceOption<PantLegStyle>[] = [
    { value: 'straight', label: PANT_LEG_STYLE_LABELS.straight, iconSrc: PANT_LEG_STYLE_ICONS.straight },
    { value: 'cuffed',   label: PANT_LEG_STYLE_LABELS.cuffed,   iconSrc: PANT_LEG_STYLE_ICONS.cuffed   },
  ];
  const drapeOptions: IconChoiceOption<PantDrape>[] = [
    { value: 'none',  label: PANT_DRAPE_LABELS.none,  iconSrc: PANT_DRAPE_ICONS.none  },
    { value: 'light', label: PANT_DRAPE_LABELS.light, iconSrc: PANT_DRAPE_ICONS.light },
    { value: 'full',  label: PANT_DRAPE_LABELS.full,  iconSrc: PANT_DRAPE_ICONS.full  },
  ];

  const styleBar = (
    <div className="icon-choice-stack">
      <IconChoiceGroup<PantFasteningStyle>
        label="Kapama Stili"
        value={value.fasteningStyle}
        options={fasteningOptions}
        onChange={(next) => onChange({ ...value, fasteningStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantPleatStyle>
        label="Pile Stili"
        value={value.pleatStyle}
        options={pleatOptions}
        onChange={(next) => onChange({ ...value, pleatStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantFit>
        label="Kesim"
        value={fitValue}
        options={fitOptions}
        onChange={(next) => onChange({ ...value, fit: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantLegStyle>
        label="Paça"
        value={legValue}
        options={legOptions}
        onChange={(next) => onChange({ ...value, legStyle: next })}
        disabled={readOnly}
      />
      <IconChoiceGroup<PantDrape>
        label="Pantolon Dökümü"
        value={drapeValue}
        options={drapeOptions}
        onChange={(next) => onChange({ ...value, drape: next })}
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
          onError={() => console.error('Pantolon katmanı yüklenemedi:', layer.src)}
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
