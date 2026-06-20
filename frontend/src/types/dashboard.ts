import type { ProductType, ProductionPriority } from './production';

export type DashboardMetricResponse = {
  key: string;
  label: string;
  value: number;
};

export type StageWorkloadResponse = {
  stageOrder: number;
  stageName: string;
  responsibleEmployeeName: string | null;
  jobCount: number;
};

export type ProductTypeStatsResponse = {
  productType: ProductType;
  productTypeLabel: string;
  count: number;
};

export type PriorityStatsResponse = {
  priority: ProductionPriority;
  priorityLabel: string;
  count: number;
};

export type EmployeeWorkloadResponse = {
  employeeId: number;
  employeeName: string;
  roleTitle: string;
  activeJobCount: number;
};

export type RecentProductionJobResponse = {
  id: number;
  jobNumber: string;
  customerFullName: string;
  productTypeLabel: string;
  currentStageName: string;
  assignedEmployeeName: string;
  priorityLabel: string;
  statusLabel: string;
  expectedDeliveryDate: string | null;
  createdAt: string;
};

export type RecentCustomerResponse = {
  id: number;
  fullName: string;
  phone: string | null;
  createdAt: string;
};

export type MonthlyTrendResponse = {
  month: string;
  customerCount: number;
  productionJobCount: number;
};

export type AdminDashboardResponse = {
  totalCustomers: number;
  totalProductionJobs: number;
  activeProductionJobs: number;
  completedProductionJobs: number;
  revisionJobs: number;
  urgentJobs: number;
  overdueJobs: number;
  dueThisWeekJobs: number;
  mainMetrics: DashboardMetricResponse[];
  stageWorkload: StageWorkloadResponse[];
  productTypeDistribution: ProductTypeStatsResponse[];
  priorityDistribution: PriorityStatsResponse[];
  employeeWorkload: EmployeeWorkloadResponse[];
  recentProductionJobs: RecentProductionJobResponse[];
  recentCustomers: RecentCustomerResponse[];
  monthlyTrend: MonthlyTrendResponse[];
};
