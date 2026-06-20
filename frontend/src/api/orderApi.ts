import { request } from './client';
import type { Order, OrderRequest } from '../types/order';

export function listOrders(): Promise<Order[]> {
  return request<Order[]>('/orders');
}

export function getOrder(id: number): Promise<Order> {
  return request<Order>(`/orders/${id}`);
}

export function createOrder(data: OrderRequest): Promise<Order> {
  return request<Order>('/orders', {
    method: 'POST',
    body: data,
  });
}

export function updateOrder(id: number, data: OrderRequest): Promise<Order> {
  return request<Order>(`/orders/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteOrder(id: number): Promise<void> {
  return request<void>(`/orders/${id}`, {
    method: 'DELETE',
  });
}

export function triggerRender(id: number): Promise<void> {
  return request<void>(`/orders/${id}/trigger-render`, {
    method: 'POST',
  });
}
