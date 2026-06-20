import { FormEvent, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createExpressRegistration } from '../api/expressRegistrationApi';
import JacketConfigurator from '../components/JacketConfigurator';
import ShirtConfigurator from '../components/ShirtConfigurator';
import SuitConfigurator from '../components/SuitConfigurator';
import PantConfigurator from '../components/PantConfigurator';
import VestConfigurator from '../components/VestConfigurator';
import TuxedoConfigurator from '../components/TuxedoConfigurator';
import { measurementDefinitions } from '../data/measurementDefinitions';
import type { CurrencyType, OrderPaymentStatus } from '../types/order';
import { getCurrencyLabel, getPaymentStatusLabel } from '../types/order';
import type { JacketConfig } from '../types/jacket';
import type { ShirtConfig } from '../types/shirt';
import type { TuxedoConfig } from '../types/tuxedo';
import type { PantConfig } from '../types/pant';
import { DEFAULT_PANT_CONFIG } from '../types/pant';
import type { VestConfig } from '../types/vest';
import { DEFAULT_VEST_CONFIG, vestLapelKey } from '../types/vest';
import type { MeasurementDefinition } from '../types/measurement';
import type { ProductType } from '../types/production';
import { getProductTypeLabel } from '../types/production';
import type { ExpressOrderRequest, ExpressRegistrationResponse } from '../types/expressRegistration';

type Step = 1 | 2;

type CustomerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  heightCm: string;
  weightKg: string;
  address: string;
  notes: string;
};

type OrderForm = {
  productType: ProductType;
  orderDate: string;
  expectedDeliveryDate: string;
  totalAmount: string;
  currency: CurrencyType;
  paymentStatus: OrderPaymentStatus;
  notes: string;
};

type OrderEntry = {
  id: string;
  expanded: boolean;
  form: OrderForm;
  jacketConfig: JacketConfig;
  shirtConfig: ShirtConfig;
  tuxedoConfig: TuxedoConfig;
  vestConfig: VestConfig;
  pantConfig: PantConfig;
};

// ---------------------------------------------------------------------------
// Module-level constants
// ---------------------------------------------------------------------------

const steps: Array<{ number: Step; label: string }> = [
  { number: 1, label: 'Müşteri ve Ölçüler' },
  { number: 2, label: 'Siparişler' },
];

const productTypes: ProductType[] = ['SHIRT', 'JACKET', 'TROUSERS', 'VEST', 'SUIT', 'SMOKIN'];
const currencies: CurrencyType[] = ['TRY', 'USD', 'EUR'];
const paymentStatuses: OrderPaymentStatus[] = ['UNPAID', 'PAID'];

const emptyCustomer: CustomerForm = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  heightCm: '',
  weightKg: '',
  address: '',
  notes: '',
};

const defaultJacketConfig: JacketConfig = {
  styleKey: 'sb-2b-blazer',
  lapelStyle: 'notch',
  lapelWidth: 'standard',
  pocketStyle: 'with_flap',
  fit: 'regular',
  vent: 'single',
  fabricKey: 'karels-navy',
  fabricLabel: 'Karels',
};

const defaultShirtConfig: ShirtConfig = {
  collarStyle: 'new-kent',
  collarButtons: '1',
  cuffStyle: 'single-cuff-1-button',
  fit: 'normal',
  fabricKey: '',
  fabricLabel: '',
};

const defaultTuxedoConfig: TuxedoConfig = {
  style: 'single_breasted_1',
  lapelStyle: 'notch',
  lapelWidth: 'narrow',
  pocketStyle: 'double_welt',
  fabricKey: '2192',
  fabricLabel: 'Karels',
};

function makeEntry(id: string): OrderEntry {
  return {
    id,
    expanded: true,
    form: {
      productType: 'SHIRT',
      orderDate: new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: '',
      totalAmount: '',
      currency: 'TRY',
      paymentStatus: 'UNPAID',
      notes: '',
    },
    jacketConfig: { ...defaultJacketConfig },
    shirtConfig: { ...defaultShirtConfig },
    tuxedoConfig: { ...defaultTuxedoConfig },
    vestConfig: { ...DEFAULT_VEST_CONFIG },
    pantConfig: { ...DEFAULT_PANT_CONFIG },
  };
}

