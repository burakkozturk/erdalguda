export interface StyleItem {
  label: string;
  value: string;
}

export interface MeasurementItem {
  order: number;
  label: string;
  value: string;
  unit: string;
}

export interface RenderHint {
  garmentType: 'pant' | 'shirt' | 'vest';
  fabricKey: string;
  styleKeys: Record<string, string>;
}

export interface OrderScanResult {
  orderNumber: string;
  customerFullName: string;
  productTypeLabel: string;
  productionStageName: string | null;
  orderStatusLabel: string;
  notes: string | null;
  primaryFabricSwatchUrl: string | null;
  renderHint: RenderHint | null;
  styleItems: StyleItem[];
  measurements: MeasurementItem[];
}

export interface FabricScanResult {
  fabricId: string;
  name: string;
  typeLabel: string;
  inStock: boolean;
  tag: string | null;
  subtitle: string | null;
  swatchUrl: string | null;
}

const BASE = 'http://localhost:8080/api/public/scan';

export async function scanOrder(orderNumber: string): Promise<OrderScanResult> {
  const res = await fetch(`${BASE}/order/${encodeURIComponent(orderNumber)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<OrderScanResult>;
}

export async function scanFabric(fabricId: string): Promise<FabricScanResult> {
  const res = await fetch(`${BASE}/fabric/${encodeURIComponent(fabricId)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<FabricScanResult>;
}
