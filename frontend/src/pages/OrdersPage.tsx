import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import { createOrder, deleteOrder, listOrders, updateOrder } from '../api/orderApi';
import { getCustomers } from '../api/customerApi';
import { PrintLabelModal } from '../components/PrintLabelModal';
import JacketConfigurator from '../components/JacketConfigurator';
import SuitConfigurator from '../components/SuitConfigurator';
import ShirtConfigurator from '../components/ShirtConfigurator';
import TuxedoConfigurator from '../components/TuxedoConfigurator';
import VestConfigurator from '../components/VestConfigurator';
import PantConfigurator from '../components/PantConfigurator';
import CoatConfigurator from '../components/CoatConfigurator';
import type { Customer } from '../types/customer';
import type { JacketConfig } from '../types/jacket';
import type { ShirtConfig } from '../types/shirt';
import type { TuxedoConfig, TuxedoStyle, LapelStyle, LapelWidth, PocketStyle } from '../types/tuxedo';
import type { VestConfig, VestLapelShape, VestLapelWidth, VestStylePrefix } from '../types/vest';
import { DEFAULT_VEST_CONFIG, vestLapelKey } from '../types/vest';
import type { PantConfig, PantFasteningStyle, PantPleatStyle } from '../types/pant';
import { DEFAULT_PANT_CONFIG } from '../types/pant';
import type { CoatConfig, CoatLapelStyle } from '../types/coat';
import { DEFAULT_COAT_CONFIG, COAT_STYLE_PARAMS, inferCoatStyle } from '../types/coat';
import type { CurrencyType, Order, OrderPaymentStatus, OrderRequest } from '../types/order';
import type { ProductType } from '../types/production';
import { getCurrencyLabel, getPaymentStatusLabel } from '../types/order';
import { getProductTypeLabel } from '../types/production';
import {
  getConfiguratorLabel,
  getJacketStyleLabel,
  getPocketLabel,
  COAT_LAPEL_STYLE_LABELS,
  COAT_STYLE_LABELS,
  JACKET_FIT_LABELS,
  JACKET_LAPEL_WIDTH_LABELS,
  JACKET_VENT_LABELS,
  LAPEL_STYLE_LABELS,
  PANT_DRAPE_LABELS,
  PANT_FASTENING_LABELS,
  PANT_FIT_LABELS,
  PANT_LEG_STYLE_LABELS,
  PANT_PLEAT_LABELS,
  SHIRT_COLLAR_LABELS,
  SHIRT_CUFF_LABELS,
  SHIRT_FIT_LABELS,
  TUXEDO_STYLE_LABELS,
  VEST_LAPEL_SHAPE_LABELS,
  VEST_LAPEL_WIDTH_LABELS,
  VEST_STYLE_LABELS,
} from '../data/configuratorLabels';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Smokin (TUXEDO/SMOKIN) is intentionally excluded from the admin order
// creation menu; it remains visible to public visitors only.
const productTypes: ProductType[] = ['SHIRT', 'JACKET', 'TROUSERS', 'VEST', 'SUIT', 'PALTO'];
const currencies: CurrencyType[] = ['TRY', 'USD', 'EUR'];
const paymentStatuses: OrderPaymentStatus[] = ['UNPAID', 'PAID'];

const BG_PRESETS = [
  { label: 'Lacivert',       value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  { label: 'Açık Nardo Gri', value: 'linear-gradient(135deg, #d4d6d8 0%, #c5c7c9 50%, #b6b8ba 100%)' },
  { label: 'Açık Sarı',      value: 'linear-gradient(135deg, #fff8d4 0%, #fff2b8 50%, #ffe98a 100%)' },
  { label: 'Beyaz',          value: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)' },
] as const;

const defaultJacketConfig: JacketConfig = {
  styleKey: 'sb-2b-blazer',
  lapelStyle: 'notch',
  lapelWidth: 'standard',
  pocketStyle: 'with_flap',
  fabricKey: 'karels-navy',
  fabricLabel: 'Karels',
};

const defaultShirtConfig: ShirtConfig = {
  collarStyle: 'new-kent',
  collarButtons: '1',
  cuffStyle: 'single-cuff-1-button',
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

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

type FormState = {
  customerId: string;
  productType: ProductType;
  expectedDeliveryDate: string;
  totalAmount: string;
  currency: CurrencyType;
  paymentStatus: OrderPaymentStatus;
  notes: string;
  jacketConfig: JacketConfig | null;
  shirtConfig: ShirtConfig | null;
  tuxedoConfig: TuxedoConfig | null;
  vestConfig: VestConfig | null;
  pantConfig: PantConfig | null;
  coatConfig: CoatConfig | null;
};

const emptyForm: FormState = {
  customerId: '',
  productType: 'SHIRT',
  expectedDeliveryDate: '',
  totalAmount: '',
  currency: 'TRY',
  paymentStatus: 'UNPAID',
  notes: '',
  jacketConfig: null,
  shirtConfig: null,
  tuxedoConfig: null,
  vestConfig: DEFAULT_VEST_CONFIG,
  pantConfig: DEFAULT_PANT_CONFIG,
  coatConfig: DEFAULT_COAT_CONFIG,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value))
    : '-';
}

