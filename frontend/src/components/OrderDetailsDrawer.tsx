import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { getOrder, triggerRender } from '../api/orderApi';
import { listMeasurementSetsByCustomer } from '../api/measurementApi';
import { GarmentViewer, type ViewerStatus } from './GarmentViewer';
import { PrintLabelModal } from './PrintLabelModal';
import type { ProductionJob, ProductType } from '../types/production';
import type { Order } from '../types/order';
import type { MeasurementValue, MeasurementSet } from '../types/measurement';
import type { RenderHint } from '../api/scanApi';
import { getProductTypeLabel } from '../types/production';
import { getPaymentStatusLabel } from '../types/order';
import {
  getJacketStyleLabel,
  getPocketLabel,
  getConfiguratorLabel,
  LAPEL_STYLE_LABELS,
  JACKET_LAPEL_WIDTH_LABELS,
  JACKET_FIT_LABELS,
  JACKET_VENT_LABELS,
  SHIRT_COLLAR_LABELS,
  SHIRT_CUFF_LABELS,
  SHIRT_FIT_LABELS,
  PANT_FASTENING_LABELS,
  PANT_PLEAT_LABELS,
  PANT_FIT_LABELS,
  PANT_LEG_STYLE_LABELS,
  VEST_STYLE_LABELS,
  VEST_LAPEL_SHAPE_LABELS,
  TUXEDO_STYLE_LABELS,
} from '../data/configuratorLabels';

// ---------------------------------------------------------------------------
// Polling constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS        = 3;    // 3 × 5 s = 15 s max

// Product types that can ever have a GarmentViewer renderHint.
// JACKET / SUIT / SMOKIN have no Python viewer → skip polling for them.
const VIEWER_SUPPORTED: Set<ProductType> = new Set(['SHIRT', 'TROUSERS', 'VEST']);

// ---------------------------------------------------------------------------
// S3 helpers — mirrors ScanService logic exactly
// ---------------------------------------------------------------------------

const S3_BASE = 'https://erdalguda-assets.s3.eu-north-1.amazonaws.com';

function derivePrimarySwatchUrl(order: Order): string | null {
  let fabricId: string | null | undefined;
  switch (order.productType) {
    case 'JACKET': case 'SUIT': case 'VEST':
      fabricId = order.jacketFabricKey; break;
    case 'SHIRT':
      fabricId = order.shirtFabricKey; break;
    case 'TROUSERS':
      fabricId = order.pantFabricKey; break;
    case 'SMOKIN':
      fabricId = order.tuxedoFabricKey; break;
  }
  if (!fabricId) return null;
  const dir = order.productType === 'SHIRT' ? 'shirts' : 'blazer';
  return `${S3_BASE}/${dir}/generated-swatches/${fabricId}.png`;
}

