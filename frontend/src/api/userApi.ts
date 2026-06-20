import { request } from './client';
import type { UserResponse } from '../types/auth';

export function getUsers(): Promise<UserResponse[]> {
  return request<UserResponse[]>('/users');
}

export function resetUserPassword(id: number, newPassword?: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/users/${id}/reset-password`, {
    method: 'PUT',
    body: newPassword ? { newPassword } : {},
  });
}

export type VipCustomerRequest = {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
};

export type VipCustomerResponse = {
  userId: number;
  customerId: number;
  username: string;
  fullName: string;
  email: string | null;
};

export function createVipCustomer(data: VipCustomerRequest): Promise<VipCustomerResponse> {
  return request<VipCustomerResponse>('/admin/users/vip', {
    method: 'POST',
    body: data,
  });
}
