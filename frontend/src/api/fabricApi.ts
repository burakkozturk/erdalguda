import { AUTH_TOKEN_STORAGE_KEY, request } from './client';

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

export interface FabricGenerateRequest {
  name: string;
  file: File;
  tag?: string;
  garmentType?: GarmentType | 'VEST' | 'PANT' | 'COAT' | 'SUIT';
}

export interface FabricGenerateResponse {
  ok: boolean;
  fabric?: {
    key: string;
    fabricId: string;
    label?: string;
    swatchSrc?: string;
  };
  detail?: string;
  generatedLayers?: number;
  [key: string]: unknown;
}

export function getFabrics(type?: GarmentType): Promise<FabricResponse[]> {
  const path = type ? `/fabrics?type=${type}` : '/fabrics';
  return request<FabricResponse[]>(path);
}

export function createFabric(data: FabricCreateRequest): Promise<FabricResponse> {
  return request<FabricResponse>('/fabrics', { method: 'POST', body: data });
}

export function generateFabric(data: FabricGenerateRequest): Promise<FabricGenerateResponse> {
  const body = new FormData();
  body.append('name', data.name);
  body.append('file', data.file);
  body.append('tag', data.tag ?? '');
  body.append('garment_type', data.garmentType ?? 'JACKET');

  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const generateUrl = import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/api/fabrics/generate`
    : '/api/fabrics/generate';

  return fetch(generateUrl, {
    method: 'POST',
    headers,
    body,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      console.error('Kumaş üretme isteği başarısız:', payload?.detail ?? payload);
      throw new Error(payload?.detail ? JSON.stringify(payload.detail) : 'Kumaş oluşturma başarısız');
    }

    return payload as FabricGenerateResponse;
  });
}

export function updateFabric(fabricId: string, data: FabricUpdateRequest): Promise<FabricResponse> {
  return request<FabricResponse>(`/fabrics/${fabricId}`, { method: 'PUT', body: data });
}

export function deleteFabric(fabricId: string): Promise<void> {
  return request<void>(`/fabrics/${fabricId}`, { method: 'DELETE' });
}
