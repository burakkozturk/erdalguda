import { request } from './client';
import type { AdminDashboardResponse } from '../types/dashboard';

export function getAdminDashboard(): Promise<AdminDashboardResponse> {
  return request<AdminDashboardResponse>('/dashboard/admin');
}
