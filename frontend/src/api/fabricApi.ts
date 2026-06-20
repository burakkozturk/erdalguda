import { request } from './client';

export type GarmentType = 'JACKET' | 'SHIRT';

export interface FabricResponse {
  id: number;
  fabricId: string;
  key: string;
  name: string;
  label: string;
  subtitle: string;
  defaultFabric: boolean;
  type: GarmentType;
  tag: string | null;
  inStock: boolean;
  createdAt: string;
  createdBy: string;
  swatchUrl: string;
}

export interface FabricCreateRequest {
  fabricId: string;
  key: string;
  name: string;
  label: string;
  subtitle: string;
  defaultFabric: boolean;
  createdBy: string;
  type: GarmentType;
  tag?: string | null;
  inStock: boolean;
}

export interface FabricUpdateRequest {
  name?: string;
  tag?: string | null;
  inStock: boolean;
  type?: GarmentType;
}

export function getFabrics(type?: GarmentType): Promise<FabricResponse[]> {
  const path = type ? `/fabrics?type=${type}` : '/fabrics';
  return request<FabricResponse[]>(path);
}

export function createFabric(data: FabricCreateRequest): Promise<FabricResponse> {
  return request<FabricResponse>('/fabrics', { method: 'POST', body: data });
}

export function updateFabric(fabricId: string, data: FabricUpdateRequest): Promise<FabricResponse> {
  return request<FabricResponse>(`/fabrics/${fabricId}`, { method: 'PUT', body: data });
}

export function deleteFabric(fabricId: string): Promise<void> {
  return request<void>(`/fabrics/${fabricId}`, { method: 'DELETE' });
}
