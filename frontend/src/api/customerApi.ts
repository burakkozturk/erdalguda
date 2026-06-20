import { request } from './client';
import type { Customer, CustomerRequest } from '../types/customer';

export function getCustomers(): Promise<Customer[]> {
  return request<Customer[]>('/customers');
}

export function getCustomerById(id: number): Promise<Customer> {
  return request<Customer>(`/customers/${id}`);
}

export function createCustomer(data: CustomerRequest): Promise<Customer> {
  return request<Customer>('/customers', {
    method: 'POST',
    body: data,
  });
}

export function updateCustomer(id: number, data: CustomerRequest): Promise<Customer> {
  return request<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteCustomer(id: number): Promise<void> {
  return request<void>(`/customers/${id}`, {
    method: 'DELETE',
  });
}
