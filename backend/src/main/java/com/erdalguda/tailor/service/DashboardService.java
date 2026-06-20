package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.dashboard.AdminDashboardResponse;
import com.erdalguda.tailor.dto.dashboard.DashboardMetricResponse;
import com.erdalguda.tailor.dto.dashboard.EmployeeWorkloadResponse;
import com.erdalguda.tailor.dto.dashboard.MonthlyTrendResponse;
import com.erdalguda.tailor.dto.dashboard.PriorityStatsResponse;
import com.erdalguda.tailor.dto.dashboard.ProductTypeStatsResponse;
import com.erdalguda.tailor.dto.dashboard.RecentCustomerResponse;
import com.erdalguda.tailor.dto.dashboard.RecentProductionJobResponse;
import com.erdalguda.tailor.dto.dashboard.StageWorkloadResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.Employee;
import com.erdalguda.tailor.entity.ProductType;
import com.erdalguda.tailor.entity.ProductionJob;
import com.erdalguda.tailor.entity.ProductionJobStatus;
import com.erdalguda.tailor.entity.ProductionPriority;
import com.erdalguda.tailor.entity.ProductionStage;
import com.erdalguda.tailor.repository.CustomerRepository;
import com.erdalguda.tailor.repository.EmployeeRepository;
import com.erdalguda.tailor.repository.ProductionJobRepository;
import com.erdalguda.tailor.repository.ProductionStageRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DashboardService {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("MMM yyyy", Locale.forLanguageTag("tr-TR"));

    private final CustomerRepository customerRepository;
    private final ProductionJobRepository productionJobRepository;
    private final ProductionStageRepository productionStageRepository;
    private final EmployeeRepository employeeRepository;

    public DashboardService(
        CustomerRepository customerRepository,
        ProductionJobRepository productionJobRepository,
        ProductionStageRepository productionStageRepository,
        EmployeeRepository employeeRepository
    ) {
        this.customerRepository = customerRepository;
        this.productionJobRepository = productionJobRepository;
        this.productionStageRepository = productionStageRepository;
        this.employeeRepository = employeeRepository;
    }

    @Transactional(readOnly = true)
    public AdminDashboardResponse getAdminDashboard() {
        List<Customer> customers = customerRepository.findAll();
        List<ProductionJob> jobs = productionJobRepository.findAll();
        List<ProductionStage> stages = productionStageRepository.findByActiveTrueOrderByStageOrderAsc();
        List<Employee> employees = employeeRepository.findByActiveTrue();

        LocalDate today = LocalDate.now();
        LocalDate weekEnd = today.plusDays(7);

        long totalCustomers = customers.size();
        long totalProductionJobs = jobs.size();
        long activeProductionJobs = jobs.stream().filter(this::isActiveJob).count();
        long completedProductionJobs = jobs.stream().filter(job -> job.getStatus() == ProductionJobStatus.COMPLETED).count();
        long revisionJobs = jobs.stream().filter(job -> job.getStatus() == ProductionJobStatus.REVISION).count();
        long urgentJobs = jobs.stream()
            .filter(job -> job.getPriority() == ProductionPriority.URGENT)
            .filter(this::isActiveJob)
            .count();
        long overdueJobs = jobs.stream()
            .filter(this::isActiveJob)
            .filter(job -> job.getExpectedDeliveryDate() != null && job.getExpectedDeliveryDate().isBefore(today))
            .count();
        long dueThisWeekJobs = jobs.stream()
            .filter(this::isActiveJob)
            .filter(job -> job.getExpectedDeliveryDate() != null)
            .filter(job -> !job.getExpectedDeliveryDate().isBefore(today) && !job.getExpectedDeliveryDate().isAfter(weekEnd))
            .count();

        return new AdminDashboardResponse(
            totalCustomers,
            totalProductionJobs,
            activeProductionJobs,
            completedProductionJobs,
            revisionJobs,
            urgentJobs,
            overdueJobs,
            dueThisWeekJobs,
            mainMetrics(totalCustomers, totalProductionJobs, activeProductionJobs, completedProductionJobs, revisionJobs, urgentJobs, overdueJobs, dueThisWeekJobs),
            stageWorkload(stages, jobs),
            productDistribution(jobs),
            priorityDistribution(jobs),
            employeeWorkload(employees, jobs),
            recentProductionJobs(jobs),
            recentCustomers(customers),
            monthlyTrend(customers, jobs)
        );
    }

    private List<DashboardMetricResponse> mainMetrics(
        long totalCustomers,
        long totalProductionJobs,
        long activeProductionJobs,
        long completedProductionJobs,
        long revisionJobs,
        long urgentJobs,
        long overdueJobs,
        long dueThisWeekJobs
    ) {
        return List.of(
            new DashboardMetricResponse("totalCustomers", "Toplam Müşteri", totalCustomers),
            new DashboardMetricResponse("totalProductionJobs", "Toplam Üretim İşi", totalProductionJobs),
            new DashboardMetricResponse("activeProductionJobs", "Aktif İşler", activeProductionJobs),
            new DashboardMetricResponse("completedProductionJobs", "Tamamlanan İşler", completedProductionJobs),
            new DashboardMetricResponse("revisionJobs", "Revizedeki İşler", revisionJobs),
            new DashboardMetricResponse("urgentJobs", "Acil İşler", urgentJobs),
            new DashboardMetricResponse("overdueJobs", "Geciken İşler", overdueJobs),
            new DashboardMetricResponse("dueThisWeekJobs", "Bu Hafta Teslim", dueThisWeekJobs)
        );
    }

    private List<StageWorkloadResponse> stageWorkload(List<ProductionStage> stages, List<ProductionJob> jobs) {
        Map<Long, Long> countsByStageId = jobs.stream()
            .filter(this::isActiveJob)
            .filter(job -> job.getCurrentStage() != null)
            .collect(Collectors.groupingBy(job -> job.getCurrentStage().getId(), Collectors.counting()));

        return stages.stream()
            .map(stage -> new StageWorkloadResponse(
                stage.getStageOrder(),
                stage.getName(),
                stage.getDefaultResponsibleEmployee() == null ? null : stage.getDefaultResponsibleEmployee().getFullName(),
                countsByStageId.getOrDefault(stage.getId(), 0L)
            ))
            .toList();
    }

    private List<ProductTypeStatsResponse> productDistribution(List<ProductionJob> jobs) {
        Map<ProductType, Long> counts = jobs.stream()
            .filter(job -> job.getProductType() != null)
            .collect(Collectors.groupingBy(ProductionJob::getProductType, () -> new EnumMap<>(ProductType.class), Collectors.counting()));

        return List.of(ProductType.values()).stream()
            .map(type -> new ProductTypeStatsResponse(type, type.getDisplayName(), counts.getOrDefault(type, 0L)))
            .toList();
    }

    private List<PriorityStatsResponse> priorityDistribution(List<ProductionJob> jobs) {
        Map<ProductionPriority, Long> counts = jobs.stream()
            .filter(job -> job.getPriority() != null)
            .collect(Collectors.groupingBy(ProductionJob::getPriority, () -> new EnumMap<>(ProductionPriority.class), Collectors.counting()));

        return List.of(ProductionPriority.values()).stream()
            .map(priority -> new PriorityStatsResponse(priority, priorityLabel(priority), counts.getOrDefault(priority, 0L)))
            .toList();
    }

    private List<EmployeeWorkloadResponse> employeeWorkload(List<Employee> employees, List<ProductionJob> jobs) {
        Map<Long, Long> countsByEmployeeId = jobs.stream()
            .filter(this::isActiveJob)
            .filter(job -> job.getAssignedEmployee() != null)
            .collect(Collectors.groupingBy(job -> job.getAssignedEmployee().getId(), Collectors.counting()));

        return employees.stream()
            .sorted(Comparator.comparing(Employee::getFullName))
            .map(employee -> new EmployeeWorkloadResponse(
                employee.getId(),
                employee.getFullName(),
                employee.getRoleTitle(),
                countsByEmployeeId.getOrDefault(employee.getId(), 0L)
            ))
            .toList();
    }

    private List<RecentProductionJobResponse> recentProductionJobs(List<ProductionJob> jobs) {
        return jobs.stream()
            .sorted(Comparator.comparing(ProductionJob::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(8)
            .map(job -> new RecentProductionJobResponse(
                job.getId(),
                job.getJobNumber(),
                job.getCustomer() == null ? "-" : job.getCustomer().getFirstName() + " " + job.getCustomer().getLastName(),
                job.getProductType() == null ? "-" : job.getProductType().getDisplayName(),
                job.getCurrentStage() == null ? "-" : job.getCurrentStage().getName(),
                job.getAssignedEmployee() == null ? "-" : job.getAssignedEmployee().getFullName(),
                priorityLabel(job.getPriority()),
                statusLabel(job.getStatus()),
                job.getExpectedDeliveryDate(),
                job.getCreatedAt()
            ))
            .toList();
    }

    private List<RecentCustomerResponse> recentCustomers(List<Customer> customers) {
        return customers.stream()
            .sorted(Comparator.comparing(Customer::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .limit(8)
            .map(customer -> new RecentCustomerResponse(
                customer.getId(),
                customer.getFirstName() + " " + customer.getLastName(),
                customer.getPhone(),
                customer.getCreatedAt()
            ))
            .toList();
    }

    private List<MonthlyTrendResponse> monthlyTrend(List<Customer> customers, List<ProductionJob> jobs) {
        YearMonth start = YearMonth.now().minusMonths(5);
        Map<YearMonth, Long> customersByMonth = countByMonth(customers, customer -> YearMonth.from(customer.getCreatedAt()));
        Map<YearMonth, Long> jobsByMonth = countByMonth(jobs, job -> YearMonth.from(job.getCreatedAt()));

        Map<YearMonth, MonthlyTrendResponse> trend = new LinkedHashMap<>();
        for (int index = 0; index < 6; index++) {
            YearMonth month = start.plusMonths(index);
            trend.put(month, new MonthlyTrendResponse(
                month.format(MONTH_FORMATTER),
                customersByMonth.getOrDefault(month, 0L),
                jobsByMonth.getOrDefault(month, 0L)
            ));
        }
        return List.copyOf(trend.values());
    }

    private <T> Map<YearMonth, Long> countByMonth(List<T> items, Function<T, YearMonth> monthResolver) {
        return items.stream()
            .filter(item -> {
                try {
                    return monthResolver.apply(item) != null;
                } catch (RuntimeException exception) {
                    return false;
                }
            })
            .collect(Collectors.groupingBy(monthResolver, Collectors.counting()));
    }

    private boolean isActiveJob(ProductionJob job) {
        return job.getStatus() != ProductionJobStatus.COMPLETED && job.getStatus() != ProductionJobStatus.CANCELLED;
    }

    private String priorityLabel(ProductionPriority priority) {
        if (priority == null) {
            return "-";
        }
        return switch (priority) {
            case LOW -> "Düşük";
            case NORMAL -> "Normal";
            case HIGH -> "Yüksek";
            case URGENT -> "Acil";
        };
    }

    private String statusLabel(ProductionJobStatus status) {
        if (status == null) {
            return "-";
        }
        return switch (status) {
            case ACTIVE -> "Aktif";
            case WAITING -> "Beklemede";
            case REVISION -> "Revize";
            case COMPLETED -> "Tamamlandı";
            case CANCELLED -> "İptal Edildi";
        };
    }
}
