import type { ProductType } from './production';
import type { JacketConfig } from './jacket';
import type { VestConfig } from './vest';
import type { PantConfig } from './pant';
import type { CoatConfig } from './coat';

export type OrderStatus = 'DRAFT' | 'ACTIVE' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type OrderPaymentStatus = 'UNPAID' | 'PAID';
export type CurrencyType = 'TRY' | 'USD' | 'EUR';

export type Order = {
  id: number;
  orderNumber: string;
  customerId: number;
  customerFullName: string;
  productType: ProductType;
  productTypeLabel: string;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalAmount: number;
  currency?: CurrencyType | string | null;
  currencyLabel?: string | null;
  paymentStatus?: OrderPaymentStatus | string | null;
  paymentStatusLabel?: string | null;
  depositAmount: number;
  remainingAmount: number;
  status: OrderStatus;
  statusLabel: string;
  productionJobId: number | null;
  productionJobNumber: string | null;
  productionStageName: string | null;
  productionStageOrder: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested convenience field (not sent by backend; built client-side from flat fields below)
  jacketConfig?: JacketConfig | null;
  // Flat fields as returned by the Spring Boot API
  jacketStyleKey?: string | null;
  jacketLapelStyle?: string | null;
  jacketLapelWidth?: string | null;
  jacketPocketStyle?: string | null;
  jacketFabricKey?: string | null;
  jacketFabricLabel?: string | null;
  shirtCollarStyle?: string | null;
  shirtCollarButtons?: string | null;
  shirtCuffStyle?: string | null;
  shirtFabricKey?: string | null;
  shirtFabricLabel?: string | null;
  tuxedoStyle?: string | null;
  tuxedoLapelStyle?: string | null;
  tuxedoLapelWidth?: string | null;
  tuxedoPocketStyle?: string | null;
  tuxedoFabricKey?: string | null;
  tuxedoFabricLabel?: string | null;
  vestConfig?: VestConfig | null;
  vestLapelStyle?: string | null;
  vestPocketStyle?: string | null;
  vestFabricKey?: string | null;
  vestFabricLabel?: string | null;
  pantConfig?: PantConfig | null;
  pantFasteningStyle?: string | null;
  pantPleatStyle?: string | null;
  pantFabricKey?: string | null;
  pantFabricLabel?: string | null;
  // Data-only configurator fields — see backend Order entity.
  jacketFit?: string | null;
  jacketVent?: string | null;
  shirtFit?: string | null;
  pantFit?: string | null;
  pantLegStyle?: string | null;
  pantDrape?: string | null;
  coatConfig?: CoatConfig | null;
  coatStyle?: string | null;
  coatCollarStyle?: string | null;
  coatLapelStyle?: string | null;
  coatLapelLength?: string | null;
  coatLapelWidth?: string | null;
  coatFastening?: string | null;
  coatPocketStyle?: string | null;
  coatFabricKey?: string | null;
  coatFabricLabel?: string | null;
};

export type OrderRequest = {
  customerId: number;
  productType: ProductType;
  orderDate?: string;
  expectedDeliveryDate?: string;
  totalAmount?: number;
  currency?: CurrencyType;
  paymentStatus?: OrderPaymentStatus;
  notes?: string;
  jacketConfig?: JacketConfig | null;
  jacketStyleKey?: string;
  jacketLapelStyle?: string;
  jacketLapelWidth?: string;
  jacketPocketStyle?: string;
  jacketFabricKey?: string;
  jacketFabricLabel?: string;
  shirtCollarStyle?: string;
  shirtCollarButtons?: string;
  shirtCuffStyle?: string;
  shirtFabricKey?: string;
  shirtFabricLabel?: string;
  tuxedoStyle?: string;
  tuxedoLapelStyle?: string;
  tuxedoLapelWidth?: string;
  tuxedoPocketStyle?: string;
  tuxedoFabricKey?: string;
  tuxedoFabricLabel?: string;
  vestConfig?: VestConfig | null;
  vestLapelStyle?: string;
  vestPocketStyle?: string;
  vestFabricKey?: string;
  vestFabricLabel?: string;
  pantConfig?: PantConfig | null;
  pantFasteningStyle?: string;
  pantPleatStyle?: string;
  pantFabricKey?: string;
  pantFabricLabel?: string;
  // Data-only configurator fields.
  jacketFit?: string;
  jacketVent?: string;
  shirtFit?: string;
  pantFit?: string;
  pantLegStyle?: string;
  pantDrape?: string;
  coatConfig?: CoatConfig | null;
  coatStyle?: string;
  coatCollarStyle?: string;
  coatLapelStyle?: string;
  coatLapelLength?: string;
  coatLapelWidth?: string;
  coatFastening?: string;
  coatPocketStyle?: string;
  coatFabricKey?: string;
  coatFabricLabel?: string;
};

export function getOrderStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    DRAFT: 'Taslak',
    ACTIVE: 'Aktif',
    READY: 'Hazır',
    DELIVERED: 'Teslim Edildi',
    CANCELLED: 'İptal',
  };
  return labels[status];
}

export function getPaymentStatusLabel(status: OrderPaymentStatus | string | null | undefined) {
  const labels: Record<OrderPaymentStatus, string> = {
    UNPAID: 'Ödenmedi',
    PAID: 'Ödendi',
  };
  return status === 'PAID' ? labels.PAID : labels.UNPAID;
}

export function getCurrencyLabel(currency: CurrencyType | string | null | undefined) {
  const labels: Record<CurrencyType, string> = {
    TRY: 'TL',
    USD: 'USD',
    EUR: 'EUR',
  };
  if (currency === 'USD') {
    return labels.USD;
  }
  if (currency === 'EUR') {
    return labels.EUR;
  }
  return labels.TRY;
}
