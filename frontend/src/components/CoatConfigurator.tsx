import { useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { getFabrics } from '../api/fabricApi';
import type { FabricResponse } from '../api/fabricApi';
import type {
  CoatConfig,
  CoatFastening,
  CoatLapelLength,
  CoatLapelStyle,
  CoatLapelWidth,
  CoatPocketStyle,
  CoatStyle,
} from '../types/coat';
import { COAT_STYLE_PARAMS } from '../types/coat';
import { ConfiguratorAccordion } from './ConfiguratorAccordion';
import CoatVisualizer, { type CoatConfigJSON } from './CoatVisualizer';
import './CoatConfigurator.css';
import './JacketConfigurator.css';

// ---------------------------------------------------------------------------
// SVG icons — coat styles
// ---------------------------------------------------------------------------

const OvercoatIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13 L4 42 L28 42 L28 13" />
    <path d="M11 6 L4 13 L9 21 L16 23 L23 21 L28 13 L21 6 L16 9 Z" />
    <path d="M9 21 L5 18" /><path d="M23 21 L27 18" />
    <line x1="16" y1="23" x2="16" y2="40" />
    <circle cx="16" cy="27" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="32" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="37" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const DoubleBreastedIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13 L3 42 L29 42 L29 13" />
    <path d="M9 5 L3 13 L9 22 L16 24 L23 22 L29 13 L23 5 L16 8 Z" />
    <line x1="16" y1="24" x2="16" y2="40" />
    <circle cx="12" cy="28" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="28" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="34" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="34" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="40" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="40" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const FunnelNeckIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22 L4 42 L28 42 L28 22" />
    <path d="M11 22 L9 14 L11 7 L16 5 L21 7 L23 14 L21 22 Z" />
    <line x1="16" y1="22" x2="16" y2="40" />
    <circle cx="16" cy="26" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="32" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="38" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const PeaCoatIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13 L3 35 L29 35 L29 13" />
    <path d="M9 5 L3 13 L9 22 L16 24 L23 22 L29 13 L23 5 L16 8 Z" />
    <line x1="16" y1="24" x2="16" y2="33" />
    <circle cx="12" cy="27" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="27" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="32" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="20" cy="32" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const DuffleCoatIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 22 L4 42 L28 42 L28 22" />
    <path d="M10 22 L9 13 L12 6 L16 4 L20 6 L23 13 L22 22 Z" />
    <line x1="16" y1="22" x2="16" y2="40" />
    <line x1="11" y1="27" x2="21" y2="27" /><ellipse cx="16" cy="27" rx="2.4" ry="1.5" />
    <line x1="11" y1="33" x2="21" y2="33" /><ellipse cx="16" cy="33" rx="2.4" ry="1.5" />
    <line x1="11" y1="39" x2="21" y2="39" /><ellipse cx="16" cy="39" rx="2.4" ry="1.5" />
  </svg>
);

// ---------------------------------------------------------------------------
// SVG icons — lapel styles
// ---------------------------------------------------------------------------

const NotchLapelIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 32 L3 16 L11 7 L16 13 L21 7 L29 16 L29 32" />
    <line x1="11" y1="7" x2="11" y2="18" /><line x1="11" y1="18" x2="6" y2="21" />
    <line x1="21" y1="7" x2="21" y2="18" /><line x1="21" y1="18" x2="26" y2="21" />
    <line x1="3" y1="32" x2="29" y2="32" />
  </svg>
);

const PeakLapelIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 32 L3 16 L10 7 L16 14 L22 7 L29 16 L29 32" />
    <path d="M10 7 L7 16 L3 12 L10 20" />
    <path d="M22 7 L25 16 L29 12 L22 20" />
    <line x1="3" y1="32" x2="29" y2="32" />
  </svg>
);

const RoundedLapelIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 32 L3 16 L11 7 L16 13 L21 7 L29 16 L29 32" />
    <path d="M11 7 Q3 16 5 22" />
    <path d="M21 7 Q29 16 27 22" />
    <line x1="3" y1="32" x2="29" y2="32" />
  </svg>
);

const UlsterLapelIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 32 L3 16 L9 6 L16 14 L23 6 L29 16 L29 32" />
    <path d="M9 6 L3 16 L3 22" />
    <path d="M23 6 L29 16 L29 22" />
    <line x1="3" y1="32" x2="29" y2="32" />
  </svg>
);

// ---------------------------------------------------------------------------
// SVG icons — lapel width
// ---------------------------------------------------------------------------

const LapelStandardIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10 L4 30 L28 30 L28 10" />
    <path d="M12 4 L4 10 L9 18 L16 20 L23 18 L28 10 L20 4 L16 7 Z" />
    <line x1="16" y1="20" x2="16" y2="28" />
  </svg>
);

const LapelWideIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10 L4 30 L28 30 L28 10" />
    <path d="M10 4 L4 10 L6 20 L16 22 L26 20 L28 10 L22 4 L16 7 Z" />
    <line x1="16" y1="22" x2="16" y2="28" />
  </svg>
);

// ---------------------------------------------------------------------------
// SVG icons — coat length
// ---------------------------------------------------------------------------

const LengthClassicIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12 L4 30 L28 30 L28 12" />
    <path d="M11 5 L4 12 L9 19 L16 21 L23 19 L28 12 L21 5 L16 8 Z" />
    <line x1="16" y1="21" x2="16" y2="28" />
    <circle cx="16" cy="24" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="28" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const LengthLongIcon = (
  <svg viewBox="0 0 32 44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12 L4 42 L28 42 L28 12" />
    <path d="M11 5 L4 12 L9 19 L16 21 L23 19 L28 12 L21 5 L16 8 Z" />
    <line x1="16" y1="21" x2="16" y2="40" />
    <circle cx="16" cy="25" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="30" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="35" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="40" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// ---------------------------------------------------------------------------
// SVG icons — fastening
// ---------------------------------------------------------------------------

const FasteningStandardIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="14" y="3" width="4" height="30" rx="2" />
    <circle cx="16" cy="9"  r="2.4" />
    <circle cx="16" cy="18" r="2.4" />
    <circle cx="16" cy="27" r="2.4" />
  </svg>
);

const FasteningHiddenIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="12" y="3" width="8" height="30" rx="2" />
    <line x1="16" y1="6" x2="16" y2="30" strokeDasharray="2.5 2.5" />
  </svg>
);

const TrenchFasteningIcon = (
  <svg viewBox="0 0 32 36" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13 L4 34 L28 34 L28 13" />
    <path d="M11 5 L4 13 L9 20 L16 22 L23 20 L28 13 L21 5 L16 8 Z" />
    <line x1="16" y1="22" x2="16" y2="32" />
    <line x1="6" y1="26" x2="26" y2="26" strokeWidth="2.2" />
    <rect x="14" y="23.5" width="4" height="5" rx="1.2" fill="currentColor" stroke="none" />
  </svg>
);

// ---------------------------------------------------------------------------
// SVG icons — pocket styles
// ---------------------------------------------------------------------------

const FlapPocketIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="7" y="17" width="18" height="11" rx="2" />
    <rect x="6" y="13" width="20" height="6" rx="2" />
  </svg>
);

const FlapThreePocketIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="18" width="15" height="10" rx="2" />
    <rect x="3" y="14" width="17" height="6" rx="2" />
    <rect x="21" y="3" width="8" height="9" rx="1.5" />
  </svg>
);

const DoubleWeltIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="11" width="20" height="4" rx="2" />
    <rect x="6" y="17" width="20" height="4" rx="2" />
  </svg>
);

const DoubleWeltThreeIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="13" width="17" height="3.5" rx="1.5" />
    <rect x="4" y="18" width="17" height="3.5" rx="1.5" />
    <rect x="22" y="3" width="7" height="9" rx="1.5" />
  </svg>
);

const DiagonalPocketIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22 L20 8 L26 14 L11 28 Z" />
    <line x1="5" y1="22" x2="20" y2="8" strokeWidth="2" />
  </svg>
);

const PatchedPocketIcon = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="5" width="20" height="22" rx="2" />
    <rect x="9" y="8" width="14" height="16" rx="1" strokeDasharray="2.5 2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Option data tables
// ---------------------------------------------------------------------------

