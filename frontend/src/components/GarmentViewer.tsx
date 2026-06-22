/**
 * GarmentViewer — read-only garment render for the public QR scan page.
 *
 * State machine:
 *   configState: 'loading' → 'ready'   (success)
 *              : 'loading' → 'retrying' → 'ready'   (success after retry)
 *              : 'loading' → 'retrying' → 'error'   (all retries exhausted)
 *
 * On terminal error the component NEVER returns null — it renders the swatch
 * thumbnail as a fallback so the hero area is never a blank gray box.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { generatedLayerUrl } from '../data/assetUrls';
import type { RenderHint } from '../api/scanApi';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface ConfigLayer {
  path: string;
  z: number;
  fabric: boolean;
}

interface ViewerLayer {
  key: string;
  z: number;
  src: string;
  multiply?: boolean;
}

interface PantConfig {
  base: ConfigLayer[];
  fastenings: Record<string, { layers: ConfigLayer[] }>;
  pleats: Record<string, { layers: ConfigLayer[] }>;
}

interface ShirtConfig {
  base: ConfigLayer[];
  collars: Record<string, { buttons: Record<string, ConfigLayer[]> }>;
  cuffs: Record<string, { layers: ConfigLayer[] }>;
}

interface VestConfig {
  base: ConfigLayer[];
  lapels: Record<string, { layers: ConfigLayer[] }>;
}

type GarmentConfig = PantConfig | ShirtConfig | VestConfig;

type ConfigState = 'loading' | 'retrying' | 'ready' | 'error';

// ---------------------------------------------------------------------------
// Config fetch
// ---------------------------------------------------------------------------

const CONFIG_ENDPOINTS: Record<string, string> = {
  pant:  '/assets/pant/pant_config.json',
  shirt: '/assets/shirts/shirt_config.json',
  vest:  '/assets/vest/vest_config.json',
};

const FABRIC_VERSION = 4;
const MAX_RETRIES = 3;

async function fetchConfig(garmentType: string): Promise<GarmentConfig> {
  const url = CONFIG_ENDPOINTS[garmentType];
  if (!url) throw new Error(`Unknown garment type: ${garmentType}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<GarmentConfig>;
}

// ---------------------------------------------------------------------------
// Layer builders
// ---------------------------------------------------------------------------

function buildPantLayers(config: PantConfig, fabricKey: string, styleKeys: Record<string, string>): ViewerLayer[] {
  const fasteningStyle = styleKeys['fasteningStyle'] ?? 'centered';
  const pleatStyle     = styleKeys['pleatStyle'] ?? 'none';
  const fabricDir      = fabricKey.replace(/-/g, '_');

  return [
    ...config.base,
    ...(config.fastenings[fasteningStyle]?.layers ?? []),
    ...(config.pleats[pleatStyle]?.layers ?? []),
  ]
    .filter((l) => {
      const f = l.path.split('/').pop() ?? '';
      return !f.includes('zapatos');
    })
    .sort((a, b) => a.z - b.z)
    .flatMap((l): ViewerLayer[] => {
      const file = l.path.split('/').pop() ?? '';
      if (l.fabric) {
        if (!fabricKey) return [];
        return [{ key: l.path, z: l.z, src: generatedLayerUrl('pant', fabricDir, file, FABRIC_VERSION) }];
      }
      return [{ key: l.path, z: l.z, src: `/assets/pant/${l.path.replace(/^pants\//, '')}` }];
    });
}

function buildShirtLayers(config: ShirtConfig, fabricKey: string, styleKeys: Record<string, string>): ViewerLayer[] {
  const collarStyle   = styleKeys['collarStyle'] ?? 'cutaway';
  const collarButtons = (styleKeys['collarButtons'] ?? '1') as '1' | '2';
  const cuffStyle     = styleKeys['cuffStyle'] ?? 'single';
  const fabricDir     = fabricKey.replace(/-/g, '_');

  return [
    ...config.base,
    ...(config.collars[collarStyle]?.buttons[collarButtons] ?? []),
    ...(config.cuffs[cuffStyle]?.layers ?? []),
  ]
    .sort((a, b) => a.z - b.z)
    .flatMap((l): ViewerLayer[] => {
      const file = l.path.split('/').pop() ?? '';
      const isShadow = file.includes('sombra');
      if (l.fabric) {
        if (!fabricKey) return [];
        return [{ key: l.path, z: l.z, src: generatedLayerUrl('shirts', fabricDir, file, FABRIC_VERSION) }];
      }
      return [{ key: l.path, z: l.z, src: `/assets/shirts/${l.path.replace(/^shirts\//, '')}`, multiply: isShadow }];
    });
}

function buildVestLayers(config: VestConfig, fabricKey: string, styleKeys: Record<string, string>): ViewerLayer[] {
  const stylePrefix = styleKeys['stylePrefix'] ?? 'single-4btn';
  const lapelStyle  = styleKeys['lapelStyle'] ?? 'notch';
  const fabricDir   = fabricKey.replace(/-/g, '_');

  return [
    ...config.base,
    ...(config.lapels[lapelStyle]?.layers ?? []),
  ]
    .filter((l) => {
      const f = l.path.split('/').pop() ?? '';
      if (stylePrefix === 'double-6btn') {
        return !f.includes('bottom_single_breasted') && !f.includes('espalda+single_breasted');
      }
      return !f.includes('espalda+double_breasted') && !f.includes('bottom_double_breasted');
    })
    .sort((a, b) => a.z - b.z)
    .flatMap((l): ViewerLayer[] => {
      const file = l.path.split('/').pop() ?? '';
      if (l.fabric) {
        if (!fabricKey) return [];
        return [{ key: l.path, z: l.z, src: generatedLayerUrl('vest', fabricDir, file, FABRIC_VERSION) }];
      }
      return [{ key: l.path, z: l.z, src: `/assets/vest/${l.path.replace(/^vest\//, '')}` }];
    });
}

function resolveLayersFromConfig(garmentType: string, config: GarmentConfig, fabricKey: string, styleKeys: Record<string, string>): ViewerLayer[] {
  switch (garmentType) {
    case 'pant':  return buildPantLayers(config as PantConfig, fabricKey, styleKeys);
    case 'shirt': return buildShirtLayers(config as ShirtConfig, fabricKey, styleKeys);
    case 'vest':  return buildVestLayers(config as VestConfig, fabricKey, styleKeys);
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ViewerStatus = 'loading' | 'ready' | 'error';

interface GarmentViewerProps {
  hint: RenderHint;
  swatchUrl?: string | null;
  height?: string;
  onStatusChange?: (status: ViewerStatus) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GarmentViewer({ hint, swatchUrl, height = '420px', onStatusChange }: GarmentViewerProps) {
  const [config, setConfig]           = useState<GarmentConfig | null>(null);
  const [configState, setConfigState] = useState<ConfigState>('loading');
  const [retryCount, setRetryCount]   = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(0);
  const [imagesTotal, setImagesTotal]   = useState(0);

  // Keep onStatusChange stable across renders
  const onStatusRef = useRef(onStatusChange);
  useEffect(() => { onStatusRef.current = onStatusChange; });

  // ── Config fetch with exponential-backoff retry ─────────────────────────
  useEffect(() => {
    let cancelled = false;

    function attempt(retryNum: number) {
      if (retryNum > 0) setConfigState('retrying');
      else              setConfigState('loading');

      fetchConfig(hint.garmentType)
        .then((cfg) => {
          if (cancelled) return;
          setConfig(cfg);
          setConfigState('ready');
          onStatusRef.current?.('ready');
        })
        .catch(() => {
          if (cancelled) return;
          if (retryNum < MAX_RETRIES) {
            // 1.5 s → 3 s → 6 s
            const delay = Math.pow(2, retryNum) * 1500;
            setTimeout(() => {
              if (!cancelled) {
                setRetryCount(retryNum + 1);
                attempt(retryNum + 1);
              }
            }, delay);
          } else {
            setConfigState('error');
            onStatusRef.current?.('error');
          }
        });
    }

    setConfig(null);
    setConfigState('loading');
    setRetryCount(0);
    attempt(0);

    return () => { cancelled = true; };
  }, [hint.garmentType, hint.fabricKey]);

  // ── Layer resolution ─────────────────────────────────────────────────────
  const layers = useMemo<ViewerLayer[]>(() => {
    if (!config || configState !== 'ready') return [];
    return resolveLayersFromConfig(hint.garmentType, config, hint.fabricKey, hint.styleKeys);
  }, [config, configState, hint]);

  useEffect(() => {
    setImagesLoaded(0);
    setImagesTotal(layers.length);
  }, [layers]);

  const layersStillLoading = imagesTotal > 0 && imagesLoaded < imagesTotal;
  const showShimmer = configState === 'loading' || configState === 'retrying' || layersStillLoading;

  // ── Terminal error → render swatch fallback (NEVER return null) ──────────
  if (configState === 'error') {
    return (
      <div style={containerStyle(height)}>
        {swatchUrl ? (
          <img
            src={swatchUrl}
            alt="Kumaş"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              // If swatch also fails, show branded placeholder
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        ) : (
          <FallbackPlaceholder />
        )}
        <style>{VIEWER_CSS}</style>
      </div>
    );
  }

  // ── Normal render ────────────────────────────────────────────────────────
  return (
    <div style={containerStyle(height)}>
      {/* Layer stack */}
      <div
        style={{
          position: 'relative',
          height: '100%',
          aspectRatio: '3 / 4',
          maxWidth: '100%',
          isolation: 'isolate',
        }}
      >
        {layers.map((layer) => (
          <img
            key={layer.key}
            src={layer.src}
            alt=""
            draggable={false}
            onLoad={() => setImagesLoaded((n) => n + 1)}
            onError={() => setImagesLoaded((n) => n + 1)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'none',
              zIndex: layer.z,
              mixBlendMode: layer.multiply ? 'multiply' : 'normal',
              opacity: showShimmer ? 0 : 1,
              transition: 'opacity 0.4s ease',
            }}
          />
        ))}

        {/* Shimmer + scissors spinner while loading / retrying */}
        {showShimmer && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'linear-gradient(110deg, #EDEBE6 25%, #F5F4F0 50%, #EDEBE6 75%)',
              backgroundSize: '300% 100%',
              animation: 'eg-shimmer 1.6s ease-in-out infinite',
            }}
          >
            <span style={{ fontSize: 26, animation: 'eg-spin 2s linear infinite', display: 'inline-block' }}>✂</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#aaa' }}>
              {configState === 'retrying' ? `Yeniden deneniyor… (${retryCount}/${MAX_RETRIES})` : 'Hazırlanıyor'}
            </span>
          </div>
        )}
      </div>

      {/* Swatch thumbnail — only when fully loaded */}
      {swatchUrl && !showShimmer && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            right: 14,
            width: 52,
            height: 52,
            borderRadius: 10,
            overflow: 'hidden',
            border: '2.5px solid rgba(255,255,255,0.9)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.20)',
            background: '#ddd',
          }}
        >
          <img
            src={swatchUrl}
            alt="Kumaş"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none'; }}
          />
        </div>
      )}

      <style>{VIEWER_CSS}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function containerStyle(height: string): React.CSSProperties {
  return {
    position: 'relative',
    width: '100%',
    height,
    background: '#F5F4F0',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

function FallbackPlaceholder() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      height: '100%',
    }}>
      <span style={{ fontSize: 32, opacity: 0.2 }}>✂</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ccc' }}>
        Görsel yüklenemedi
      </span>
    </div>
  );
}

const VIEWER_CSS = `
  @keyframes eg-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes eg-spin {
    to { transform: rotate(360deg); }
  }
`;