function measurementSections(definitions: MeasurementDefinition[]) {
  return [
    { title: 'Üst Beden', from: 1, to: 19, definitions: definitions.filter((item) => item.order <= 19) },
    { title: 'Sağ Bacak', from: 20, to: 25, definitions: definitions.filter((item) => item.order >= 20) },
  ];
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addOneMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : undefined;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function formatDate(value: string) {
  return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value)) : '-';
}

function formatMoney(value: string, currency: CurrencyType) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount : 0} TL`;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpressRegistrationPage() {
  const [step, setStep] = useState<Step>(1);
  const [customer, setCustomer] = useState<CustomerForm>(emptyCustomer);
  const nextIdRef = useRef(2);
  const [orders, setOrders] = useState<OrderEntry[]>([makeEntry('1')]);
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0, 10));
  const [measurementNotes, setMeasurementNotes] = useState('');
  const [measurementSearch, setMeasurementSearch] = useState('');
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [previewDefinition, setPreviewDefinition] = useState<MeasurementDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ExpressRegistrationResponse | null>(null);

  const enteredCount = useMemo(
    () => measurementDefinitions.filter((definition) => measurementValues[definition.key]?.trim()).length,
    [measurementValues]
  );
  const missingCount = measurementDefinitions.length - enteredCount;

  const filteredDefinitions = useMemo(() => {
    const query = measurementSearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) return measurementDefinitions;
    return measurementDefinitions.filter((definition) => definition.label.toLocaleLowerCase('tr-TR').includes(query));
  }, [measurementSearch]);

  const groupedDefinitions = measurementSections(filteredDefinitions);

  // ── Customer ───────────────────────────────────────────────────────────────

  function updateCustomer<K extends keyof CustomerForm>(field: K, value: CustomerForm[K]) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  // ── Order entries ──────────────────────────────────────────────────────────

  function updateEntryForm(id: string, field: keyof OrderForm, value: OrderForm[keyof OrderForm]) {
    setOrders((prev) => prev.map((e) => e.id === id ? { ...e, form: { ...e.form, [field]: value } } : e));
    setError(null);
  }

  function updateEntryConfig<K extends 'jacketConfig' | 'shirtConfig' | 'tuxedoConfig' | 'vestConfig' | 'pantConfig'>(
    id: string, key: K, value: OrderEntry[K]
  ) {
    setOrders((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  }

  function toggleEntry(id: string) {
    setOrders((prev) => prev.map((e) => e.id === id ? { ...e, expanded: !e.expanded } : e));
  }

  function deleteEntry(id: string) {
    setOrders((prev) => prev.filter((e) => e.id !== id));
  }

  function addOrderEntry() {
    const id = String(nextIdRef.current++);
    setOrders((prev) => [...prev, makeEntry(id)]);
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateCustomer() {
    if (!customer.firstName.trim()) return 'Ad alanı zorunludur.';
    if (!customer.lastName.trim()) return 'Soyad alanı zorunludur.';
    if (!customer.phone.trim()) return 'Telefon alanı zorunludur.';
    if (customer.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return 'Geçerli bir e-posta adresi girin.';
    if (customer.heightCm.trim() && Number(customer.heightCm) <= 0) return 'Boy değeri pozitif olmalıdır.';
    if (customer.weightKg.trim() && Number(customer.weightKg) <= 0) return 'Kilo değeri pozitif olmalıdır.';
    return null;
  }

  function validateOrderEntry(entry: OrderEntry) {
    const { form } = entry;
    if (!form.productType) return 'Ürün tipi seçimi zorunludur.';
    if (!form.currency) return 'Para birimi seçimi zorunludur.';
    if (!form.paymentStatus) return 'Ödeme durumu seçimi zorunludur.';
    if (form.totalAmount.trim() && Number(form.totalAmount) < 0) return 'Fiyat pozitif olmalıdır.';
    return null;
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goNext() {
    setError(null);
    if (step === 1) {
      const err = validateCustomer();
      if (err) { setError(err); return; }
      if (enteredCount === 0 && !window.confirm('Henüz hiçbir ölçü girmediniz. Yine de devam etmek istiyor musunuz?')) return;
      setStep(2);
    }
  }

  function goBack() {
    setError(null);
    setStep((current) => Math.max(1, current - 1) as Step);
  }

  // ── Payload builders ───────────────────────────────────────────────────────

  function buildMeasurementValues() {
    return measurementDefinitions
      .filter((definition) => measurementValues[definition.key]?.trim())
      .map((definition) => ({
        definitionKey: definition.key,
        definitionOrder: definition.order,
        definitionLabel: definition.label,
        numericValue: Number(measurementValues[definition.key]),
        unit: definition.unit,
      }));
  }

  function buildOrderPayload(entry: OrderEntry): ExpressOrderRequest {
    const { form, jacketConfig, shirtConfig, tuxedoConfig, vestConfig, pantConfig } = entry;
    const payload: Record<string, unknown> = {
      productType: form.productType,
      orderDate: optionalText(form.orderDate),
      expectedDeliveryDate: optionalText(form.expectedDeliveryDate),
      totalAmount: optionalNumber(form.totalAmount),
      currency: form.currency,
      paymentStatus: form.paymentStatus,
      notes: optionalText(form.notes),
    };

    if (form.productType === 'JACKET' || form.productType === 'SUIT') {
      Object.assign(payload, {
        jacketStyleKey: jacketConfig.styleKey,
        jacketLapelStyle: jacketConfig.lapelStyle,
        jacketLapelWidth: jacketConfig.lapelWidth,
        jacketPocketStyle: jacketConfig.pocketStyle,
        jacketFabricKey: jacketConfig.fabricKey,
        jacketFabricLabel: jacketConfig.fabricLabel,
        jacketFit: jacketConfig.fit,
        jacketVent: jacketConfig.vent,
      });
    }

    if (form.productType === 'SHIRT') {
      Object.assign(payload, {
        shirtCollarStyle: shirtConfig.collarStyle,
        shirtCollarButtons: shirtConfig.collarButtons,
        shirtCuffStyle: shirtConfig.cuffStyle,
        shirtFabricKey: shirtConfig.fabricKey,
        shirtFabricLabel: shirtConfig.fabricLabel,
        shirtFit: shirtConfig.fit,
      });
    }

    if (form.productType === 'SMOKIN') {
      Object.assign(payload, {
        tuxedoStyle: tuxedoConfig.style,
        tuxedoLapelStyle: tuxedoConfig.lapelStyle,
        tuxedoLapelWidth: tuxedoConfig.lapelWidth,
        tuxedoPocketStyle: tuxedoConfig.pocketStyle,
        tuxedoFabricKey: tuxedoConfig.fabricKey,
        tuxedoFabricLabel: tuxedoConfig.fabricLabel,
      });
    }

    if (form.productType === 'VEST') {
      Object.assign(payload, {
        vestLapelStyle: vestLapelKey(vestConfig),
        vestFabricKey: vestConfig.fabricKey,
        vestFabricLabel: vestConfig.fabricLabel,
      });
    }

    if (form.productType === 'TROUSERS' || form.productType === 'SUIT') {
      Object.assign(payload, {
        pantFasteningStyle: pantConfig.fasteningStyle,
        pantPleatStyle: pantConfig.pleatStyle,
        pantFabricKey: pantConfig.fabricKey,
        pantFabricLabel: pantConfig.fabricLabel,
        pantFit: pantConfig.fit,
        pantLegStyle: pantConfig.legStyle,
        pantDrape: pantConfig.drape,
      });
    }

    return payload as ExpressOrderRequest;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const customerError = validateCustomer();
    if (customerError) { setError(customerError); return; }
    for (const entry of orders) {
      const orderError = validateOrderEntry(entry);
      if (orderError) { setError(orderError); return; }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await createExpressRegistration({
        customer: {
          firstName: customer.firstName.trim(),
          lastName: customer.lastName.trim(),
          phone: customer.phone.trim(),
          email: optionalText(customer.email),
          heightCm: optionalNumber(customer.heightCm),
          weightKg: optionalNumber(customer.weightKg),
          address: optionalText(customer.address),
          notes: optionalText(customer.notes),
        },
        measurement: {
          measuredAt: optionalText(measuredAt),
          notes: optionalText(measurementNotes),
          values: buildMeasurementValues(),
        },
        orders: orders.map(buildOrderPayload),
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Ekspres kayıt tamamlanırken bir sorun oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setCustomer(emptyCustomer);
    nextIdRef.current = 2;
    setOrders([makeEntry('1')]);
    setMeasuredAt(new Date().toISOString().slice(0, 10));
    setMeasurementNotes('');
    setMeasurementSearch('');
    setMeasurementValues({});
    setResult(null);
    setError(null);
  }

  // ── Renderers ──────────────────────────────────────────────────────────────

  function renderConfigurator(entry: OrderEntry) {
    const setJacket = (v: JacketConfig) => updateEntryConfig(entry.id, 'jacketConfig', v);
    const setShirt = (v: ShirtConfig) => updateEntryConfig(entry.id, 'shirtConfig', v);
    const setTuxedo = (v: TuxedoConfig) => updateEntryConfig(entry.id, 'tuxedoConfig', v);
    const setVest = (v: VestConfig) => updateEntryConfig(entry.id, 'vestConfig', v);
    const setPant = (v: PantConfig) => updateEntryConfig(entry.id, 'pantConfig', v);
    const pt = entry.form.productType;

    return (
      <div className="express-configurator-shell">
        <div className="express-configurator-controls">
          {pt === 'JACKET'   && <JacketConfigurator  mode="controls-all"  value={entry.jacketConfig}  onChange={setJacket} />}
          {pt === 'SUIT'     && <SuitConfigurator    mode="controls-all"  value={entry.jacketConfig}  onChange={setJacket}  pantValue={entry.pantConfig} onPantChange={setPant} />}
          {pt === 'SHIRT'    && <ShirtConfigurator   mode="controls-all"  value={entry.shirtConfig}   onChange={setShirt} />}
          {pt === 'SMOKIN'   && <TuxedoConfigurator  mode="controls-all"  value={entry.tuxedoConfig}  onChange={setTuxedo} />}
          {pt === 'VEST'     && <VestConfigurator    mode="controls-only" value={entry.vestConfig}    onChange={setVest} />}
          {pt === 'TROUSERS' && <PantConfigurator    mode="controls-only" value={entry.pantConfig}    onChange={setPant} />}
        </div>
        <div className="express-configurator-viewer">
          {pt === 'JACKET'   && <JacketConfigurator  mode="viewer-only"   value={entry.jacketConfig}  onChange={setJacket} />}
          {pt === 'SUIT'     && <SuitConfigurator    mode="viewer-only"   value={entry.jacketConfig}  onChange={setJacket}  pantValue={entry.pantConfig} onPantChange={setPant} />}
          {pt === 'SHIRT'    && <ShirtConfigurator   mode="viewer-only"   value={entry.shirtConfig}   onChange={setShirt} />}
          {pt === 'SMOKIN'   && <TuxedoConfigurator  mode="viewer-only"   value={entry.tuxedoConfig}  onChange={setTuxedo} />}
          {pt === 'VEST'     && <VestConfigurator    mode="viewer-only"   value={entry.vestConfig}    onChange={setVest} />}
          {pt === 'TROUSERS' && <PantConfigurator    mode="viewer-only"   value={entry.pantConfig}    onChange={setPant} />}
        </div>
      </div>
    );
  }

  function renderOrderEntry(entry: OrderEntry, index: number) {
    return (
      <div
        key={entry.id}
        style={{ border: '1px solid #E0DDD8', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}
      >
        {/* Accordion header */}
        <div
          role="button"
          tabIndex={0}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            cursor: 'pointer',
            background: entry.expanded ? '#FAF9F6' : '#F5F4F0',
            userSelect: 'none',
          }}
          onClick={() => toggleEntry(entry.id)}
          onKeyDown={(e) => e.key === 'Enter' && toggleEntry(entry.id)}
        >
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888', display: 'block' }}>
              Sipariş {index + 1}
            </span>
            <strong style={{ fontSize: 14, color: '#1a1a1a' }}>{getProductTypeLabel(entry.form.productType)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {orders.length > 1 && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, padding: '4px 12px' }}
                onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id); }}
              >
                Sil
              </button>
            )}
            <span style={{ fontSize: 12, color: '#aaa' }}>{entry.expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Accordion body */}
        {entry.expanded && (
          <div>
            <div style={{ padding: '16px 18px 0' }}>
              <div className="form-grid express-order-form">
                <label className="field">
                  <span>Ürün Tipi <em>Zorunlu</em></span>
                  <select
                    value={entry.form.productType}
                    onChange={(e) => updateEntryForm(entry.id, 'productType', e.target.value as ProductType)}
                  >
                    {productTypes.map((type) => <option value={type} key={type}>{getProductTypeLabel(type)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Sipariş Tarihi</span>
                  <input
                    type="date"
                    value={entry.form.orderDate}
                    onChange={(e) => updateEntryForm(entry.id, 'orderDate', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Teslim Tarihi</span>
                  <input
                    type="date"
                    value={entry.form.expectedDeliveryDate}
                    onChange={(e) => updateEntryForm(entry.id, 'expectedDeliveryDate', e.target.value)}
                  />
                  <div className="quick-date-actions">
                    <button type="button" onClick={() => updateEntryForm(entry.id, 'expectedDeliveryDate', addDays(10))}>10 Gün</button>
                    <button type="button" onClick={() => updateEntryForm(entry.id, 'expectedDeliveryDate', addDays(15))}>15 Gün</button>
                    <button type="button" onClick={() => updateEntryForm(entry.id, 'expectedDeliveryDate', addOneMonth())}>1 Ay</button>
                  </div>
                </label>
                <label className="field">
                  <span>Fiyat</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.form.totalAmount}
                    onChange={(e) => updateEntryForm(entry.id, 'totalAmount', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Para Birimi <em>Zorunlu</em></span>
                  <select
                    value={entry.form.currency}
                    onChange={(e) => updateEntryForm(entry.id, 'currency', e.target.value as CurrencyType)}
                  >
                    {currencies.map((currency) => <option value={currency} key={currency}>{getCurrencyLabel(currency)}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Ödeme Durumu <em>Zorunlu</em></span>
                  <select
                    value={entry.form.paymentStatus}
                    onChange={(e) => updateEntryForm(entry.id, 'paymentStatus', e.target.value as OrderPaymentStatus)}
                  >
                    {paymentStatuses.map((status) => <option value={status} key={status}>{getPaymentStatusLabel(status)}</option>)}
                  </select>
                </label>
                <label className="field wide">
                  <span>Sipariş Notu</span>
                  <textarea
                    rows={3}
                    value={entry.form.notes}
                    onChange={(e) => updateEntryForm(entry.id, 'notes', e.target.value)}
                  />
                </label>
              </div>
            </div>
            {renderConfigurator(entry)}
          </div>
        )}
      </div>
    );
  }

  // ── Success screen ─────────────────────────────────────────────────────────

  if (result) {
    return (
      <section className="express-page">
        <div className="express-success-panel">
          <span className="eyebrow">Ekspres Kayıt</span>
          <h2>Ekspres kayıt tamamlandı</h2>
          <p>{result.message}</p>
          <div className="express-result-grid">
            <span>Müşteri<strong>{result.customerFullName}</strong></span>
          </div>
          {result.orders.map((o, i) => (
            <div key={o.orderNumber} className="express-result-grid" style={{ marginTop: 8 }}>
              <span>Sipariş {i + 1}<strong>{o.orderNumber}</strong></span>
              <span>Üretim İşi<strong>{o.productionJobNumber}</strong></span>
              <span>Aşama<strong>{o.productionStageName}</strong></span>
            </div>
          ))}
          <div className="form-actions">
            <Link className="primary-button" to="/admin/workflow">Üretim Takibine Git</Link>
            <Link className="ghost-button" to="/admin/customers">Müşteri Listesine Git</Link>
            <button className="ghost-button" type="button" onClick={resetWizard}>Yeni Ekspres Kayıt</button>
          </div>
        </div>
      </section>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <section className="express-page">
      <div className="page-header express-hero">
        <div className="section-heading">
          <span className="eyebrow">Hızlı atölye akışı</span>
          <h2>Ekspres Kayıt</h2>
          <p>Kapıdan ilk kez gelen müşteri için müşteri kaydı, ölçü alma ve sipariş oluşturma adımlarını tek akışta tamamlayın.</p>
        </div>
      </div>

      <div className="express-stepper">
        {steps.map((item) => (
          <button
            type="button"
            key={item.number}
            className={item.number === step ? 'active' : item.number < step ? 'completed' : ''}
            onClick={() => item.number < step && setStep(item.number)}
          >
            <span>{item.number}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </div>

      {error && <div className="state-message error dashboard-state">{error}</div>}

      <form className="express-step-card" onSubmit={handleSubmit}>

        {/* ── Step 1: Customer + Measurements ── */}
        {step === 1 && (
          <>
            <div className="express-form-block">
              <div className="section-header">
                <div>
                  <span className="eyebrow">1. Adım</span>
                  <h2>Müşteri Bilgileri</h2>
                </div>
              </div>
              <div className="form-grid express-customer-form">
                <label className="field"><span>Ad <em>Zorunlu</em></span><input value={customer.firstName} onChange={(e) => updateCustomer('firstName', e.target.value)} /></label>
                <label className="field"><span>Soyad <em>Zorunlu</em></span><input value={customer.lastName} onChange={(e) => updateCustomer('lastName', e.target.value)} /></label>
                <label className="field"><span>Telefon <em>Zorunlu</em></span><input value={customer.phone} onChange={(e) => updateCustomer('phone', e.target.value)} /></label>
                <label className="field"><span>E-posta</span><input type="email" value={customer.email} onChange={(e) => updateCustomer('email', e.target.value)} /></label>
                <label className="field"><span>Boy (cm)</span><input type="number" min="0" step="0.1" value={customer.heightCm} onChange={(e) => updateCustomer('heightCm', e.target.value)} /></label>
                <label className="field"><span>Kilo (kg)</span><input type="number" min="0" step="0.1" value={customer.weightKg} onChange={(e) => updateCustomer('weightKg', e.target.value)} /></label>
                <label className="field wide"><span>Adres</span><textarea rows={3} value={customer.address} onChange={(e) => updateCustomer('address', e.target.value)} /></label>
                <label className="field wide"><span>Notlar</span><textarea rows={3} value={customer.notes} onChange={(e) => updateCustomer('notes', e.target.value)} /></label>
              </div>
            </div>

            <div className="express-form-block">
              <div className="section-header">
                <div>
                  <span className="eyebrow">1. Adım</span>
                  <h2>Ölçü Alma</h2>
                </div>
                <div className="measurement-progress">
                  <strong>Girilen Ölçü: {enteredCount} / {measurementDefinitions.length}</strong>
                  <span>Eksik Ölçü: {missingCount}</span>
                </div>
              </div>
              <div className="measurement-toolbar">
                <label className="field"><span>Ölçüm Tarihi</span><input type="date" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} /></label>
                <label className="field"><span>Ölçü Ara</span><input value={measurementSearch} onChange={(e) => setMeasurementSearch(e.target.value)} placeholder="Ölçü adı yazın" /></label>
              </div>
              <label className="field">
                <span>Genel Ölçü Notu</span>
                <textarea rows={3} value={measurementNotes} onChange={(e) => setMeasurementNotes(e.target.value)} />
              </label>
              {groupedDefinitions.map((section) => (
                <section className="measurement-section" key={section.title}>
                  <div className="section-header">
                    <div>
                      <span className="eyebrow">{section.from}-{section.to}</span>
                      <h2>{section.title}</h2>
                    </div>
                  </div>
                  <div className="measurement-card-grid">
                    {section.definitions.map((definition) => (
                      <article className="measurement-card" key={definition.key}>
                        <div className="measurement-card-header">
                          <span>{definition.order}</span>
                          <strong>{definition.label}</strong>
                        </div>
                        <button className="measurement-image-button" type="button" onClick={() => setPreviewDefinition(definition)}>
                          {definition.imageSrc ? <img src={definition.imageSrc} alt={definition.label} /> : <span>Görsel yok</span>}
                        </button>
                        <div className="measurement-card-body">
                          <label>
                            <span>Ölçü Değeri</span>
                            <div className="measurement-value-field">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                inputMode="decimal"
                                placeholder="Örn. 42.5"
                                value={measurementValues[definition.key] ?? ''}
                                onChange={(e) => setMeasurementValues((current) => ({ ...current, [definition.key]: e.target.value }))}
                              />
                              <em>{definition.unit}</em>
                            </div>
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Orders ── */}
        {step === 2 && (
          <>
            <div className="express-form-block">
              <div className="section-header">
                <div>
                  <span className="eyebrow">2. Adım</span>
                  <h2>Siparişler ve Konfigürasyon</h2>
                </div>
              </div>

              {orders.map((entry, index) => renderOrderEntry(entry, index))}

              <div style={{ marginTop: 8 }}>
                <button type="button" className="ghost-button" onClick={addOrderEntry}>
                  + Yeni Ürün Ekle
                </button>
              </div>
            </div>

            <div className="express-form-block">
              <div className="section-header">
                <div>
                  <span className="eyebrow">Kontrol</span>
                  <h2>Kayıt Özeti</h2>
                </div>
              </div>
              <div className="express-summary-grid">
                <article>
                  <span className="eyebrow">Müşteri</span>
                  <h3>{customer.firstName} {customer.lastName}</h3>
                  <p>{customer.phone}</p>
                  <p>{customer.heightCm || '-'} cm / {customer.weightKg || '-'} kg</p>
                </article>
                <article>
                  <span className="eyebrow">Ölçü</span>
                  <h3>{formatDate(measuredAt)}</h3>
                  <p>Girilen Ölçü: {enteredCount}</p>
                  <p>Eksik Ölçü: {missingCount}</p>
                  <p>{measurementNotes || '-'}</p>
                </article>
                {orders.map((entry, i) => (
                  <article key={entry.id}>
                    <span className="eyebrow">Sipariş {i + 1}</span>
                    <h3>{getProductTypeLabel(entry.form.productType)}</h3>
                    <p>Teslim: {formatDate(entry.form.expectedDeliveryDate)}</p>
                    <p>{formatMoney(entry.form.totalAmount, entry.form.currency)}</p>
                    <p>{getPaymentStatusLabel(entry.form.paymentStatus)}</p>
                    <p>{entry.form.notes || '-'}</p>
                  </article>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="form-actions express-actions">
          {step > 1 && <button className="ghost-button" type="button" onClick={goBack}>Geri</button>}
          {step < 2 && <button className="primary-button" type="button" onClick={goNext}>Siparişlere Geç</button>}
          {step === 2 && (
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Tamamlanıyor...' : 'Ekspres Kaydı Tamamla'}
            </button>
          )}
        </div>
      </form>

      {previewDefinition && (
        <button className="measurement-preview" type="button" onClick={() => setPreviewDefinition(null)}>
          <span className="measurement-preview-panel">
            <strong>{previewDefinition.order}. {previewDefinition.label}</strong>
            {previewDefinition.imageSrc && <img src={previewDefinition.imageSrc} alt={previewDefinition.label} />}
          </span>
        </button>
      )}
    </section>
  );
}