function deriveRenderHint(order: Order): RenderHint | null {
  switch (order.productType) {
    case 'TROUSERS': {
      const key = order.pantFabricKey;
      if (!key) return null;
      return {
        garmentType: 'pant',
        fabricKey: key,
        styleKeys: {
          fasteningStyle: order.pantFasteningStyle ?? 'centered',
          pleatStyle:     order.pantPleatStyle     ?? 'none',
        },
      };
    }
    case 'SHIRT': {
      const key = order.shirtFabricKey;
      if (!key) return null;
      return {
        garmentType: 'shirt',
        fabricKey: key,
        styleKeys: {
          collarStyle:   order.shirtCollarStyle   ?? 'cutaway',
          collarButtons: order.shirtCollarButtons ?? '1',
          cuffStyle:     order.shirtCuffStyle     ?? 'single',
        },
      };
    }
    case 'VEST': {
      const key = order.vestFabricKey;
      if (!key) return null;
      return {
        garmentType: 'vest',
        fabricKey: key,
        styleKeys: {
          stylePrefix: order.vestLapelStyle  ?? 'single-4btn',
          lapelStyle:  order.vestPocketStyle ?? 'notch',
        },
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// KV builders
// ---------------------------------------------------------------------------

type KvItem = { label: string; value: string };

function buildStyleItems(order: Order): KvItem[] {
  const items: KvItem[] = [];
  // add raw string (fabric labels, button counts, etc.)
  const add = (label: string, value: string | null | undefined) => {
    if (value) items.push({ label, value });
  };
  // add only when raw value is present, but show the mapped Turkish label
  const addMapped = (label: string, raw: string | null | undefined, mapped: string) => {
    if (raw) items.push({ label, value: mapped });
  };
  switch (order.productType) {
    case 'JACKET':
      addMapped('Stil',           order.jacketStyleKey,     getJacketStyleLabel(order.jacketStyleKey));
      addMapped('Yaka',           order.jacketLapelStyle,   getConfiguratorLabel(LAPEL_STYLE_LABELS, order.jacketLapelStyle));
      addMapped('Yaka Genişliği', order.jacketLapelWidth,   getConfiguratorLabel(JACKET_LAPEL_WIDTH_LABELS, order.jacketLapelWidth));
      addMapped('Cep',            order.jacketPocketStyle,  getPocketLabel(order.jacketPocketStyle));
      addMapped('Kesim',          order.jacketFit,          getConfiguratorLabel(JACKET_FIT_LABELS, order.jacketFit));
      addMapped('Yırtmaç',        order.jacketVent,         getConfiguratorLabel(JACKET_VENT_LABELS, order.jacketVent));
      add('Kumaş', order.jacketFabricLabel);
      break;
    case 'SUIT':
      addMapped('Ceket Stil',     order.jacketStyleKey,        getJacketStyleLabel(order.jacketStyleKey));
      addMapped('Ceket Yaka',     order.jacketLapelStyle,      getConfiguratorLabel(LAPEL_STYLE_LABELS, order.jacketLapelStyle));
      add('Ceket Kumaş',    order.jacketFabricLabel);
      addMapped('Pantolon Bel',   order.pantFasteningStyle,    getConfiguratorLabel(PANT_FASTENING_LABELS, order.pantFasteningStyle));
      addMapped('Pantolon Pile',  order.pantPleatStyle,        getConfiguratorLabel(PANT_PLEAT_LABELS, order.pantPleatStyle));
      add('Pantolon Kumaş', order.pantFabricLabel);
      break;
    case 'SHIRT':
      addMapped('Yaka Stili',   order.shirtCollarStyle,   getConfiguratorLabel(SHIRT_COLLAR_LABELS, order.shirtCollarStyle));
      add('Yaka Düğmesi', order.shirtCollarButtons);
      addMapped('Manşet',       order.shirtCuffStyle,     getConfiguratorLabel(SHIRT_CUFF_LABELS, order.shirtCuffStyle));
      addMapped('Kesim',        order.shirtFit,           getConfiguratorLabel(SHIRT_FIT_LABELS, order.shirtFit));
      add('Kumaş', order.shirtFabricLabel);
      break;
    case 'TROUSERS':
      addMapped('Bel İliği',  order.pantFasteningStyle, getConfiguratorLabel(PANT_FASTENING_LABELS, order.pantFasteningStyle));
      addMapped('Pile',       order.pantPleatStyle,     getConfiguratorLabel(PANT_PLEAT_LABELS, order.pantPleatStyle));
      addMapped('Kesim',      order.pantFit,            getConfiguratorLabel(PANT_FIT_LABELS, order.pantFit));
      addMapped('Paça Stili', order.pantLegStyle,       getConfiguratorLabel(PANT_LEG_STYLE_LABELS, order.pantLegStyle));
      add('Kumaş', order.pantFabricLabel);
      break;
    case 'VEST':
      addMapped('Stil',  order.vestLapelStyle,  getConfiguratorLabel(VEST_STYLE_LABELS, order.vestLapelStyle));
      addMapped('Yaka',  order.vestPocketStyle, getConfiguratorLabel(VEST_LAPEL_SHAPE_LABELS, order.vestPocketStyle));
      add('Kumaş', order.vestFabricLabel);
      break;
    case 'SMOKIN':
      addMapped('Stil',           order.tuxedoStyle,       getConfiguratorLabel(TUXEDO_STYLE_LABELS, order.tuxedoStyle));
      addMapped('Yaka',           order.tuxedoLapelStyle,  getConfiguratorLabel(LAPEL_STYLE_LABELS, order.tuxedoLapelStyle));
      addMapped('Yaka Genişliği', order.tuxedoLapelWidth,  getConfiguratorLabel(JACKET_LAPEL_WIDTH_LABELS, order.tuxedoLapelWidth));
      addMapped('Cep',            order.tuxedoPocketStyle, getPocketLabel(order.tuxedoPocketStyle));
      add('Kumaş', order.tuxedoFabricLabel);
      break;
  }
  return items;
}

function buildOrderInfoItems(order: Order): KvItem[] {
  const items: KvItem[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) items.push({ label, value });
  };
  add('Ürün',         order.productTypeLabel);
  add('Sipariş Tarihi', fmtDate(order.orderDate));
  add('Teslim Tarihi',  fmtDate(order.expectedDeliveryDate));
  add('Durum',         order.statusLabel);
  add('Toplam Tutar',  fmtMoney(order.totalAmount, order.currency));
  add('Ödeme',         getPaymentStatusLabel(order.paymentStatus));
  return items;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  try { return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(v)); }
  catch { return v; }
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '—';
  try { return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency ?? 'TRY' }).format(amount); }
  catch { return `${amount}`; }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbb' }}>
        {children}
      </p>
      <hr style={{ margin: '5px 0 0', border: 'none', borderTop: '1px solid rgba(21,39,83,0.08)' }} />
    </div>
  );
}