function normalizeCurrency(value: unknown): CurrencyType {
  if (value === 'USD') return 'USD';
  if (value === 'EUR') return 'EUR';
  return 'TRY';
}

function normalizePaymentStatus(value: unknown): OrderPaymentStatus {
  return value === 'PAID' ? 'PAID' : 'UNPAID';
}

function formatMoney(value: number | null | undefined, currency: unknown) {
  const safeAmount = Number(value ?? 0);
  const amount = Number.isFinite(safeAmount) ? safeAmount : 0;
  const safeCurrency = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: safeCurrency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${amount} TL`;
  }
}

function getConfiguratorSummaryItems(form: FormState): Array<{ label: string; value: string }> {
  if ((form.productType === 'JACKET' || form.productType === 'SUIT') && form.jacketConfig) {
    const config = form.jacketConfig;
    const items = [
      { label: 'Stil', value: getJacketStyleLabel(config.styleKey) },
      { label: 'Yaka', value: getConfiguratorLabel(LAPEL_STYLE_LABELS, config.lapelStyle) },
      { label: 'Genişlik', value: getConfiguratorLabel(JACKET_LAPEL_WIDTH_LABELS, config.lapelWidth) },
      { label: 'Cep', value: getPocketLabel(config.pocketStyle) },
      { label: 'Kesim', value: getConfiguratorLabel(JACKET_FIT_LABELS, config.fit ?? 'regular') },
      { label: 'Yırtmaç', value: getConfiguratorLabel(JACKET_VENT_LABELS, config.vent ?? 'single') },
    ];

    if (form.productType === 'SUIT' && form.pantConfig) {
      const pant = form.pantConfig;
      items.push(
        { label: 'Pantolon Bel', value: getConfiguratorLabel(PANT_FASTENING_LABELS, pant.fasteningStyle) },
        { label: 'Pantolon Pile', value: getConfiguratorLabel(PANT_PLEAT_LABELS, pant.pleatStyle) },
        { label: 'Pantolon Fit', value: getConfiguratorLabel(PANT_FIT_LABELS, pant.fit ?? 'normal') },
        { label: 'Pantolon Paça', value: getConfiguratorLabel(PANT_LEG_STYLE_LABELS, pant.legStyle ?? 'straight') },
        { label: 'Pantolon Döküm', value: getConfiguratorLabel(PANT_DRAPE_LABELS, pant.drape ?? 'none') },
      );
    }

    return items;
  }

  if (form.productType === 'SHIRT' && form.shirtConfig) {
    const config = form.shirtConfig;
    return [
      { label: 'Yaka', value: getConfiguratorLabel(SHIRT_COLLAR_LABELS, config.collarStyle) },
      { label: 'Yaka Düğmesi', value: `${config.collarButtons} Düğme` },
      { label: 'Manşet', value: getConfiguratorLabel(SHIRT_CUFF_LABELS, config.cuffStyle) },
      { label: 'Kesim', value: getConfiguratorLabel(SHIRT_FIT_LABELS, config.fit ?? 'normal') },
    ];
  }

  if (form.productType === 'SMOKIN' && form.tuxedoConfig) {
    const config = form.tuxedoConfig;
    return [
      { label: 'Stil', value: getConfiguratorLabel(TUXEDO_STYLE_LABELS, config.style) },
      { label: 'Yaka', value: getConfiguratorLabel(LAPEL_STYLE_LABELS, config.lapelStyle) },
      { label: 'Genişlik', value: getConfiguratorLabel(JACKET_LAPEL_WIDTH_LABELS, config.lapelWidth) },
      { label: 'Cep', value: getPocketLabel(config.pocketStyle) },
    ];
  }

  if (form.productType === 'VEST' && form.vestConfig) {
    const config = form.vestConfig;
    return [
      { label: 'Stil', value: getConfiguratorLabel(VEST_STYLE_LABELS, config.stylePrefix) },
      { label: 'Yaka', value: getConfiguratorLabel(VEST_LAPEL_SHAPE_LABELS, config.lapelShape) },
      { label: 'Genişlik', value: getConfiguratorLabel(VEST_LAPEL_WIDTH_LABELS, config.lapelWidth) },
    ];
  }

  if (form.productType === 'TROUSERS' && form.pantConfig) {
    const config = form.pantConfig;
    return [
      { label: 'Kapama', value: getConfiguratorLabel(PANT_FASTENING_LABELS, config.fasteningStyle) },
      { label: 'Pile', value: getConfiguratorLabel(PANT_PLEAT_LABELS, config.pleatStyle) },
      { label: 'Kesim', value: getConfiguratorLabel(PANT_FIT_LABELS, config.fit ?? 'normal') },
      { label: 'Paça', value: getConfiguratorLabel(PANT_LEG_STYLE_LABELS, config.legStyle ?? 'straight') },
      { label: 'Döküm', value: getConfiguratorLabel(PANT_DRAPE_LABELS, config.drape ?? 'none') },
    ];
  }

  if (form.productType === 'PALTO' && form.coatConfig) {
    const config = form.coatConfig;
    const hasLapel = COAT_STYLE_PARAMS[config.style].hasLapel;
    return [
      { label: 'Stil', value: getConfiguratorLabel(COAT_STYLE_LABELS, config.style) },
      ...(hasLapel ? [{ label: 'Yaka', value: getConfiguratorLabel(COAT_LAPEL_STYLE_LABELS, config.lapelStyle) }] : []),
    ];
  }

  return [];
}

function parseVestLapelKey(key: string): { stylePrefix: VestStylePrefix; lapelWidth: VestLapelWidth; lapelShape: VestLapelShape } {
  if (key.endsWith('-shawl') || key.endsWith('-no')) {
    const lapelShape: VestLapelShape = key.endsWith('-no') ? 'no' : 'shawl';
    const stylePrefix = key.replace(/-shawl$/, '').replace(/-no$/, '') as VestStylePrefix;
    return { stylePrefix, lapelWidth: 'medium', lapelShape };
  }
  const parts = key.split('-');
  const stylePrefix = (parts[0] + '-' + parts[1]) as VestStylePrefix;
  const lapelWidth = parts[2] as VestLapelWidth;
  const lapelShape = parts[3] as VestLapelShape;
  return { stylePrefix, lapelWidth, lapelShape };
}

function toForm(order: Order): FormState {
  const jacketConfig: JacketConfig | null = order.jacketStyleKey
    ? {
        styleKey: order.jacketStyleKey,
        lapelStyle: order.jacketLapelStyle ?? 'notch',
        lapelWidth: order.jacketLapelWidth ?? 'standard',
        pocketStyle: order.jacketPocketStyle ?? 'with_flap',
        // Data-only — restore from persisted order if present.
        fit:  (order.jacketFit  as JacketConfig['fit'])  ?? 'regular',
        vent: (order.jacketVent as JacketConfig['vent']) ?? 'single',
        fabricKey: order.jacketFabricKey ?? '',
        fabricLabel: order.jacketFabricLabel ?? '',
      }
    : null;
  const shirtConfig: ShirtConfig | null = order.shirtFabricKey
    ? {
        collarStyle: order.shirtCollarStyle ?? 'new-kent',
        collarButtons: (order.shirtCollarButtons as '1' | '2') ?? '1',
        cuffStyle: order.shirtCuffStyle ?? 'single-cuff-1-button',
        fit: (order.shirtFit as ShirtConfig['fit']) ?? 'normal',
        fabricKey: order.shirtFabricKey ?? '',
        fabricLabel: order.shirtFabricLabel ?? '',
      }
    : null;
  const tuxedoConfig: TuxedoConfig | null = order.tuxedoStyle
    ? {
        style: (order.tuxedoStyle as TuxedoStyle) ?? 'single_breasted_1',
        lapelStyle: (order.tuxedoLapelStyle as LapelStyle) ?? 'notch',
        lapelWidth: (order.tuxedoLapelWidth as LapelWidth) ?? 'narrow',
        pocketStyle: (order.tuxedoPocketStyle as PocketStyle) ?? 'double_welt',
        fabricKey: order.tuxedoFabricKey ?? '2192',
        fabricLabel: order.tuxedoFabricLabel ?? 'Karels Tuxedo',
      }
    : null;
  const vestConfig: VestConfig | null = order.vestFabricKey
    ? {
        ...parseVestLapelKey(order.vestLapelStyle ?? 'single-4btn-medium-notch'),
        fabricKey: order.vestFabricKey ?? '',
        fabricLabel: order.vestFabricLabel ?? '',
      }
    : null;
  const pantConfig: PantConfig | null = order.pantFabricKey || order.productType === 'SUIT'
    ? {
        fasteningStyle: (order.pantFasteningStyle as PantFasteningStyle) ?? 'centered',
        pleatStyle: (order.pantPleatStyle as PantPleatStyle) ?? 'none',
        // Data-only — restore from persisted order.
        fit:      (order.pantFit      as PantConfig['fit'])      ?? 'normal',
        legStyle: (order.pantLegStyle as PantConfig['legStyle']) ?? 'straight',
        drape:    (order.pantDrape    as PantConfig['drape'])    ?? 'none',
        fabricKey: order.pantFabricKey ?? order.jacketFabricKey ?? DEFAULT_PANT_CONFIG.fabricKey,
        fabricLabel: order.pantFabricLabel ?? order.jacketFabricLabel ?? DEFAULT_PANT_CONFIG.fabricLabel,
      }
    : null;
  const coatConfig: CoatConfig | null = order.coatFabricKey
    ? {
        style: inferCoatStyle(order.coatStyle, order.coatCollarStyle, order.coatLapelLength),
        lapelStyle: (order.coatLapelStyle as CoatLapelStyle) ?? 'peak',
        fabricKey: order.coatFabricKey ?? '',
        fabricLabel: order.coatFabricLabel ?? '',
      }
    : null;
  return {
    customerId: String(order.customerId),
    productType: order.productType,
    expectedDeliveryDate: order.expectedDeliveryDate ?? '',
    totalAmount: String(order.totalAmount ?? ''),
    currency: normalizeCurrency(order.currency),
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    notes: order.notes ?? '',
    jacketConfig,
    shirtConfig,
    tuxedoConfig,
    vestConfig,
    pantConfig,
    coatConfig,
  };
}

function toPayload(form: FormState): OrderRequest {
  const payload: OrderRequest = {
    customerId: Number(form.customerId),
    productType: form.productType,
    orderDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: form.expectedDeliveryDate || undefined,
    totalAmount: form.totalAmount ? Number(form.totalAmount) : 0,
    currency: form.currency,
    paymentStatus: form.paymentStatus,
    notes: form.notes.trim() || undefined,
  };
  // JACKET and SUIT share the same set of persisted columns — the only
  // difference is which manifest the configurator renders against.
  if (
    (form.productType === 'JACKET' || form.productType === 'SUIT') &&
    form.jacketConfig
  ) {
    const jc = form.jacketConfig;
    payload.jacketStyleKey = jc.styleKey;
    payload.jacketLapelStyle = jc.lapelStyle;
    payload.jacketLapelWidth = jc.lapelWidth;
    payload.jacketPocketStyle = jc.pocketStyle;
    payload.jacketFabricKey = jc.fabricKey;
    payload.jacketFabricLabel = jc.fabricLabel;
    // Data-only: Fit + Yırtmaç (does not influence rendered layers).
    if (jc.fit)  payload.jacketFit  = jc.fit;
    if (jc.vent) payload.jacketVent = jc.vent;
  }
  if (form.productType === 'SHIRT' && form.shirtConfig) {
    const sc = form.shirtConfig;
    payload.shirtCollarStyle = sc.collarStyle;
    payload.shirtCollarButtons = sc.collarButtons;
    payload.shirtCuffStyle = sc.cuffStyle;
    payload.shirtFabricKey = sc.fabricKey;
    payload.shirtFabricLabel = sc.fabricLabel;
    // Data-only: Fit (no visual effect).
    if (sc.fit) payload.shirtFit = sc.fit;
  }
  if (form.productType === 'SMOKIN' && form.tuxedoConfig) {
    const tc = form.tuxedoConfig;
    payload.tuxedoStyle = tc.style;
    payload.tuxedoLapelStyle = tc.lapelStyle;
    payload.tuxedoLapelWidth = tc.lapelWidth;
    payload.tuxedoPocketStyle = tc.pocketStyle;
    payload.tuxedoFabricKey = tc.fabricKey;
    payload.tuxedoFabricLabel = tc.fabricLabel;
  }
  if (form.productType === 'VEST' && form.vestConfig) {
    const vc = form.vestConfig;
    payload.vestLapelStyle  = vestLapelKey(vc) ?? '';
    payload.vestFabricKey   = vc.fabricKey;
    payload.vestFabricLabel = vc.fabricLabel;
  }
  if (form.productType === 'TROUSERS' && form.pantConfig) {
    const pc = form.pantConfig;
    payload.pantFasteningStyle = pc.fasteningStyle;
    payload.pantPleatStyle     = pc.pleatStyle;
    payload.pantFabricKey      = pc.fabricKey;
    payload.pantFabricLabel    = pc.fabricLabel;
    // Data-only: Fit / paça / dökum (no visual effect).
    if (pc.fit)      payload.pantFit      = pc.fit;
    if (pc.legStyle) payload.pantLegStyle = pc.legStyle;
    if (pc.drape)    payload.pantDrape    = pc.drape;
  }
  if (form.productType === 'PALTO' && form.coatConfig) {
    const cc = form.coatConfig;
    const params = COAT_STYLE_PARAMS[cc.style];
    payload.coatStyle       = params.internalStyle;
    payload.coatCollarStyle = params.collarStyle;
    payload.coatLapelStyle  = cc.lapelStyle;
    payload.coatLapelLength = params.lapelLength;
    payload.coatLapelWidth  = params.lapelWidth;
    payload.coatFastening   = params.fastening;
    payload.coatPocketStyle = params.pocketStyle;
    payload.coatFabricKey   = cc.fabricKey;
    payload.coatFabricLabel = cc.fabricLabel;
  }
  // Suit (Takım Elbise) carries BOTH jacket + pant data-only fields.
  if (form.productType === 'SUIT' && form.pantConfig) {
    const pc = form.pantConfig;
    payload.pantFasteningStyle = pc.fasteningStyle;
    payload.pantPleatStyle     = pc.pleatStyle;
    payload.pantFabricKey      = pc.fabricKey;
    payload.pantFabricLabel    = pc.fabricLabel;
    if (pc.fit)      payload.pantFit      = pc.fit;
    if (pc.legStyle) payload.pantLegStyle = pc.legStyle;
    if (pc.drape)    payload.pantDrape    = pc.drape;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Shared wizard style constants
// ---------------------------------------------------------------------------

const WZ_INPUT: CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  font: 'inherit',
  boxSizing: 'border-box',
};

const WZ_LABEL: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-faint)',
  marginBottom: 8,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [viewerBg, setViewerBg] = useState<string>(BG_PRESETS[0].value);
  const [labelOrder, setLabelOrder] = useState<Order | null>(null);

  const formPricePreview = useMemo(
    () => formatMoney(Number(form.totalAmount) || 0, form.currency),
    [form.totalAmount, form.currency],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === form.customerId),
    [customers, form.customerId],
  );

  async function loadPage() {
    setIsLoading(true);
    setError(null);
    try {
      const [orderResponse, customerResponse] = await Promise.all([
        listOrders(),
        getCustomers(),
      ]);
      setOrders(orderResponse);
      setCustomers(customerResponse);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Siparişler yüklenemedi.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function handleProductTypeChange(newType: ProductType) {
    setForm((prev) => ({
      ...prev,
      productType: newType,
      // JACKET + SUIT share the jacketConfig shape (and DB columns); the
      // configurator just renders against a different garment manifest.
      jacketConfig:
        newType === 'JACKET' || newType === 'SUIT'
          ? (prev.jacketConfig ?? defaultJacketConfig)
          : null,
      shirtConfig: newType === 'SHIRT' ? (prev.shirtConfig ?? defaultShirtConfig) : null,
      tuxedoConfig: newType === 'SMOKIN' ? (prev.tuxedoConfig ?? defaultTuxedoConfig) : null,
      vestConfig: newType === 'VEST' ? (prev.vestConfig ?? DEFAULT_VEST_CONFIG) : prev.vestConfig,
      pantConfig:
        newType === 'TROUSERS' || newType === 'SUIT'
          ? (prev.pantConfig ?? DEFAULT_PANT_CONFIG)
          : prev.pantConfig,
      coatConfig: newType === 'PALTO' ? (prev.coatConfig ?? DEFAULT_COAT_CONFIG) : prev.coatConfig,
    }));
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingOrder(null);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
    setWizardStep(1);
  }

  function openCreateForm() {
    setEditingOrder(null);
    setIsReadOnly(false);
    setWizardStep(1);
    setForm(emptyForm);
    setError(null);
    setSuccess(null);
    setShowForm(true);
  }

  function openEditForm(order: Order, readOnly = false) {
    const formData = toForm(order);
    setEditingOrder(order);
    setIsReadOnly(readOnly);
    setForm(formData);
    setError(null);
    setSuccess(null);
    const hasConfig =
      ((order.productType === 'JACKET' || order.productType === 'SUIT') &&
        !!order.jacketStyleKey) ||
      (order.productType === 'SHIRT' && !!order.shirtFabricKey) ||
      (order.productType === 'SMOKIN' && !!order.tuxedoStyle) ||
      (order.productType === 'VEST' && !!order.vestFabricKey) ||
      (order.productType === 'TROUSERS' && !!order.pantFabricKey) ||
      (order.productType === 'PALTO' && !!order.coatFabricKey);
    setWizardStep(readOnly && hasConfig ? 2 : 1);
    setShowForm(true);
  }

  async function doSave() {
    setError(null);
    if (!form.customerId) {
      setError('Müşteri seçimi zorunludur.');
      return;
    }
    setIsSubmitting(true);
    const currentOrder = editingOrder;
    try {
      if (currentOrder) {
        await updateOrder(currentOrder.id, toPayload(form));
      } else {
        await createOrder(toPayload(form));
      }
      closeForm();
      setSuccess(currentOrder ? 'Sipariş güncellendi.' : 'Sipariş oluşturuldu.');
      await loadPage();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Sipariş kaydedilemedi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStep1Submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!form.customerId) {
      setError('Müşteri seçimi zorunludur.');
      return;
    }
    const isConfigurable =
      form.productType === 'JACKET' ||
      form.productType === 'SUIT' ||
      form.productType === 'SHIRT' ||
      form.productType === 'SMOKIN' ||
      form.productType === 'VEST' ||
      form.productType === 'TROUSERS' ||
      form.productType === 'PALTO';

    if (!isConfigurable) {
      // No configurator wired for this product type — fall back to the
      // legacy "save + close" path.
      void doSave();
      return;
    }

    // Compute the seeded form synchronously so we can both persist the new
    // order against it AND set it as the working state for step 2.
    const seededForm: FormState = {
      ...form,
      jacketConfig:
        form.productType === 'JACKET' || form.productType === 'SUIT'
          ? (form.jacketConfig ?? defaultJacketConfig)
          : form.jacketConfig,
      shirtConfig:
        form.productType === 'SHIRT'
          ? (form.shirtConfig ?? defaultShirtConfig)
          : form.shirtConfig,
      tuxedoConfig:
        form.productType === 'SMOKIN'
          ? (form.tuxedoConfig ?? defaultTuxedoConfig)
          : form.tuxedoConfig,
      vestConfig:
        form.productType === 'VEST'
          ? (form.vestConfig ?? DEFAULT_VEST_CONFIG)
          : form.vestConfig,
      pantConfig:
        form.productType === 'TROUSERS' || form.productType === 'SUIT'
          ? (form.pantConfig ?? DEFAULT_PANT_CONFIG)
          : form.pantConfig,
      coatConfig:
        form.productType === 'PALTO'
          ? (form.coatConfig ?? DEFAULT_COAT_CONFIG)
          : form.coatConfig,
    };
    setForm(seededForm);

    // Editing an existing order — just open the configurator on it.
    if (editingOrder) {
      setWizardStep(2);
      return;
    }

    // New order: persist immediately so step 2 operates in edit mode against
    // a real orderId.  This is the contract requested by the UX brief — the
    // "create" button always lands the user in the configurator with the
    // newly-created order loaded.
    setIsSubmitting(true);
    try {
      const created = await createOrder(toPayload(seededForm));
      setEditingOrder(created);
      setSuccess('Sipariş oluşturuldu. Detayları düzenleyebilirsiniz.');
      setWizardStep(2);
      // Refresh the listing in the background so the row is there when the
      // user later closes the configurator.
      void loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sipariş oluşturulamadı.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(order: Order) {
    if (!window.confirm('Bu siparişi silmek istediğinize emin misiniz?')) return;
    setError(null);
    try {
      await deleteOrder(order.id);
      setSuccess('Sipariş silindi.');
      await loadPage();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Sipariş silinemedi.',
      );
    }
  }

  const isJacket   = form.productType === 'JACKET';
  const isSuit     = form.productType === 'SUIT';
  const isShirt    = form.productType === 'SHIRT';
  const isTuxedo   = form.productType === 'SMOKIN';
  const isVest     = form.productType === 'VEST';
  const isTrousers = form.productType === 'TROUSERS';
  const isCoat     = form.productType === 'PALTO';
  const jacketValue  = form.jacketConfig ?? defaultJacketConfig;
  const shirtValue   = form.shirtConfig  ?? defaultShirtConfig;
  const tuxedoValue  = form.tuxedoConfig ?? defaultTuxedoConfig;
  const vestValue    = form.vestConfig   ?? DEFAULT_VEST_CONFIG;
  const pantValue    = form.pantConfig   ?? DEFAULT_PANT_CONFIG;
  const coatValue    = form.coatConfig   ?? DEFAULT_COAT_CONFIG;
  const configuratorSummaryItems = getConfiguratorSummaryItems({
    ...form,
    jacketConfig: (isJacket || isSuit) ? jacketValue : form.jacketConfig,
    shirtConfig: isShirt ? shirtValue : form.shirtConfig,
    tuxedoConfig: isTuxedo ? tuxedoValue : form.tuxedoConfig,
    vestConfig: isVest ? vestValue : form.vestConfig,
    pantConfig: (isTrousers || isSuit) ? pantValue : form.pantConfig,
    coatConfig: isCoat ? coatValue : form.coatConfig,
  });
  const onJacketChange  = (config: JacketConfig)  => setForm((prev) => ({ ...prev, jacketConfig: config }));
  const onShirtChange   = (config: ShirtConfig)   => setForm((prev) => ({ ...prev, shirtConfig: config }));
  const onTuxedoChange  = (config: TuxedoConfig)  => setForm((prev) => ({ ...prev, tuxedoConfig: config }));
  const onVestChange    = (config: VestConfig)    => setForm((prev) => ({ ...prev, vestConfig: config }));
  const onPantChange    = (config: PantConfig)    => setForm((prev) => ({ ...prev, pantConfig: config }));
  const onCoatChange    = (config: CoatConfig)    => setForm((prev) => ({ ...prev, coatConfig: config }));

  return (
    <section className="orders-page">
      {/* Page header */}
      <div className="page-header">
        <div className="section-heading">
          <span className="eyebrow">Sipariş Paneli</span>
          <h2>Siparişler</h2>
          <p>Müşteri, ürün, teslim tarihi ve ödeme özetini pratik biçimde yönetin.</p>
        </div>
        <button className="primary-button" type="button" onClick={openCreateForm}>
          Yeni Sipariş
        </button>
      </div>

      {/* Page-level messages (shown after form closes) */}
      {!showForm && error && <div className="state-message error dashboard-state">{error}</div>}
      {!showForm && success && <div className="state-message success dashboard-state">{success}</div>}

      {/* ── STEP 1: centered modal card ── */}
      {showForm && wizardStep === 1 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 40,
              boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: 32,
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                  }}
                >
                  {editingOrder ? 'SİPARİŞİ DÜZENLE' : 'YENİ SİPARİŞ'}
                </p>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {editingOrder?.orderNumber ?? 'Sipariş Bilgileri'}
                </h2>
              </div>
              {(isJacket || isSuit || isShirt || isTuxedo || isVest || isTrousers || isCoat) && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--text-faint)',
                    marginTop: 4,
                    flexShrink: 0,
                  }}
                >
                  1 / 2
                </span>
              )}
            </div>

            {/* Inline error */}
            {error && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '10px 14px',
                  background: 'rgba(224,85,85,0.1)',
                  border: '1px solid rgba(224,85,85,0.3)',
                  borderRadius: 8,
                  color: 'var(--danger)',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleStep1Submit}>
              {/* Müşteri */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="wz-customer" style={WZ_LABEL}>Müşteri *</label>
                <select
                  id="wz-customer"
                  style={WZ_INPUT}
                  value={form.customerId}
                  onChange={(e) => updateField('customerId', e.target.value)}
                >
                  <option value="">Seçin…</option>
                  {customers.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ürün */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="wz-product" style={WZ_LABEL}>Ürün *</label>
                <select
                  id="wz-product"
                  style={WZ_INPUT}
                  value={form.productType}
                  onChange={(e) => handleProductTypeChange(e.target.value as ProductType)}
                >
                  {productTypes.map((type) => (
                    <option value={type} key={type}>
                      {getProductTypeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fiyat + Para Birimi */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="wz-price" style={WZ_LABEL}>Fiyat</label>
                  <input
                    id="wz-price"
                    type="number"
                    min="0"
                    step="0.01"
                    style={WZ_INPUT}
                    value={form.totalAmount}
                    onChange={(e) => updateField('totalAmount', e.target.value)}
                  />
                </div>
                <div style={{ width: 110 }}>
                  <label htmlFor="wz-currency" style={WZ_LABEL}>Para Birimi</label>
                  <select
                    id="wz-currency"
                    style={WZ_INPUT}
                    value={form.currency}
                    onChange={(e) => updateField('currency', e.target.value as CurrencyType)}
                  >
                    {currencies.map((c) => (
                      <option value={c} key={c}>{getCurrencyLabel(c)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ödeme Durumu */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="wz-payment" style={WZ_LABEL}>Ödeme Durumu</label>
                <select
                  id="wz-payment"
                  style={WZ_INPUT}
                  value={form.paymentStatus}
                  onChange={(e) =>
                    updateField('paymentStatus', e.target.value as OrderPaymentStatus)
                  }
                >
                  {paymentStatuses.map((s) => (
                    <option value={s} key={s}>{getPaymentStatusLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Notlar */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="wz-notes" style={WZ_LABEL}>Notlar</label>
                <textarea
                  id="wz-notes"
                  rows={3}
                  style={{ ...WZ_INPUT, resize: 'vertical' }}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                />
              </div>

              <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-faint)' }}>
                Toplam: {formPricePreview}
              </p>

              {/* Footer */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    borderRadius: 8,
                    padding: '11px 20px',
                    fontSize: 14,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                  onClick={closeForm}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-text)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '11px 24px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    font: 'inherit',
                    opacity: isSubmitting ? 0.7 : 1,
                  }}
                >
                  {isSubmitting
                    ? 'Kaydediliyor...'
                    : (isJacket || isSuit || isShirt || isTuxedo || isVest || isTrousers || isCoat)
                      ? 'Devam Et →'
                      : editingOrder
                        ? 'Güncelle'
                        : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── STEP 2: full-screen configurator overlay ── */}
      {showForm && wizardStep === 2 && (isJacket || isSuit || isShirt || isTuxedo || isVest || isTrousers || isCoat) && (
        <div className="configurator-overlay">
          {/* Left panel */}
          <div className="configurator-sidebar">
            {/* Panel header */}
            <div className="configurator-sidebar-header">
              <div className="configurator-sidebar-actions">
                <button
                  type="button"
                  onClick={isReadOnly ? closeForm : () => setWizardStep(1)}
                  className="configurator-back-button"
                >
                  ← {isReadOnly ? 'Kapat' : 'Geri'}
                </button>
                {isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsReadOnly(false)}
                    className="configurator-edit-button"
                  >
                    Düzenle
                  </button>
                )}
              </div>

              {/* Order summary */}
              <p className="configurator-kicker">
                {editingOrder ? editingOrder.orderNumber : 'Yeni Sipariş'} · Adım 2/2
              </p>
              <p className="configurator-customer">
                {selectedCustomer
                  ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
                  : '—'}
              </p>
              <p className="configurator-summary">
                {getProductTypeLabel(form.productType)} · {formPricePreview}
              </p>
              {configuratorSummaryItems.length > 0 && (
                <div className="configurator-feature-list" aria-label="Sipariş özellikleri">
                  {configuratorSummaryItems.map((item) => (
                    <span className="configurator-feature-pill" key={`${item.label}-${item.value}`}>
                      <small>{item.label}</small>
                      <strong>{item.value}</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Configurator controls — scrollable */}
            <div className="configurator-scroll">
              {isJacket && (
                <JacketConfigurator
                  mode="controls-all"
                  value={jacketValue}
                  onChange={onJacketChange}
                  readOnly={isReadOnly}
                />
              )}
              {isSuit && (
                <SuitConfigurator
                  mode="controls-all"
                  value={jacketValue}
                  onChange={onJacketChange}
                  pantValue={pantValue}
                  onPantChange={onPantChange}
                  readOnly={isReadOnly}
                />
              )}
              {isShirt && (
                <ShirtConfigurator
                  mode="controls-all"
                  value={shirtValue}
                  onChange={onShirtChange}
                  readOnly={isReadOnly}
                />
              )}
              {isTuxedo && (
                <TuxedoConfigurator
                  mode="controls-all"
                  value={tuxedoValue}
                  onChange={onTuxedoChange}
                  readOnly={isReadOnly}
                />
              )}
              {isVest && (
                <VestConfigurator
                  mode="controls-only"
                  value={vestValue}
                  onChange={onVestChange}
                  readOnly={isReadOnly}
                />
              )}
              {isTrousers && (
                <PantConfigurator
                  mode="controls-only"
                  value={pantValue}
                  onChange={onPantChange}
                  readOnly={isReadOnly}
                />
              )}
              {isCoat && (
                <CoatConfigurator
                  mode="controls-all"
                  value={coatValue}
                  onChange={onCoatChange}
                  readOnly={isReadOnly}
                />
              )}
            </div>
          </div>

          {/* Right panel — viewer */}
          <div className="configurator-viewer-panel">
            {isJacket && (
              <JacketConfigurator
                mode="viewer-only"
                value={jacketValue}
                onChange={onJacketChange}
                viewerBackground={viewerBg}
              />
            )}
            {isSuit && (
              <SuitConfigurator
                mode="viewer-only"
                value={jacketValue}
                onChange={onJacketChange}
                pantValue={pantValue}
                onPantChange={onPantChange}
                viewerBackground={viewerBg}
              />
            )}
            {isShirt && (
              <ShirtConfigurator
                mode="viewer-only"
                value={shirtValue}
                onChange={onShirtChange}
                viewerBackground={viewerBg}
              />
            )}
            {isTuxedo && (
              <TuxedoConfigurator
                mode="viewer-only"
                value={tuxedoValue}
                onChange={onTuxedoChange}
                viewerBackground={viewerBg}
              />
            )}
            {isVest && (
              <VestConfigurator
                mode="viewer-only"
                value={vestValue}
                onChange={onVestChange}
                viewerBackground={viewerBg}
              />
            )}
            {isTrousers && (
              <PantConfigurator
                mode="viewer-only"
                value={pantValue}
                onChange={onPantChange}
                viewerBackground={viewerBg}
              />
            )}
            {isCoat && (
              <CoatConfigurator
                mode="viewer-only"
                value={coatValue}
                onChange={onCoatChange}
                viewerBackground={viewerBg}
              />
            )}

            {/* Background color picker */}
            <div className="configurator-bg-picker">
              {BG_PRESETS.map((preset) => {
                const isSelected = viewerBg === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => setViewerBg(preset.value)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: preset.value,
                      border: 'none',
                      outline: isSelected ? '2px solid white' : '2px solid transparent',
                      outlineOffset: 2,
                      cursor: 'pointer',
                      flexShrink: 0,
                      padding: 0,
                      transition: 'outline-color 0.15s, transform 0.15s',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>

            {/* Step-2 error */}
            {error && (
              <div className={isReadOnly ? 'configurator-error read-only' : 'configurator-error'}>
                {error}
              </div>
            )}

            {/* Save button — hidden in read-only mode */}
            {!isReadOnly && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void doSave()}
                className="configurator-save-button"
              >
                {isSubmitting
                  ? 'Kaydediliyor...'
                  : editingOrder
                    ? 'Güncelle'
                    : 'Siparişi Kaydet'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Orders table (always visible) ── */}
      <div className="surface-card table-card">
        <div className="section-header table-card-header">
          <div>
            <span className="eyebrow">Sipariş listesi</span>
            <h2>Kayıtlı Siparişler</h2>
          </div>
          <span className="count-badge">{orders.length} sipariş</span>
        </div>
        {isLoading ? (
          <div className="state-message loading-state">Siparişler yükleniyor...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">Henüz sipariş kaydı bulunmuyor.</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table orders-table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Müşteri</th>
                  <th>Ürün</th>
                  <th>Teslim</th>
                  <th>Fiyat</th>
                  <th>Para Birimi</th>
                  <th>Ödeme</th>
                  <th>Üretim Aşaması</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>{order.orderNumber}</strong></td>
                    <td>{order.customerFullName}</td>
                    <td>{order.productTypeLabel}</td>
                    <td>{formatDate(order.expectedDeliveryDate)}</td>
                    <td>{formatMoney(order.totalAmount, order.currency)}</td>
                    <td>{order.currencyLabel || getCurrencyLabel(order.currency)}</td>
                    <td>
                      <span
                        className={`status-pill ${normalizePaymentStatus(order.paymentStatus) === 'PAID' ? 'payment-paid' : 'payment-unpaid'}`}
                      >
                        {order.paymentStatusLabel || getPaymentStatusLabel(order.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      {order.productionJobId ? (
                        <span className="production-stage-pill">
                          {String(order.productionStageOrder ?? 1).padStart(2, '0')}{' '}
                          {order.productionStageName}
                        </span>
                      ) : (
                        <span className="muted-cell">Üretime aktarılmadı</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        {order.productionJobId && (
                          <a className="ghost-button small-button" href="/admin/workflow">
                            Kanbanda Gör
                          </a>
                        )}
                        {order.productType === 'JACKET' && order.jacketStyleKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Ceketi Gör
                          </button>
                        )}
                        {order.productType === 'SUIT' && order.jacketStyleKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Takım Elbiseyi Gör
                          </button>
                        )}
                        {order.productType === 'SHIRT' && order.shirtFabricKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Gömleği Gör
                          </button>
                        )}
                        {order.productType === 'SMOKIN' && order.tuxedoStyle && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Smokini Gör
                          </button>
                        )}
                        {order.productType === 'VEST' && order.vestFabricKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Yeleği Gör
                          </button>
                        )}
                        {order.productType === 'TROUSERS' && order.pantFabricKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Pantolonu Gör
                          </button>
                        )}
                        {order.productType === 'PALTO' && order.coatFabricKey && (
                          <button
                            className="ghost-button small-button"
                            type="button"
                            onClick={() => openEditForm(order, true)}
                          >
                            Paltonu Gör
                          </button>
                        )}
                        <button
                          className="ghost-button small-button"
                          type="button"
                          onClick={() => setLabelOrder(order)}
                        >
                          Etiket
                        </button>
                        <button
                          className="ghost-button small-button"
                          type="button"
                          onClick={() => openEditForm(order, false)}
                        >
                          Düzenle
                        </button>
                        <button
                          className="danger-button small-button"
                          type="button"
                          onClick={() => void handleDelete(order)}
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {labelOrder && (
        <PrintLabelModal
          type="order"
          id={labelOrder.orderNumber}
          title={`#${labelOrder.orderNumber}`}
          subtitle={labelOrder.customerFullName ?? undefined}
          onClose={() => setLabelOrder(null)}
        />
      )}
    </section>
  );
}
