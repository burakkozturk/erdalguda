import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  scanFabric,
  scanOrder,
  type FabricScanResult,
  type MeasurementItem,
  type OrderScanResult,
  type StyleItem,
} from '../../api/scanApi';
import { GarmentViewer, type ViewerStatus } from '../../components/GarmentViewer';

// ---------------------------------------------------------------------------
// Injected responsive CSS (no CSS module dependency)
// ---------------------------------------------------------------------------

const PAGE_CSS = `
  .eg-scan-root {
    min-height: 100dvh;
    background: #F5F4F0;
    padding: 0 0 56px;
    font-family: -apple-system, 'Inter', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #111;
  }
  .eg-scan-inner {
    max-width: 520px;
    margin: 0 auto;
    padding: 0 16px;
  }
  .eg-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 0 20px;
  }
  .eg-nav-brand {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #111;
  }
  .eg-nav-sub {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #aaa;
  }
  .eg-card {
    background: #fff;
    border-radius: 20px;
    border: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    overflow: hidden;
    margin-bottom: 12px;
  }
  .eg-card-body {
    padding: 20px 22px;
  }
  .eg-section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #bbb;
    margin: 0 0 14px;
  }
  .eg-swatch-img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    display: block;
    background: #e8e6e0;
  }
  .eg-swatch-placeholder {
    width: 100%;
    aspect-ratio: 4 / 3;
    background: linear-gradient(145deg, #e8e6e0 0%, #d8d5cc 100%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .eg-hero-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }
  .eg-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .eg-badge-product {
    background: #111;
    color: #fff;
  }
  .eg-badge-stage {
    background: #EEF2FF;
    color: #3730A3;
  }
  .eg-badge-status {
    background: #F0FDF4;
    color: #166534;
  }
  .eg-order-number {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #0D0D0D;
    margin: 0 0 4px;
    line-height: 1.1;
  }
  .eg-customer-name {
    font-size: 17px;
    font-weight: 500;
    color: #444;
    margin: 0;
  }
  .eg-notes {
    margin: 14px 0 0;
    padding: 12px 14px;
    background: #FAFAF8;
    border-radius: 10px;
    border-left: 3px solid #D4C9A8;
    font-size: 13px;
    line-height: 1.55;
    color: #666;
    font-style: italic;
  }
  .eg-style-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 0;
    gap: 16px;
  }
  .eg-style-row + .eg-style-row {
    border-top: 1px solid #F2F2F0;
  }
  .eg-style-key {
    font-size: 13px;
    color: #999;
    flex-shrink: 0;
  }
  .eg-style-val {
    font-size: 13px;
    font-weight: 600;
    color: #111;
    text-align: right;
  }
  .eg-meas-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 20px;
  }
  .eg-meas-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 9px 0;
    border-bottom: 1px solid #F2F2F0;
    gap: 8px;
    min-width: 0;
  }
  .eg-meas-label {
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .eg-meas-value {
    font-size: 14px;
    font-weight: 700;
    color: #111;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .eg-meas-unit {
    font-size: 11px;
    font-weight: 400;
    color: #bbb;
    margin-left: 2px;
  }
  .eg-fabric-swatch-thumb {
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    display: block;
    background: #e8e6e0;
  }
  .eg-fabric-stock-yes {
    background: #F0FDF4;
    color: #166534;
  }
  .eg-fabric-stock-no {
    background: #FEF2F2;
    color: #991B1B;
  }
  .eg-footer {
    text-align: center;
    padding-top: 32px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #ccc;
  }
  .eg-divider {
    margin: 0 22px;
    border: none;
    border-top: 1px solid #F2F2F0;
  }
  @media (max-width: 480px) {
    .eg-meas-grid {
      grid-template-columns: 1fr;
    }
    .eg-order-number {
      font-size: 24px;
    }
    .eg-customer-name {
      font-size: 15px;
    }
  }
`;

// ---------------------------------------------------------------------------
// Order scan view
// ---------------------------------------------------------------------------

interface OrderViewProps {
  data: OrderScanResult;
  onViewerStatus?: (s: ViewerStatus) => void;
}

