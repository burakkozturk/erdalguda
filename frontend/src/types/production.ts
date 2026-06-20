export type ProductType = 'SHIRT' | 'JACKET' | 'TROUSERS' | 'VEST' | 'SUIT' | 'SMOKIN';

export type ProductionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ProductionJobStatus = 'ACTIVE' | 'WAITING' | 'REVISION' | 'COMPLETED' | 'CANCELLED';

export type ProductionActionType =
  | 'CREATED'
  | 'MOVED_STAGE'
  | 'ASSIGNED'
  | 'NOTE_ADDED'
  | 'STATUS_CHANGED'
  | 'COMPLETED'
  | 'CANCELLED';

export type Employee = {
  id: number;
  fullName: string;
  roleTitle: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductionStage = {
  id: number;
  stageOrder: number;
  name: string;
  description: string | null;
  defaultResponsibleEmployee: Employee;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProductionJob = {
  id: number;
  jobNumber: string;
  customerId: number;
  customerFullName: string;
  relatedOrderId: number | null;
  relatedOrderNumber: string | null;
  productType: ProductType;
  productTypeDisplayName: string;
  currentStage: ProductionStage;
  assignedEmployee: Employee | null;
  priority: ProductionPriority;
  status: ProductionJobStatus;
  expectedDeliveryDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ProductionJobRequest = {
  customerId: number;
  productType: ProductType;
  priority: ProductionPriority;
  expectedDeliveryDate?: string;
  notes?: string;
};

export type MoveProductionJobRequest = {
  toStageId?: number;
  performedByEmployeeId?: number;
  note?: string;
};

export type ProductionJobHistory = {
  id: number;
  productionJobId: number;
  jobNumber: string;
  fromStage: ProductionStage | null;
  toStage: ProductionStage | null;
  performedByEmployee: Employee | null;
  actionType: ProductionActionType;
  note: string | null;
  createdAt: string;
};

export function getProductTypeLabel(value: ProductType) {
  const labels: Record<ProductType, string> = {
    SHIRT: 'Gömlek',
    JACKET: 'Ceket',
    TROUSERS: 'Pantolon',
    VEST: 'Yelek',
    SUIT: 'Takım Elbise',
    SMOKIN: 'Smokin',
  };
  return labels[value];
}

export function getPriorityLabel(value: ProductionPriority) {
  const labels: Record<ProductionPriority, string> = {
    LOW: 'Düşük',
    NORMAL: 'Normal',
    HIGH: 'Yüksek',
    URGENT: 'Acil',
  };
  return labels[value];
}

export function getJobStatusLabel(value: ProductionJobStatus) {
  const labels: Record<ProductionJobStatus, string> = {
    ACTIVE: 'Aktif',
    WAITING: 'Beklemede',
    REVISION: 'Revize',
    COMPLETED: 'Tamamlandı',
    CANCELLED: 'İptal Edildi',
  };
  return labels[value];
}

export function getActionTypeLabel(value: ProductionActionType) {
  const labels: Record<ProductionActionType, string> = {
    CREATED: 'Oluşturuldu',
    MOVED_STAGE: 'Aşama Değişti',
    ASSIGNED: 'Atama Yapıldı',
    NOTE_ADDED: 'Not Eklendi',
    STATUS_CHANGED: 'Durum Değişti',
    COMPLETED: 'Tamamlandı',
    CANCELLED: 'İptal Edildi',
  };
  return labels[value];
}
