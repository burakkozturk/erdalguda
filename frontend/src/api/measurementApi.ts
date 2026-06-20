import { request } from './client';
import type { MeasurementDefinition, MeasurementSet, MeasurementSetRequest } from '../types/measurement';

export function listMeasurementDefinitions(): Promise<MeasurementDefinition[]> {
  return request<MeasurementDefinition[]>('/measurement-definitions');
}

export function listMeasurementSets(): Promise<MeasurementSet[]> {
  return request<MeasurementSet[]>('/measurement-sets');
}

export function listMeasurementSetsByCustomer(customerId: number): Promise<MeasurementSet[]> {
  return request<MeasurementSet[]>(`/customers/${customerId}/measurement-sets`);
}

export function getMeasurementSet(id: number): Promise<MeasurementSet> {
  return request<MeasurementSet>(`/measurement-sets/${id}`);
}

export function createMeasurementSet(data: MeasurementSetRequest): Promise<MeasurementSet> {
  return request<MeasurementSet>('/measurement-sets', {
    method: 'POST',
    body: data,
  });
}

export function updateMeasurementSet(id: number, data: MeasurementSetRequest): Promise<MeasurementSet> {
  return request<MeasurementSet>(`/measurement-sets/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteMeasurementSet(id: number): Promise<void> {
  return request<void>(`/measurement-sets/${id}`, {
    method: 'DELETE',
  });
}