function OrderView({ data, onViewerStatus }: OrderViewProps) {
  const productLabel = PRODUCT_LABELS[data.productTypeLabel] ?? data.productTypeLabel;

  return (
    <>
      {/* ── Hero card ─────────────────────────────────────────── */}
      <div className="eg-card">
        {/* Priority: layered render > swatch image > placeholder */}
        {data.renderHint ? (
          <GarmentViewer
            hint={data.renderHint}
            swatchUrl={data.primaryFabricSwatchUrl}
            height="380px"
            onStatusChange={onViewerStatus}
          />
        ) : data.primaryFabricSwatchUrl ? (
          <img
            className="eg-swatch-img"
            src={data.primaryFabricSwatchUrl}
            alt="Kumaş"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="eg-swatch-placeholder">
            <span style={{ fontSize: 32, opacity: 0.25 }}>✂</span>
          </div>
        )}

        <div className="eg-card-body">
          <div className="eg-hero-badges">
            <span className="eg-badge eg-badge-product">{productLabel}</span>
            {data.productionStageName && (
              <span className="eg-badge eg-badge-stage">{data.productionStageName}</span>
            )}
            {data.orderStatusLabel && (
              <span className="eg-badge eg-badge-status">
                {STATUS_LABELS[data.orderStatusLabel] ?? data.orderStatusLabel}
              </span>
            )}
          </div>

          <h1 className="eg-order-number">#{data.orderNumber}</h1>
          <p className="eg-customer-name">{data.customerFullName}</p>

          {data.notes && (
            <p className="eg-notes">{data.notes}</p>
          )}
        </div>
      </div>

      {/* ── Style details ─────────────────────────────────────── */}
      {data.styleItems.length > 0 && (
        <div className="eg-card">
          <div className="eg-card-body" style={{ paddingBottom: 6 }}>
            <p className="eg-section-label">Stil Detayları</p>
            {data.styleItems.map((item: StyleItem, i: number) => (
              <div key={i} className="eg-style-row">
                <span className="eg-style-key">{item.label}</span>
                <span className="eg-style-val">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Measurements ──────────────────────────────────────── */}
      {data.measurements.length > 0 && (
        <div className="eg-card">
          <div className="eg-card-body">
            <p className="eg-section-label">Vücut Ölçüleri</p>
            <div className="eg-meas-grid">
              {data.measurements.map((m: MeasurementItem) => (
                <div key={m.order} className="eg-meas-row">
                  <span className="eg-meas-label">{m.label}</span>
                  <span className="eg-meas-value">
                    {m.value}
                    {m.unit && <span className="eg-meas-unit">{m.unit}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Fabric scan view
// ---------------------------------------------------------------------------

function FabricView({ data }: { data: FabricScanResult }) {
  return (
    <div className="eg-card">
      {data.swatchUrl ? (
        <img
          className="eg-fabric-swatch-thumb"
          src={data.swatchUrl}
          alt={data.name}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="eg-swatch-placeholder" style={{ aspectRatio: '2/1' }}>
          <span style={{ fontSize: 28, opacity: 0.25 }}>✂</span>
        </div>
      )}

      <div className="eg-card-body">
        <p className="eg-section-label" style={{ marginBottom: 8 }}>Kumaş</p>
        <h1 className="eg-order-number" style={{ fontSize: 22 }}>{data.name}</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, fontFamily: 'monospace', color: '#bbb', letterSpacing: '0.05em' }}>
          {data.fabricId}
        </p>

        <div className="eg-hero-badges" style={{ marginTop: 14 }}>
          <span className="eg-badge eg-badge-product">{data.typeLabel}</span>
          {data.tag && (
            <span className="eg-badge" style={{ background: '#F5F4F0', color: '#555' }}>{data.tag}</span>
          )}
          <span className={`eg-badge ${data.inStock ? 'eg-fabric-stock-yes' : 'eg-fabric-stock-no'}`}>
            {data.inStock ? 'Stokta Var' : 'Stokta Yok'}
          </span>
        </div>

        {data.subtitle && (
          <>
            <hr className="eg-divider" style={{ margin: '14px 0', borderColor: '#F2F2F0' }} />
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#666' }}>{data.subtitle}</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Label maps
// ---------------------------------------------------------------------------

const PRODUCT_LABELS: Record<string, string> = {
  JACKET: 'Ceket',
  SUIT: 'Takım Elbise',
  SHIRT: 'Gömlek',
  TROUSERS: 'Pantolon',
  VEST: 'Yelek',
  SMOKIN: 'Smokin',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  ON_HOLD: 'Beklemede',
};

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="eg-scan-root">
        <div className="eg-scan-inner">
          <nav className="eg-nav">
            <span className="eg-nav-brand">Erdal Güda</span>
            <span className="eg-nav-sub">Atölye</span>
          </nav>

          {children}

          <p className="eg-footer">Erdal Güda Terzi Atölyesi</p>
        </div>
      </div>
    </>
  );
}

function LoadingState() {
  return (
    <div className="eg-card">
      <div className="eg-card-body" style={{ padding: '48px 22px', textAlign: 'center', color: '#bbb', fontSize: 14 }}>
        Yükleniyor…
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="eg-card">
      <div className="eg-card-body" style={{ padding: '24px 22px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E53E3E', marginBottom: 6 }}>
          Hata
        </p>
        <p style={{ margin: 0, fontSize: 14, color: '#444' }}>{message}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page: /scan/order/:orderNumber
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS        = 6;   // 6 × 5 s = 30 s max

export function OrderScanPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [data,  setData]  = useState<OrderScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Viewer status fed back by GarmentViewer
  const [viewerStatus, setViewerStatus] = useState<ViewerStatus>('loading');

  // Poll counter — incremented to trigger the polling useEffect
  const [pollCount, setPollCount] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Initial fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderNumber) return;
    scanOrder(orderNumber)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Veri yüklenemedi'));
  }, [orderNumber]);

  // ── Handle viewerStatus callback ─────────────────────────────────────────
  const handleViewerStatus = useCallback((s: ViewerStatus) => {
    setViewerStatus(s);
  }, []);

  // ── Polling: fires when renderHint is null OR viewer errors out ──────────
  //
  //  Case 1 — renderHint is null: the Order may have been updated with a
  //            fabric key after page load.  Re-fetching will pick it up.
  //  Case 2 — viewer errored (Python config unreachable): re-fetching is
  //            harmless and gives GarmentViewer a new hint object reference,
  //            which triggers a fresh config fetch inside the component.
  //
  //  Stops automatically after MAX_POLLS attempts.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderNumber || !data) return;
    if (viewerStatus === 'ready') return;      // already rendered — stop
    if (pollCount >= MAX_POLLS) return;        // give up after 30 s

    const shouldPoll = data.renderHint === null || viewerStatus === 'error';
    if (!shouldPoll) return;

    pollTimerRef.current = setTimeout(async () => {
      try {
        const fresh = await scanOrder(orderNumber);
        setData(fresh);
        // Reset viewerStatus so GarmentViewer retries inside the new render
        setViewerStatus('loading');
      } catch {
        // Ignore poll errors — user still sees last good data
      } finally {
        setPollCount((n) => n + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [orderNumber, data, viewerStatus, pollCount]);

  return (
    <PageShell>
      {error ? (
        <ErrorState message={error} />
      ) : !data ? (
        <LoadingState />
      ) : (
        <OrderView data={data} onViewerStatus={handleViewerStatus} />
      )}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Page: /scan/fabric/:fabricId
// ---------------------------------------------------------------------------

export function FabricScanPage() {
  const { fabricId } = useParams<{ fabricId: string }>();
  const [data, setData] = useState<FabricScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fabricId) return;
    scanFabric(fabricId)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Veri yüklenemedi'));
  }, [fabricId]);

  return (
    <PageShell>
      {error ? <ErrorState message={error} /> : !data ? <LoadingState /> : <FabricView data={data} />}
    </PageShell>
  );
}
