import { request } from './client';
import type {
  Employee,
  MoveProductionJobRequest,
  ProductionJob,
  ProductionJobHistory,
  ProductionJobRequest,
  ProductionStage,
} from '../types/production';

export function getEmployees(): Promise<Employee[]> {
  return request<Employee[]>('/employees');
}

export function getProductionStages(): Promise<ProductionStage[]> {
  return request<ProductionStage[]>('/production-stages');
}

export function getProductionJobs(): Promise<ProductionJob[]> {
  return request<ProductionJob[]>('/production-jobs');
}

export function getProductionJobById(id: number): Promise<ProductionJob> {
  return request<ProductionJob>(`/production-jobs/${id}`);
}

export function createProductionJob(data: ProductionJobRequest): Promise<ProductionJob> {
  return request<ProductionJob>('/production-jobs', {
    method: 'POST',
    body: data,
  });
}

export function moveProductionJob(jobId: number, data: MoveProductionJobRequest): Promise<ProductionJob> {
  return request<ProductionJob>(`/production-jobs/${jobId}/move`, {
    method: 'PUT',
    body: data,
  });
}

export function completeProductionJob(
  jobId: number,
  performedByEmployeeId: number,
  note?: string,
): Promise<ProductionJob> {
  return request<ProductionJob>(`/production-jobs/${jobId}/complete`, {
    method: 'PUT',
    body: { performedByEmployeeId, note },
  });
}

export function cancelProductionJob(
  jobId: number,
  performedByEmployeeId: number,
  note?: string,
): Promise<ProductionJob> {
  return request<ProductionJob>(`/production-jobs/${jobId}/cancel`, {
    method: 'PUT',
    body: { performedByEmployeeId, note },
  });
}

export function getProductionJobHistory(jobId: number): Promise<ProductionJobHistory[]> {
  return request<ProductionJobHistory[]>(`/production-jobs/${jobId}/history`);
}