function KvGrid({ items }: { items: KvItem[] }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '9px 20px', alignItems: 'baseline', marginBottom: 22 }}>
      {items.map(({ label, value }) => (
        <Fragment key={label}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#aaa', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>
            {value}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

function MeasurementGrid({ values }: { values: MeasurementValue[] }) {
  if (!values.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 22 }}>
      {values.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 6,
            padding: '5px 9px',
            background: 'rgba(21,39,83,0.035)',
            borderRadius: 7,
          }}
        >
          <span style={{ fontSize: 10.5, color: '#999', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.definitionLabel}
          </span>
          <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 700, flexShrink: 0 }}>
            {m.numericValue}&thinsp;{m.unit}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero visual — handles all render/swatch/polling states
// ---------------------------------------------------------------------------

interface HeroProps {
  order: Order;
  viewerStatus: ViewerStatus;
  pollCount: number;
  onViewerStatus: (s: ViewerStatus) => void;
  onRetry: () => void;
}

function HeroVisual({ order, viewerStatus, pollCount, onViewerStatus, onRetry }: HeroProps) {
  const [swatchFailed, setSwatchFailed] = useState(false);

  const hint      = deriveRenderHint(order);
  const swatchUrl = derivePrimarySwatchUrl(order);
  const isPolling = pollCount > 0 && pollCount < MAX_POLLS && viewerStatus !== 'ready';
  const gaveUp    = pollCount >= MAX_POLLS && viewerStatus !== 'ready';

  // ── Case 1: viewer-supported product type with a renderHint ───────────────
  if (hint) {
    // Timeout reached — replace viewer with error panel
    if (gaveUp) {
      return (
        <div style={{
          marginBottom: 24,
          height: 180,
          borderRadius: 10,
          background: '#F0EDE8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 26, opacity: 0.15 }}>✂</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#bbb' }}>
            Görsel Yüklenemedi
          </span>
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: 4,
              padding: '6px 18px',
              borderRadius: 6,
              border: '1px solid rgba(21,39,83,0.18)',
              background: 'rgba(21,39,83,0.05)',
              fontSize: 11,
              fontWeight: 700,
              color: '#152753',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            Tekrar Dene
          </button>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', marginBottom: 24 }}>
        {/*
          key={pollCount} forces a full remount on every poll.
          This resets GarmentViewer's internal state machine so it retries
          the Python config fetch from scratch, exactly as the scan page does.
        */}
        <GarmentViewer
          key={pollCount}
          hint={hint}
          swatchUrl={swatchUrl}
          height="220px"
          onStatusChange={onViewerStatus}
        />

        {/* Polling toast — visible while actively retrying */}
        {isPolling && (
          <div style={{
            position: 'absolute',
            bottom: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(245,244,240,0.92)',
            border: '1px solid rgba(200,190,170,0.35)',
            backdropFilter: 'blur(6px)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(100,85,60,0.75)',
          }}>
            <span style={{ animation: 'eg-spin 2s linear infinite', display: 'inline-block' }}>✂</span>
            Render yükleniyor… ({pollCount}/{MAX_POLLS})
          </div>
        )}
      </div>
    );
  }

  // ── Case 2: no viewer hint, but swatch available ──────────────────────────
  if (swatchUrl && !swatchFailed) {
    return (
      <div style={{ marginBottom: 24, height: 180, borderRadius: 10, overflow: 'hidden', background: '#EDEBE6' }}>
        <img
          src={swatchUrl}
          alt="Kumaş"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setSwatchFailed(true)}
        />
      </div>
    );
  }

  // ── Case 3: nothing usable — swatch failed or no swatch ──────────────────
  return (
    <div style={{
      marginBottom: 24,
      height: gaveUp ? 140 : 100,
      borderRadius: 10,
      background: '#F0EDE8',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    }}>
      <span style={{ fontSize: 22, opacity: 0.18 }}>✂</span>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#ccc' }}>
        {gaveUp ? 'Görsel Yüklenemedi' : 'Görsel mevcut değil'}
      </span>
      {gaveUp && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: '6px 18px',
            borderRadius: 6,
            border: '1px solid rgba(21,39,83,0.18)',
            background: 'rgba(21,39,83,0.05)',
            fontSize: 11,
            fontWeight: 700,
            color: '#152753',
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Tekrar Dene
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface OrderDetailsDrawerProps {
  job: ProductionJob;
  onClose: () => void;
}

export function OrderDetailsDrawer({ job, onClose }: OrderDetailsDrawerProps) {
  const [order, setOrder]               = useState<Order | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementSet | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [loadError, setLoadError]       = useState<string | null>(null);
  const [showPrint, setShowPrint]       = useState(false);
  const [open, setOpen]                 = useState(false);

  // Viewer status fed back from GarmentViewer (mirrors scan page pattern)
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>('loading');
  const [pollCount, setPollCount]       = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Slide-in animation ───────────────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Escape to close ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // ── Render trigger — warms up Python, best-effort ────────────────────────
  const doTriggerRender = useCallback(() => {
    if (!job.relatedOrderId) return;
    void triggerRender(job.relatedOrderId).catch(() => { /* silently ignore */ });
  }, [job.relatedOrderId]);

  // ── Initial data fetch ───────────────────────────────────────────────────
  useEffect(() => {
    if (!job.relatedOrderId) return;
    setIsLoading(true);
    setLoadError(null);
    setOrder(null);
    setMeasurements(null);
    setViewerStatus('loading');
    setPollCount(0);

    Promise.all([
      getOrder(job.relatedOrderId),
      listMeasurementSetsByCustomer(job.customerId),
    ])
      .then(([orderData, sets]) => {
        setOrder(orderData);
        setMeasurements(sets[0] ?? null);
        // Warm up Python so GarmentViewer config fetch succeeds on first attempt
        if (VIEWER_SUPPORTED.has(orderData.productType)) {
          doTriggerRender();
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Detaylar yüklenemedi.'))
      .finally(() => setIsLoading(false));
  }, [job.relatedOrderId, job.customerId, doTriggerRender]);

  // ── Polling: mirrors ScanPage logic exactly ──────────────────────────────
  //
  //  Fires when:
  //    (a) renderHint is null AND the product type can support a viewer
  //        → the order may have just been created without a fabricKey;
  //          re-fetching picks it up once it's assigned.
  //    (b) viewerStatus === 'error'
  //        → Python config unreachable (cold start, transient failure);
  //          key={pollCount} on GarmentViewer forces a remount so its
  //          internal retry state machine restarts from scratch.
  //
  //  Stops automatically at MAX_POLLS (30 s) or when viewer reports 'ready'.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!job.relatedOrderId || !order) return;
    if (viewerStatus === 'ready') return;
    if (pollCount >= MAX_POLLS) return;

    const hint = deriveRenderHint(order);
    const canEverHaveHint = VIEWER_SUPPORTED.has(order.productType);
    const shouldPoll = (hint === null && canEverHaveHint) || viewerStatus === 'error';
    if (!shouldPoll) return;

    pollTimerRef.current = setTimeout(async () => {
      try {
        const fresh = await getOrder(job.relatedOrderId!);
        setOrder(fresh);
        // Reset viewer status so GarmentViewer (remounted via key) retries
        setViewerStatus('loading');
      } catch {
        // Swallow poll errors; user continues to see last good data
      } finally {
        setPollCount((n) => n + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [job.relatedOrderId, order, viewerStatus, pollCount]);

  const handleViewerStatus = useCallback((s: ViewerStatus) => {
    setViewerStatus(s);
  }, []);

  const handleRetry = useCallback(() => {
    setPollCount(0);
    setViewerStatus('loading');
    doTriggerRender();
  }, [doTriggerRender]);

  const styleItems      = order ? buildStyleItems(order)      : [];
  const orderInfoItems  = order ? buildOrderInfoItems(order)  : [];
  const sortedMeasurements = measurements
    ? [...measurements.values].sort((a, b) => a.definitionOrder - b.definitionOrder)
    : [];

  return (
    <>
      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 8, 12, 0.48)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 48,
          cursor: 'pointer',
        }}
      />

      {/* ── Drawer panel ─────────────────────────────────────────────────── */}
      <aside
        aria-label="Sipariş Detayı"
        style={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0,
          width: 'min(500px, 100vw)',
          zIndex: 49,
          background: '#FAF9F6',
          borderLeft: '1px solid rgba(21,39,83,0.10)',
          boxShadow: '-8px 0 48px rgba(8,8,12,0.20)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32, 0, 0, 1)',
          willChange: 'transform',
        }}
      >
        {/* Header */}
        <header style={{
          padding: '20px 24px 18px',
          borderBottom: '1px solid rgba(21,39,83,0.09)',
          background: '#FAF9F6',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbb' }}>
              Sipariş Detayı
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                {job.relatedOrderNumber ?? job.jobNumber}
              </h2>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '3px 10px', borderRadius: 999,
                background: 'rgba(21,39,83,0.06)', color: '#152753',
                border: '1px solid rgba(21,39,83,0.14)',
              }}>
                {job.currentStage.name}
              </span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#444', fontWeight: 600 }}>
              {job.customerFullName}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aaa' }}>
              {getProductTypeLabel(job.productType)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid rgba(21,39,83,0.13)',
              borderRadius: '50%',
              width: 34, height: 34,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', fontSize: 20, flexShrink: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </header>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px 8px' }}>

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', fontSize: 13, marginBottom: 20 }}>
              <span style={{ animation: 'eg-spin 2s linear infinite', display: 'inline-block', fontSize: 18 }}>✂</span>
              Sipariş detayları yükleniyor…
            </div>
          )}

          {loadError && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(159,63,53,0.07)', color: '#9f3f35', fontSize: 13, marginBottom: 20 }}>
              {loadError}
            </div>
          )}

          {!job.relatedOrderId && !isLoading && (
            <div style={{ padding: '16px 0', color: '#aaa', fontSize: 13 }}>
              Bu üretim işine bağlı bir sipariş kaydı bulunmuyor.
            </div>
          )}

          {order && (
            <>
              {/* Hero visual (GarmentViewer / swatch / placeholder with polling) */}
              <HeroVisual
                order={order}
                viewerStatus={viewerStatus}
                pollCount={pollCount}
                onViewerStatus={handleViewerStatus}
                onRetry={handleRetry}
              />

              {/* Sipariş bilgileri */}
              <SectionHeading>Sipariş Bilgileri</SectionHeading>
              <KvGrid items={orderInfoItems} />
              {order.notes && (
                <div style={{ marginBottom: 22, padding: '10px 14px', background: 'rgba(198,161,91,0.06)', borderLeft: '3px solid rgba(198,161,91,0.4)', borderRadius: '0 6px 6px 0', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                  {order.notes}
                </div>
              )}

              {/* Stil konfigürasyonu */}
              {styleItems.length > 0 && (
                <>
                  <SectionHeading>Stil Konfigürasyonu</SectionHeading>
                  <KvGrid items={styleItems} />
                </>
              )}

              {/* Ölçüler */}
              {sortedMeasurements.length > 0 && (
                <>
                  <SectionHeading>Ölçüler</SectionHeading>
                  {measurements?.measuredAt && (
                    <p style={{ margin: '-8px 0 10px', fontSize: 11, color: '#bbb' }}>
                      Ölçüm tarihi: {fmtDate(measurements.measuredAt)}
                    </p>
                  )}
                  <MeasurementGrid values={sortedMeasurements} />
                </>
              )}

              <div style={{ height: 8 }} />
            </>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          flexShrink: 0,
          padding: '14px 24px',
          borderTop: '1px solid rgba(21,39,83,0.09)',
          background: '#FAF9F6',
          display: 'flex',
          gap: 10,
        }}>
          {job.relatedOrderNumber && (
            <button type="button" className="primary-button" style={{ flex: 1 }} onClick={() => setShowPrint(true)}>
              QR Etiket Yazdır
            </button>
          )}
          <button
            type="button"
            className="ghost-button"
            style={{ flex: job.relatedOrderNumber ? undefined : 1 }}
            onClick={onClose}
          >
            Kapat
          </button>
        </footer>
      </aside>

      {showPrint && job.relatedOrderNumber && (
        <PrintLabelModal
          type="order"
          id={job.relatedOrderNumber}
          title={job.customerFullName}
          subtitle={getProductTypeLabel(job.productType)}
          onClose={() => setShowPrint(false)}
        />
      )}

      <style>{`@keyframes eg-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
