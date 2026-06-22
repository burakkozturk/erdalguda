import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createVipOrder } from '../../api/vipApi';
import type { VipOrderRequest } from '../../api/vipApi';
import type { ProductType } from '../../types/production';
import { getProductTypeLabel } from '../../types/production';
import type { JacketConfig } from '../../types/jacket';
import type { ShirtConfig } from '../../types/shirt';
import type { PantConfig } from '../../types/pant';
import { DEFAULT_PANT_CONFIG } from '../../types/pant';
import type { VestConfig } from '../../types/vest';
import { DEFAULT_VEST_CONFIG } from '../../types/vest';
import type { TuxedoConfig } from '../../types/tuxedo';
import type { CoatConfig } from '../../types/coat';
import { DEFAULT_COAT_CONFIG, COAT_STYLE_PARAMS } from '../../types/coat';
import JacketConfigurator from '../../components/JacketConfigurator';
import ShirtConfigurator from '../../components/ShirtConfigurator';
import PantConfigurator from '../../components/PantConfigurator';
import VestConfigurator from '../../components/VestConfigurator';
import SuitConfigurator from '../../components/SuitConfigurator';
import TuxedoConfigurator from '../../components/TuxedoConfigurator';
import CoatConfigurator from '../../components/CoatConfigurator';

const PRODUCT_OPTIONS: Array<{ type: ProductType; icon: string }> = [
  { type: 'JACKET', icon: '🧥' },
  { type: 'SUIT', icon: '👔' },
  { type: 'SHIRT', icon: '👕' },
  { type: 'TROUSERS', icon: '👖' },
  { type: 'VEST', icon: '🦺' },
  { type: 'SMOKIN', icon: '🤵' },
  { type: 'PALTO', icon: '🥼' },
];

const DEFAULT_JACKET_CONFIG: JacketConfig = {
  styleKey: '',
  lapelStyle: 'notch',
  lapelWidth: 'standard',
  pocketStyle: 'with_flap',
  fit: 'regular',
  vent: 'single',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};

const DEFAULT_SHIRT_CONFIG: ShirtConfig = {
  collarStyle: 'new-kent',
  collarButtons: '1',
  cuffStyle: 'single-cuff-1-button',
  fit: 'normal',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};

const DEFAULT_TUXEDO_CONFIG: TuxedoConfig = {
  style: 'single_breasted_1',
  lapelStyle: 'notch',
  lapelWidth: 'medium',
  pocketStyle: 'double_welt',
  fabricKey: '2191',
  fabricLabel: 'Karels',
};

const VIEWER_BG = '#070e1c';

