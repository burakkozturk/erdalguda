import type { CurrencyType, OrderPaymentStatus } from './order';
import type { MeasurementValueRequest } from './measurement';
import type { ProductType } from './production';

export type ExpressCustomerRequest = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  heightCm?: number;
  weightKg?: number;
};

export type ExpressMeasurementRequest = {
  measuredAt?: string;
  notes?: string;
  values: MeasurementValueRequest[];
};

export type ExpressOrderRequest = {
  productType: ProductType;
  orderDate?: string;
  expectedDeliveryDate?: string;
  totalAmount?: number;
  currency?: CurrencyType;
  paymentStatus?: OrderPaymentStatus;
  notes?: string;
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
  vestLapelStyle?: string;
  vestPocketStyle?: string;
  vestFabricKey?: string;
  vestFabricLabel?: string;
  pantFasteningStyle?: string;
  pantPleatStyle?: string;
  pantFabricKey?: string;
  pantFabricLabel?: string;
  jacketFit?: string;
  jacketVent?: string;
  shirtFit?: string;
  pantFit?: string;
  pantLegStyle?: string;
  pantDrape?: string;
};

export type ExpressRegistrationRequest = {
  customer: ExpressCustomerRequest;
  measurement: ExpressMeasurementRequest;
  orders: ExpressOrderRequest[];
};

export type OrderResult = {
  orderId: number;
  orderNumber: string;
  productionJobId: number;
  productionJobNumber: string;
  productionStageName: string;
};

export type ExpressRegistrationResponse = {
  customerId: number;
  customerFullName: string;
  measurementSetId: number;
  orders: OrderResult[];
  message: string;
};
