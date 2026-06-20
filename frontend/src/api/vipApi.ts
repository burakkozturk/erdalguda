import { request } from './client';
import type { Order } from '../types/order';
import type { MeasurementSet } from '../types/measurement';

type VipCustomerProfile = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};

export type VipOrderRequest = {
  productType: string;
  expectedDeliveryDate?: string;
  totalAmount?: number;
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

export function getVipMe(): Promise<VipCustomerProfile> {
  return request<VipCustomerProfile>('/vip/me');
}

export function getVipOrders(): Promise<Order[]> {
  return request<Order[]>('/vip/orders');
}

export function getVipMeasurements(): Promise<MeasurementSet[]> {
  return request<MeasurementSet[]>('/vip/measurements');
}

export function createVipOrder(data: VipOrderRequest): Promise<Order> {
  return request<Order>('/vip/orders', {
    method: 'POST',
    body: data,
  });
}
