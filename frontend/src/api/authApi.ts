import { request } from './client';
import type { AuthUser, LoginRequest, LoginResponse } from '../types/auth';

export function login(data: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: data,
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>('/auth/me');
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>('/auth/change-password', {
    method: 'PUT',
    body: {
      currentPassword,
      newPassword,
      confirmPassword,
    },
  });
}
