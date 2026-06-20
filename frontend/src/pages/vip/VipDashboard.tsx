import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVipOrders, getVipMeasurements } from '../../api/vipApi';
import { getProductTypeLabel } from '../../types/production';
import type { Order } from '../../types/order';
import type { MeasurementSet } from '../../types/measurement';
import type { ProductType } from '../../types/production';

function ScissorsSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        gap: '12px',
        color: '#152753',
      }}
    >
      <span
        style={{
          fontSize: '32px',
          display: 'inline-block',
          animation: 'spin 1.2s linear infinite',
        }}
      >
        ✂
      </span>
      <span style={{ fontSize: '13px', color: '#666', fontFamily: "'Georgia', serif" }}>Yükleniyor...</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function VipDashboard() {
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [measurements, setMeasurements] = useState<MeasurementSet[]>([]);
  const [measurementsLoading, setMeasurementsLoading] = useState(true);
  const [measurementsError, setMeasurementsError] = useState<string | null>(null);

  useEffect(() => {
    getVipOrders()
      .then(setOrders)
      .catch((err) => setOrdersError(err instanceof Error ? err.message : 'Siparişler yüklenemedi.'))
      .finally(() => setOrdersLoading(false));

    getVipMeasurements()
      .then(setMeasurements)
      .catch((err) => setMeasurementsError(err instanceof Error ? err.message : 'Ölçüler yüklenemedi.'))
      .finally(() => setMeasurementsLoading(false));
  }, []);

  const latestMeasurementSet = measurements[0] ?? null;

  return (
    <div>
      {/* CTA Hero Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, #152753 0%, #1e3a7a 50%, #0f1e3d 100%)',
          borderRadius: '12px',
          padding: '36px 40px',
          marginBottom: '28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'rgba(201, 168, 76, 0.06)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40px',
            right: '60px',
            width: '220px',
            height: '220px',
            borderRadius: '50%',
            background: 'rgba(201, 168, 76, 0.04)',
          }}
        />
        <span
          style={{
            display: 'block',
            fontSize: '10px',
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: '#c9a84c',
            fontFamily: "'Georgia', serif",
            marginBottom: '10px',
          }}
        >
          Erdal Güda Atölyesi
        </span>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '26px',
            color: '#ffffff',
            fontFamily: "'Georgia', serif",
            fontWeight: 700,
            letterSpacing: '0.3px',
          }}
        >
          Yeni Sipariş Oluşturun
        </h2>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.65)',
            fontFamily: "'Georgia', serif",
            maxWidth: '420px',
            lineHeight: 1.6,
          }}
        >
          Ölçülerinize özel, kişiselleştirilmiş siparişinizi kolayca oluşturun.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/vip/new-order')}
          style={{
            background: 'linear-gradient(135deg, #c9a84c, #e8c96e)',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#152753',
            cursor: 'pointer',
            fontFamily: "'Georgia', serif",
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(201, 168, 76, 0.35)',
            transition: 'all 0.2s',
          }}
        >
          Sipariş Ver →
        </button>
      </div>

      {/* Two column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Orders panel */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e8e4dc',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f0ece4',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#c9a84c',
                fontFamily: "'Georgia', serif",
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Sipariş geçmişi
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '17px',
                color: '#152753',
                fontFamily: "'Georgia', serif",
                fontWeight: 700,
              }}
            >
              Siparişlerim
            </h3>
          </div>

          <div style={{ padding: '12px 0' }}>
            {ordersLoading && <ScissorsSpinner />}
            {ordersError && (
              <div style={{ padding: '16px 24px', color: '#c0392b', fontSize: '13px' }}>{ordersError}</div>
            )}
            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div
                style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '13px',
                  fontFamily: "'Georgia', serif",
                }}
              >
                Henüz siparişiniz bulunmuyor.
              </div>
            )}
            {!ordersLoading &&
              orders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    padding: '14px 24px',
                    borderBottom: '1px solid #f5f3ef',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#152753',
                        fontFamily: "'Georgia', serif",
                      }}
                    >
                      #{order.orderNumber}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        background: '#f0ece4',
                        color: '#152753',
                        fontFamily: "'Georgia', serif",
                      }}
                    >
                      {order.statusLabel ?? order.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#666', fontFamily: "'Georgia', serif" }}>
                    {getProductTypeLabel(order.productType as ProductType)}
                  </span>
                  {order.productionStageName && (
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#c9a84c',
                        fontFamily: "'Georgia', serif",
                        letterSpacing: '0.3px',
                      }}
                    >
                      Üretim: {order.productionStageName}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Measurements panel */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e8e4dc',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f0ece4',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#c9a84c',
                fontFamily: "'Georgia', serif",
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Vücut ölçüleri
            </span>
            <h3
              style={{
                margin: 0,
                fontSize: '17px',
                color: '#152753',
                fontFamily: "'Georgia', serif",
                fontWeight: 700,
              }}
            >
              Ölçülerim
            </h3>
          </div>

          <div style={{ padding: '12px' }}>
            {measurementsLoading && <ScissorsSpinner />}
            {measurementsError && (
              <div style={{ padding: '16px', color: '#c0392b', fontSize: '13px' }}>{measurementsError}</div>
            )}
            {!measurementsLoading && !measurementsError && !latestMeasurementSet && (
              <div
                style={{
                  padding: '32px 24px',
                  textAlign: 'center',
                  color: '#999',
                  fontSize: '13px',
                  fontFamily: "'Georgia', serif",
                }}
              >
                Henüz ölçü kaydı bulunmuyor.
              </div>
            )}
            {!measurementsLoading && latestMeasurementSet && (
              <>
                <div
                  style={{
                    padding: '8px 12px',
                    marginBottom: '8px',
                    background: '#f8f6f2',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#888',
                    fontFamily: "'Georgia', serif",
                  }}
                >
                  Son ölçüm:{' '}
                  {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(
                    new Date(latestMeasurementSet.measuredAt),
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {latestMeasurementSet.values.map((val) => (
                    <div
                      key={val.id}
                      style={{
                        padding: '8px 10px',
                        background: '#fafaf8',
                        borderRadius: '6px',
                        border: '1px solid #f0ece4',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '10px',
                          color: '#999',
                          fontFamily: "'Georgia', serif",
                          marginBottom: '2px',
                        }}
                      >
                        {val.definitionLabel}
                      </div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: '#152753',
                          fontFamily: "'Georgia', serif",
                        }}
                      >
                        {val.numericValue}
                        <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>{val.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
