import { request } from './client';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface AppointmentRequest {
  fullName: string;
  phone: string;
  email?: string;
  requestedService?: string;
  preferredDate?: string;
  notes?: string;
}

export interface AppointmentResponse {
  id: number;
  fullName: string;
  phone: string;
  email: string | null;
  requestedService: string | null;
  preferredDate: string | null;
  notes: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentStatusUpdateRequest {
  status: AppointmentStatus;
}

export function createAppointment(data: AppointmentRequest): Promise<AppointmentResponse> {
  return request<AppointmentResponse>('/appointments', { method: 'POST', body: data });
}

export function getAppointments(): Promise<AppointmentResponse[]> {
  return request<AppointmentResponse[]>('/appointments');
}

export function updateAppointmentStatus(id: number, data: AppointmentStatusUpdateRequest): Promise<AppointmentResponse> {
  return request<AppointmentResponse>(`/appointments/${id}/status`, { method: 'PUT', body: data });
}

export function deleteAppointment(id: number): Promise<void> {
  return request<void>(`/appointments/${id}`, { method: 'DELETE' });
}

export function getAppointmentStatusLabel(status: AppointmentStatus): string {
  const map: Record<AppointmentStatus, string> = {
    PENDING: 'Beklemede',
    CONFIRMED: 'Onaylandı',
    COMPLETED: 'Tamamlandı',
    CANCELLED: 'İptal Edildi',
  };
  return map[status];
}