const STYLE_OPTIONS: Array<{ value: CoatStyle; label: string; icon: ReactElement }> = [
  { value: 'overcoat',        label: 'Klasik Palto',     icon: OvercoatIcon       },
  { value: 'double_breasted', label: 'Kruvaze',          icon: DoubleBreastedIcon },
  { value: 'funnel_neck',     label: 'Dik Yakalı Palto', icon: FunnelNeckIcon     },
  { value: 'pea_coat',        label: 'Kısa Kruvaze',     icon: PeaCoatIcon        },
  { value: 'duffle_coat',     label: 'Duffle Palto',     icon: DuffleCoatIcon     },
];

const ALL_LAPEL_OPTIONS: Array<{ value: CoatLapelStyle; label: string; icon: ReactElement }> = [
  { value: 'notch',   label: 'Klasik Yaka',    icon: NotchLapelIcon   },
  { value: 'peak',    label: 'Kırlangıç Yaka', icon: PeakLapelIcon    },
  { value: 'rounded', label: 'Yuvarlak Yaka',  icon: RoundedLapelIcon },
  { value: 'ulster',  label: 'Ulster Yaka',    icon: UlsterLapelIcon  },
];

const WIDTH_OPTIONS: Array<{ value: CoatLapelWidth; label: string; icon: ReactElement }> = [
  { value: 'standard', label: 'Standart Yaka', icon: LapelStandardIcon },
  { value: 'wide',     label: 'Geniş Yaka',    icon: LapelWideIcon     },
];

const LENGTH_OPTIONS: Array<{ value: CoatLapelLength; label: string; icon: ReactElement }> = [
  { value: 'classic', label: 'Klasik Boy', icon: LengthClassicIcon },
  { value: 'long',    label: 'Uzun Boy',   icon: LengthLongIcon    },
];

const FASTENING_OPTIONS: Array<{ value: CoatFastening; label: string; icon: ReactElement }> = [
  { value: 'boton_standard', label: 'Düğmeli',       icon: FasteningStandardIcon },
  { value: 'boton_hide',     label: 'Gizli Düğmeli', icon: FasteningHiddenIcon   },
  { value: 'trench',         label: 'Trençkot',      icon: TrenchFasteningIcon   },
];

const POCKET_OPTIONS: Array<{ value: CoatPocketStyle; label: string; icon: ReactElement }> = [
  { value: 'flap',          label: 'Kapaklı Cep',          icon: FlapPocketIcon       },
  { value: 'flap_3',        label: 'Kapaklı + Göğüs Cebi', icon: FlapThreePocketIcon  },
  { value: 'double_welt',   label: 'Fileto Cep',           icon: DoubleWeltIcon       },
  { value: 'double_welt_3', label: 'Fileto + Göğüs Cebi',  icon: DoubleWeltThreeIcon  },
  { value: 'diagonal',      label: 'Verev Cep',            icon: DiagonalPocketIcon   },
  { value: 'patched',       label: 'Yama Cep',             icon: PatchedPocketIcon    },
];

// ---------------------------------------------------------------------------
// CoatCard — generic option card with active + disabled states
// ---------------------------------------------------------------------------

