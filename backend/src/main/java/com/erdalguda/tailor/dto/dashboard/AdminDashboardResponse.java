package com.erdalguda.tailor.dto.dashboard;

import java.util.List;

public record AdminDashboardResponse(
    long totalCustomers,
    long totalProductionJobs,
    long activeProductionJobs,
    long completedProductionJobs,
    long revisionJobs,
    long urgentJobs,
    long overdueJobs,
    long dueThisWeekJobs,
    List<DashboardMetricResponse> mainMetrics,
    List<StageWorkloadResponse> stageWorkload,
    List<ProductTypeStatsResponse> productTypeDistribution,
    List<PriorityStatsResponse> priorityDistribution,
    List<EmployeeWorkloadResponse> employeeWorkload,
    List<RecentProductionJobResponse> recentProductionJobs,
    List<RecentCustomerResponse> recentCustomers,
    List<MonthlyTrendResponse> monthlyTrend
) {
}