export function VipOrderFlow() {
  const navigate = useNavigate();
  const [productType, setProductType] = useState<ProductType>('JACKET');
  const [notes, setNotes] = useState('');
  const [jacketConfig, setJacketConfig] = useState<JacketConfig>(DEFAULT_JACKET_CONFIG);
  const [shirtConfig, setShirtConfig] = useState<ShirtConfig>(DEFAULT_SHIRT_CONFIG);
  const [pantConfig, setPantConfig] = useState<PantConfig>(DEFAULT_PANT_CONFIG);
  const [vestConfig, setVestConfig] = useState<VestConfig>(DEFAULT_VEST_CONFIG);
  const [tuxedoConfig, setTuxedoConfig] = useState<TuxedoConfig>(DEFAULT_TUXEDO_CONFIG);
  const [coatConfig, setCoatConfig] = useState<CoatConfig>(DEFAULT_COAT_CONFIG);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState(false);

  function buildRequest(): VipOrderRequest {
    const base: VipOrderRequest = {
      productType,
      notes: notes || undefined,
    };

    if (productType === 'JACKET') {
      base.jacketStyleKey = jacketConfig.styleKey || undefined;
      base.jacketLapelStyle = jacketConfig.lapelStyle;
      base.jacketLapelWidth = jacketConfig.lapelWidth;
      base.jacketPocketStyle = jacketConfig.pocketStyle;
      base.jacketFit = jacketConfig.fit;
      base.jacketVent = jacketConfig.vent;
      base.jacketFabricKey = jacketConfig.fabricKey || undefined;
      base.jacketFabricLabel = jacketConfig.fabricLabel || undefined;
    } else if (productType === 'SUIT') {
      base.jacketStyleKey = jacketConfig.styleKey || undefined;
      base.jacketLapelStyle = jacketConfig.lapelStyle;
      base.jacketLapelWidth = jacketConfig.lapelWidth;
      base.jacketPocketStyle = jacketConfig.pocketStyle;
      base.jacketFit = jacketConfig.fit;
      base.jacketVent = jacketConfig.vent;
      base.jacketFabricKey = jacketConfig.fabricKey || undefined;
      base.jacketFabricLabel = jacketConfig.fabricLabel || undefined;
      base.pantFasteningStyle = pantConfig.fasteningStyle;
      base.pantPleatStyle = pantConfig.pleatStyle;
      base.pantFit = pantConfig.fit;
      base.pantLegStyle = pantConfig.legStyle;
      base.pantDrape = pantConfig.drape;
      base.pantFabricKey = pantConfig.fabricKey || undefined;
      base.pantFabricLabel = pantConfig.fabricLabel || undefined;
    } else if (productType === 'SHIRT') {
      base.shirtCollarStyle = shirtConfig.collarStyle;
      base.shirtCollarButtons = shirtConfig.collarButtons;
      base.shirtCuffStyle = shirtConfig.cuffStyle;
      base.shirtFit = shirtConfig.fit;
      base.shirtFabricKey = shirtConfig.fabricKey || undefined;
      base.shirtFabricLabel = shirtConfig.fabricLabel || undefined;
    } else if (productType === 'TROUSERS') {
      base.pantFasteningStyle = pantConfig.fasteningStyle;
      base.pantPleatStyle = pantConfig.pleatStyle;
      base.pantFit = pantConfig.fit;
      base.pantLegStyle = pantConfig.legStyle;
      base.pantDrape = pantConfig.drape;
      base.pantFabricKey = pantConfig.fabricKey || undefined;
      base.pantFabricLabel = pantConfig.fabricLabel || undefined;
    } else if (productType === 'VEST') {
      base.vestLapelStyle = vestConfig.stylePrefix;
      base.vestPocketStyle = vestConfig.lapelShape;
      base.vestFabricKey = vestConfig.fabricKey || undefined;
      base.vestFabricLabel = vestConfig.fabricLabel || undefined;
    } else if (productType === 'SMOKIN') {
      base.tuxedoStyle = tuxedoConfig.style;
      base.tuxedoLapelStyle = tuxedoConfig.lapelStyle;
      base.tuxedoLapelWidth = tuxedoConfig.lapelWidth;
      base.tuxedoPocketStyle = tuxedoConfig.pocketStyle;
      base.tuxedoFabricKey = tuxedoConfig.fabricKey || undefined;
      base.tuxedoFabricLabel = tuxedoConfig.fabricLabel || undefined;
    } else if (productType === 'PALTO') {
      const params = COAT_STYLE_PARAMS[coatConfig.style];
      base.coatStyle = params.internalStyle;
      base.coatCollarStyle = params.collarStyle;
      base.coatLapelStyle = coatConfig.lapelStyle;
      base.coatLapelLength = params.lapelLength;
      base.coatLapelWidth = params.lapelWidth;
      base.coatFastening = params.fastening;
      base.coatPocketStyle = params.pocketStyle;
      base.coatFabricKey = coatConfig.fabricKey || undefined;
      base.coatFabricLabel = coatConfig.fabricLabel || undefined;
    }

    return base;
  }

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createVipOrder(buildRequest());
      setOrderSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sipariş oluşturulamadı.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function getFabricLabel(): string {
    switch (productType) {
      case 'SHIRT': return shirtConfig.fabricLabel;
      case 'TROUSERS': return pantConfig.fabricLabel;
      case 'VEST': return vestConfig.fabricLabel;
      case 'SMOKIN': return tuxedoConfig.fabricLabel;
      case 'PALTO': return coatConfig.fabricLabel;
      default: return jacketConfig.fabricLabel;
    }
  }

  if (orderSuccess) {
    return (
      <div
        style={{
          flex: 1,
          background: '#0a192f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '56px 80px',
            border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(212,175,55,0.08)',
              border: '2px solid rgba(212,175,55,0.5)',
              margin: '0 auto 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              color: '#d4af37',
            }}
          >
            ✓
          </div>
          <span
            style={{
              display: 'block',
              fontSize: '9px',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: 'rgba(212,175,55,0.55)',
              fontFamily: "'Georgia', serif",
              marginBottom: '10px',
            }}
          >
            Sipariş Onaylandı
          </span>
          <h2
            style={{
              margin: '0 0 16px',
              color: '#ffffff',
              fontFamily: "'Georgia', serif",
              fontSize: '28px',
              fontWeight: 400,
              letterSpacing: '0.5px',
            }}
          >
            Teşekkürler
          </h2>
          <p
            style={{
              margin: '0 0 40px',
              color: 'rgba(240,236,228,0.55)',
              fontFamily: "'Georgia', serif",
              fontSize: '14px',
              lineHeight: 1.8,
              letterSpacing: '0.2px',
            }}
          >
            Siparişiniz başarıyla iletildi. Atölyemiz detayları inceleyip en kısa sürede sizinle iletişime geçecektir.
          </p>
          <button
            type="button"
            onClick={() => void navigate('/vip')}
            style={{
              background: '#d4af37',
              border: 'none',
              borderRadius: '6px',
              padding: '13px 40px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#0a192f',
              cursor: 'pointer',
              fontFamily: "'Georgia', serif",
              letterSpacing: '0.5px',
            }}
          >
            Portala Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#0a192f',
      }}
    >
      {/* Product type selector bar */}
      <div
        style={{
          flexShrink: 0,
          background: '#0a192f',
          padding: '12px 32px',
          borderBottom: '1px solid rgba(212,175,55,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: 'rgba(212,175,55,0.45)',
            fontFamily: "'Georgia', serif",
            marginRight: '8px',
            flexShrink: 0,
          }}
        >
          Ürün
        </span>
        {PRODUCT_OPTIONS.map(({ type, icon }) => {
          const isSelected = productType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setProductType(type)}
              style={{
                padding: '7px 16px',
                borderRadius: '100px',
                border: isSelected
                  ? '1px solid #d4af37'
                  : '1px solid rgba(255,255,255,0.12)',
                background: isSelected ? '#d4af37' : 'transparent',
                color: isSelected ? '#0a192f' : 'rgba(255,255,255,0.65)',
                fontSize: '12px',
                fontWeight: isSelected ? 700 : 400,
                fontFamily: "'Georgia', serif",
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                letterSpacing: '0.3px',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '14px' }}>{icon}</span>
              <span>{getProductTypeLabel(type)}</span>
            </button>
          );
        })}
      </div>

      {/* Split layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Controls panel */}
        <div
          style={{
            flex: '0 0 42%',
            overflowY: 'auto',
            background: '#0d1b2e',
            borderRight: '1px solid rgba(212,175,55,0.1)',
          }}
        >
          {productType === 'JACKET' && (
            <JacketConfigurator
              value={jacketConfig}
              onChange={setJacketConfig}
              mode="controls-all"
              showUpload={false}
            />
          )}
          {productType === 'SUIT' && (
            <SuitConfigurator
              value={jacketConfig}
              onChange={setJacketConfig}
              pantValue={pantConfig}
              onPantChange={setPantConfig}
              mode="controls-all"
              showUpload={false}
            />
          )}
          {productType === 'SHIRT' && (
            <ShirtConfigurator
              value={shirtConfig}
              onChange={setShirtConfig}
              mode="controls-all"
              showUpload={false}
            />
          )}
          {productType === 'TROUSERS' && (
            <PantConfigurator
              value={pantConfig}
              onChange={setPantConfig}
              mode="controls-only"
              showUpload={false}
            />
          )}
          {productType === 'VEST' && (
            <VestConfigurator
              value={vestConfig}
              onChange={setVestConfig}
              mode="controls-only"
              showUpload={false}
            />
          )}
          {productType === 'SMOKIN' && (
            <TuxedoConfigurator
              value={tuxedoConfig}
              onChange={setTuxedoConfig}
              mode="controls-all"
              showUpload={false}
            />
          )}
          {productType === 'PALTO' && (
            <CoatConfigurator
              value={coatConfig}
              onChange={setCoatConfig}
              mode="controls-all"
              showUpload={false}
            />
          )}

          {/* Notes + Submit */}
          <div
            style={{
              padding: '0 14px 32px',
            }}
          >
            <div
              style={{
                borderTop: '1px solid rgba(212,175,55,0.1)',
                paddingTop: '20px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '20px',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase',
                    color: 'rgba(212,175,55,0.55)',
                    fontFamily: "'Georgia', serif",
                  }}
                >
                  Notlar
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Özel isteklerinizi buraya yazabilirsiniz..."
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(212,175,55,0.18)',
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: '13px',
                    resize: 'vertical',
                    fontFamily: "'Georgia', serif",
                    color: 'rgba(240,236,228,0.85)',
                    outline: 'none',
                  }}
                />
              </label>

              {submitError && (
                <div
                  style={{
                    padding: '12px 14px',
                    background: 'rgba(192,57,43,0.15)',
                    border: '1px solid rgba(192,57,43,0.3)',
                    borderRadius: '6px',
                    color: '#e88080',
                    fontSize: '13px',
                    fontFamily: "'Georgia', serif",
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  {submitError}
                </div>
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
                style={{
                  width: '100%',
                  background: isSubmitting
                    ? 'rgba(212,175,55,0.3)'
                    : 'linear-gradient(135deg, #c9a84c, #d4af37)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '15px 28px',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: isSubmitting ? 'rgba(10,25,47,0.5)' : '#0a192f',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontFamily: "'Georgia', serif",
                  boxShadow: isSubmitting
                    ? 'none'
                    : '0 4px 20px rgba(212,175,55,0.25)',
                  transition: 'all 0.2s',
                }}
              >
                {isSubmitting ? 'Gönderiliyor...' : 'Siparişi Oluştur'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Viewer panel */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            background: VIEWER_BG,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Garment label */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              left: 0,
              right: 0,
              textAlign: 'center',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: 'rgba(212,175,55,0.35)',
                fontFamily: "'Georgia', serif",
              }}
            >
              {getProductTypeLabel(productType)}
            </span>
          </div>

          {/* Viewer fills entire panel */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {productType === 'JACKET' && (
              <JacketConfigurator
                value={jacketConfig}
                onChange={setJacketConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'SUIT' && (
              <SuitConfigurator
                value={jacketConfig}
                onChange={setJacketConfig}
                pantValue={pantConfig}
                onPantChange={setPantConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'SHIRT' && (
              <ShirtConfigurator
                value={shirtConfig}
                onChange={setShirtConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'TROUSERS' && (
              <PantConfigurator
                value={pantConfig}
                onChange={setPantConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'VEST' && (
              <VestConfigurator
                value={vestConfig}
                onChange={setVestConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'SMOKIN' && (
              <TuxedoConfigurator
                value={tuxedoConfig}
                onChange={setTuxedoConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
            {productType === 'PALTO' && (
              <CoatConfigurator
                value={coatConfig}
                onChange={setCoatConfig}
                mode="viewer-only"
                viewerBackground={VIEWER_BG}
              />
            )}
          </div>

          {/* Fabric watermark at bottom */}
          {getFabricLabel() && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: 0,
                right: 0,
                textAlign: 'center',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  color: 'rgba(212,175,55,0.4)',
                  fontFamily: "'Georgia', serif",
                  textTransform: 'uppercase',
                }}
              >
                {getFabricLabel()}
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