function CoatCard<T extends string>({
  value,
  current,
  label,
  icon,
  onClick,
  disabled,
}: {
  value:    T;
  current:  T;
  label:    string;
  icon?:    ReactElement;
  onClick:  (v: T) => void;
  disabled?: boolean;
}) {
  const isActive = value === current;
  return (
    <button
      type="button"
      className={`coat-card${isActive ? ' active' : ''}`}
      onClick={() => onClick(value)}
      disabled={disabled}
    >
      {isActive && <span className="coat-card-check">✓</span>}
      {icon && <span className="coat-card-icon">{icon}</span>}
      <span className="coat-card-label">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CoatSection — collapsible category wrapper; hidden when not applicable
// ---------------------------------------------------------------------------

function CoatSection({
  title,
  children,
  visible = true,
}: {
  title:    string;
  children: ReactNode;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <div className="coat-section">
      <span className="coat-section-title">{title}</span>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FabricBar — reuses JacketConfigurator's .jc- classes for visual consistency
// ---------------------------------------------------------------------------

function FabricBar({
  fabrics,
  activeFabricKey,
  onChange,
  readOnly,
}: {
  fabrics:         FabricResponse[];
  activeFabricKey: string;
  onChange:        (key: string, name: string) => void;
  readOnly:        boolean;
}) {
  if (fabrics.length === 0) return null;
  return (
    <div className="jc-fabricBar">
      <span className="jc-fabricBarLabel">Kumaş</span>
      <div className="jc-fabricCards">
        {fabrics.map((fabric) => (
          <button
            key={fabric.key}
            type="button"
            className={`jc-fabricCard${fabric.key === activeFabricKey ? ' active' : ''}`}
            onClick={() => onChange(fabric.key, fabric.name)}
            disabled={readOnly}
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
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoatConfiguratorProps {
  value:             CoatConfig;
  onChange:          (config: CoatConfig) => void;
  readOnly?:         boolean;
  mode?:             'full' | 'viewer-only' | 'controls-only' | 'controls-all';
  showUpload?:       boolean;
  viewerBackground?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CoatConfigurator({
  value,
  onChange,
  readOnly         = false,
  mode             = 'full',
  viewerBackground,
}: CoatConfiguratorProps) {
  const [fabrics,  setFabrics]  = useState<FabricResponse[]>([]);
  const [coatJson, setCoatJson] = useState<CoatConfigJSON | null>(null);

  const onChangeRef      = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });
  const initialValueRef  = useRef(value);

  // Fetch coat_config.json once
  useEffect(() => {
    fetch('/assets/coat/coat_config.json')
      .then((r) => {
        if (!r.ok) throw new Error(`coat_config.json yüklenemedi (HTTP ${r.status})`);
        return r.json() as Promise<CoatConfigJSON>;
      })
      .then(setCoatJson)
      .catch(() => {});
  }, []);

  // Fetch fabric list once, seed default fabric if none set
  useEffect(() => {
    getFabrics('JACKET')
      .then((data) => {
        setFabrics(data);
        if (data.length > 0 && !initialValueRef.current.fabricKey) {
          const first = data[0];
          onChangeRef.current({
            ...initialValueRef.current,
            fabricKey:   first.key,
            fabricLabel: first.name,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const effectiveFabricKey = value.fabricKey || fabrics[0]?.key || '';

  const activeFabricId = useMemo(
    () => fabrics.find((f) => f.key === effectiveFabricKey)?.fabricId ?? null,
    [fabrics, effectiveFabricKey],
  );

  const params = COAT_STYLE_PARAMS[value.style];

  // Trench fastening activates the classic trench collar — lapel options are N/A
  const isTrench = value.fastening === 'trench';

  // Which sections are visible (dependency logic)
  const showLapelStyle  = params.hasLapel      && !isTrench;
  const showLapelWidth  = params.hasLapelWidth  && !isTrench;
  const showLapelLength = params.hasLapelLength;
  const showFastening   = params.hasFastening;

  // Lapel style options depend on style — crossed (Kruvaze) only supports notch + ulster
  const lapelOptions = useMemo(
    () =>
      params.internalStyle === 'crossed'
        ? ALL_LAPEL_OPTIONS.filter((o) => o.value === 'notch' || o.value === 'ulster')
        : ALL_LAPEL_OPTIONS.filter((o) => o.value !== 'ulster'),
    [params.internalStyle],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleStyleChange(newStyle: CoatStyle) {
    const p = COAT_STYLE_PARAMS[newStyle];
    const updates: Partial<CoatConfig> = {
      style:       newStyle,
      lapelLength: p.defaultLapelLength,
    };
    // Crossed (Kruvaze) only supports notch/ulster — reset peak/rounded to notch
    if (p.internalStyle === 'crossed' && value.lapelStyle !== 'ulster') {
      updates.lapelStyle = 'notch';
    }
    // Styles without fastening should not carry a trench fastening value
    if (!p.hasFastening) {
      updates.fastening = 'boton_standard';
    }
    onChange({ ...value, ...updates });
  }

  function set<K extends keyof CoatConfig>(key: K, val: CoatConfig[K]) {
    onChange({ ...value, [key]: val });
  }

  // ── Sub-views ──────────────────────────────────────────────────────────────

  const fabricBar = (
    <FabricBar
      fabrics={fabrics}
      activeFabricKey={effectiveFabricKey}
      onChange={(key, name) => onChange({ ...value, fabricKey: key, fabricLabel: name })}
      readOnly={readOnly}
    />
  );

  const optionSections = (
    <div className="coat-sections">
      {/* 1 — Stil */}
      <CoatSection title="Stil">
        <div className="coat-grid-3">
          {STYLE_OPTIONS.map((opt) => (
            <CoatCard<CoatStyle>
              key={opt.value}
              value={opt.value}
              current={value.style}
              label={opt.label}
              icon={opt.icon}
              onClick={handleStyleChange}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>

      {/* 2 — Yaka Şekli (hidden for funnel_neck, duffle_coat and trench fastening) */}
      <CoatSection title="Yaka Şekli" visible={showLapelStyle}>
        <div className="coat-grid-2">
          {lapelOptions.map((opt) => (
            <CoatCard<CoatLapelStyle>
              key={opt.value}
              value={opt.value}
              current={value.lapelStyle}
              label={opt.label}
              icon={opt.icon}
              onClick={(v) => set('lapelStyle', v)}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>

      {/* 3 — Yaka Genişliği (hidden for crossed/funnel_neck/duffle/trench) */}
      <CoatSection title="Yaka Genişliği" visible={showLapelWidth}>
        <div className="coat-grid-2">
          {WIDTH_OPTIONS.map((opt) => (
            <CoatCard<CoatLapelWidth>
              key={opt.value}
              value={opt.value}
              current={value.lapelWidth}
              label={opt.label}
              icon={opt.icon}
              onClick={(v) => set('lapelWidth', v)}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>

      {/* 4 — Palto Boyu (hidden for crossed/funnel_neck/duffle) */}
      <CoatSection title="Palto Boyu" visible={showLapelLength}>
        <div className="coat-grid-2">
          {LENGTH_OPTIONS.map((opt) => (
            <CoatCard<CoatLapelLength>
              key={opt.value}
              value={opt.value}
              current={value.lapelLength}
              label={opt.label}
              icon={opt.icon}
              onClick={(v) => set('lapelLength', v)}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>

      {/* 5 — Kapama (hidden for crossed/funnel_neck/duffle) */}
      <CoatSection title="Kapama" visible={showFastening}>
        <div className="coat-grid-3">
          {FASTENING_OPTIONS.map((opt) => (
            <CoatCard<CoatFastening>
              key={opt.value}
              value={opt.value}
              current={value.fastening}
              label={opt.label}
              icon={opt.icon}
              onClick={(v) => set('fastening', v)}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>

      {/* 6 — Cep Stili */}
      <CoatSection title="Cep Stili">
        <div className="coat-grid-3">
          {POCKET_OPTIONS.map((opt) => (
            <CoatCard<CoatPocketStyle>
              key={opt.value}
              value={opt.value}
              current={value.pocketStyle}
              label={opt.label}
              icon={opt.icon}
              onClick={(v) => set('pocketStyle', v)}
              disabled={readOnly}
            />
          ))}
        </div>
      </CoatSection>
    </div>
  );

  // ── Mode: viewer-only ──────────────────────────────────────────────────────

  if (mode === 'viewer-only') {
    return (
      <CoatVisualizer
        value={value}
        coatJson={coatJson}
        activeFabricId={activeFabricId}
        mode="standalone"
        background={viewerBackground}
      />
    );
  }

  // ── Mode: controls-only / controls-all (accordion) ────────────────────────

  if (mode === 'controls-only' || mode === 'controls-all') {
    return (
      <ConfiguratorAccordion
        sections={[
          { key: 'fabric', title: 'Kumaş',   content: fabricBar      },
          { key: 'style',  title: 'Stil',    content: optionSections },
        ]}
      />
    );
  }

  // ── Mode: full (default) ───────────────────────────────────────────────────

  return (
    <div className="jc-root">
      {fabricBar}
      {optionSections}
      <CoatVisualizer
        value={value}
        coatJson={coatJson}
        activeFabricId={activeFabricId}
        mode="embedded"
        background={viewerBackground}
      />
    </div>
  );
}
