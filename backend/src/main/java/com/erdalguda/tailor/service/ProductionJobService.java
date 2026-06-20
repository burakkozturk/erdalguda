package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.MoveProductionJobRequest;
import com.erdalguda.tailor.dto.ProductionJobHistoryResponse;
import com.erdalguda.tailor.dto.ProductionJobRequest;
import com.erdalguda.tailor.dto.ProductionJobResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.Employee;
import com.erdalguda.tailor.entity.ProductionActionType;
import com.erdalguda.tailor.entity.ProductionJob;
import com.erdalguda.tailor.entity.ProductionJobHistory;
import com.erdalguda.tailor.entity.ProductionJobStatus;
import com.erdalguda.tailor.entity.ProductionPriority;
import com.erdalguda.tailor.entity.ProductionStage;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.entity.UserRole;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.ProductionJobHistoryRepository;
import com.erdalguda.tailor.repository.ProductionJobRepository;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductionJobService {

    private static final int FIRST_STAGE_ORDER = 1;

    private final CustomerService customerService;
    private final AuthService authService;
    private final EmployeeService employeeService;
    private final ProductionStageService productionStageService;
    private final ProductionJobRepository productionJobRepository;
    private final ProductionJobHistoryRepository historyRepository;

    public ProductionJobService(
        CustomerService customerService,
        AuthService authService,
        EmployeeService employeeService,
        ProductionStageService productionStageService,
        ProductionJobRepository productionJobRepository,
        ProductionJobHistoryRepository historyRepository
    ) {
        this.customerService = customerService;
        this.authService = authService;
        this.employeeService = employeeService;
        this.productionStageService = productionStageService;
        this.productionJobRepository = productionJobRepository;
        this.historyRepository = historyRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductionJobResponse> getAllJobs() {
        // See ProductTypeConverter — legacy/unknown DB productType values
        // deserialise to null; we skip those rows rather than surfacing them.
        return productionJobRepository.findAll()
            .stream()
            .filter(job -> job.getProductType() != null)
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductionJobResponse> getJobsByStage(Long stageId) {
        productionStageService.findStage(stageId);
        return productionJobRepository.findByCurrentStageId(stageId)
            .stream()
            .filter(job -> job.getProductType() != null)
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ProductionJobResponse> getJobsByCustomer(Long customerId) {
        customerService.findCustomer(customerId);
        return productionJobRepository.findByCustomerId(customerId)
            .stream()
            .filter(job -> job.getProductType() != null)
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public ProductionJobResponse getJobById(Long id) {
        return toResponse(findJob(id));
    }

    @Transactional
    public ProductionJobResponse createJob(ProductionJobRequest request) {
        Customer customer = customerService.findCustomer(request.getCustomerId());
        ProductionStage firstStage = productionStageService.findStageByOrder(FIRST_STAGE_ORDER);

        ProductionJob job = new ProductionJob();
        job.setJobNumber(generateJobNumber());
        job.setCustomer(customer);
        job.setProductType(request.getProductType());
        job.setCurrentStage(firstStage);
        job.setAssignedEmployee(firstStage.getDefaultResponsibleEmployee());
        job.setPriority(request.getPriority() == null ? ProductionPriority.NORMAL : request.getPriority());
        job.setStatus(ProductionJobStatus.ACTIVE);
        job.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        job.setNotes(request.getNotes());

        ProductionJob savedJob = productionJobRepository.save(job);
        saveHistory(
            savedJob,
            null,
            firstStage,
            firstStage.getDefaultResponsibleEmployee(),
            ProductionActionType.CREATED,
            "Üretim işi oluşturuldu."
        );
        return toResponse(savedJob);
    }

    @Transactional
    public ProductionJobResponse moveJob(Long jobId, MoveProductionJobRequest request) {
        if (request.getToStageId() == null) {
            throw new IllegalArgumentException("toStageId is required.");
        }

        ProductionJob job = findJob(jobId);
        ensureCanOperateCurrentStage(job);
        ProductionStage fromStage = job.getCurrentStage();
        ProductionStage toStage = productionStageService.findStage(request.getToStageId());
        Employee performedBy = findOptionalEmployee(request.getPerformedByEmployeeId());

        job.setCurrentStage(toStage);
        job.setAssignedEmployee(toStage.getDefaultResponsibleEmployee());

        ProductionJob savedJob = productionJobRepository.save(job);
        saveHistory(
            savedJob,
            fromStage,
            toStage,
            performedBy,
            ProductionActionType.MOVED_STAGE,
            request.getNote()
        );
        return toResponse(savedJob);
    }

    @Transactional
    public ProductionJobResponse completeJob(Long jobId, Long performedByEmployeeId, String note) {
        ProductionJob job = findJob(jobId);
        ensureCanOperateCurrentStage(job);
        Employee performedBy = findOptionalEmployee(performedByEmployeeId);

        job.setStatus(ProductionJobStatus.COMPLETED);
        job.setCompletedAt(LocalDateTime.now());
        ProductionJob savedJob = productionJobRepository.save(job);

        saveHistory(
            savedJob,
            job.getCurrentStage(),
            job.getCurrentStage(),
            performedBy,
            ProductionActionType.COMPLETED,
            note
        );
        return toResponse(savedJob);
    }

    @Transactional
    public ProductionJobResponse cancelJob(Long jobId, Long performedByEmployeeId, String note) {
        ProductionJob job = findJob(jobId);
        Employee performedBy = findOptionalEmployee(performedByEmployeeId);

        job.setStatus(ProductionJobStatus.CANCELLED);
        ProductionJob savedJob = productionJobRepository.save(job);

        saveHistory(
            savedJob,
            job.getCurrentStage(),
            job.getCurrentStage(),
            performedBy,
            ProductionActionType.CANCELLED,
            note
        );
        return toResponse(savedJob);
    }

    @Transactional(readOnly = true)
    public List<ProductionJobHistoryResponse> getJobHistory(Long jobId) {
        findJob(jobId);
        return historyRepository.findByProductionJobIdOrderByCreatedAtDesc(jobId)
            .stream()
            .map(this::toHistoryResponse)
            .toList();
    }

    private ProductionJob findJob(Long id) {
        return productionJobRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Production job not found with id: " + id));
    }

    private Employee findOptionalEmployee(Long employeeId) {
        if (employeeId == null) {
            return null;
        }
        return employeeService.findEmployee(employeeId);
    }

    private void ensureCanOperateCurrentStage(ProductionJob job) {
        User user = authService.getAuthenticatedUser();
        if (user.getRole() == UserRole.ADMIN) {
            return;
        }
        if (user.getEmployee() == null) {
            throw new AccessDeniedException("Bu işlem için bağlı çalışan kaydı bulunmuyor.");
        }

        Long employeeId = user.getEmployee().getId();
        Long assignedEmployeeId = job.getAssignedEmployee() == null ? null : job.getAssignedEmployee().getId();
        Long responsibleEmployeeId = job.getCurrentStage().getDefaultResponsibleEmployee().getId();

        if (!employeeId.equals(assignedEmployeeId) && !employeeId.equals(responsibleEmployeeId)) {
            throw new AccessDeniedException("Bu işi taşımak için yetkiniz bulunmuyor.");
        }
    }

    private String generateJobNumber() {
        int year = Year.now().getValue();
        long nextNumber = productionJobRepository.findTopByOrderByIdDesc()
            .map(job -> job.getId() + 1)
            .orElse(1L);

        String jobNumber = formatJobNumber(year, nextNumber);
        while (productionJobRepository.existsByJobNumber(jobNumber)) {
            nextNumber++;
            jobNumber = formatJobNumber(year, nextNumber);
        }
        return jobNumber;
    }

    private String formatJobNumber(int year, long number) {
        return "EG-%d-%04d".formatted(year, number);
    }

    private void saveHistory(
        ProductionJob job,
        ProductionStage fromStage,
        ProductionStage toStage,
        Employee performedBy,
        ProductionActionType actionType,
        String note
    ) {
        ProductionJobHistory history = new ProductionJobHistory();
        history.setProductionJob(job);
        history.setFromStage(fromStage);
        history.setToStage(toStage);
        history.setPerformedByEmployee(performedBy);
        history.setActionType(actionType);
        history.setNote(note);
        historyRepository.save(history);
    }

    private ProductionJobResponse toResponse(ProductionJob job) {
        return ProductionJobResponse.builder()
            .id(job.getId())
            .jobNumber(job.getJobNumber())
            .customerId(job.getCustomer().getId())
            .customerFullName(job.getCustomer().getFirstName() + " " + job.getCustomer().getLastName())
            .relatedOrderId(job.getRelatedOrder() == null ? null : job.getRelatedOrder().getId())
            .relatedOrderNumber(job.getRelatedOrder() == null ? null : job.getRelatedOrder().getOrderNumber())
            .productType(job.getProductType())
            .productTypeDisplayName(job.getProductType() == null ? "-" : job.getProductType().getDisplayName())
            .currentStage(productionStageService.toResponse(job.getCurrentStage()))
            .assignedEmployee(employeeService.toResponse(job.getAssignedEmployee()))
            .priority(job.getPriority())
            .status(job.getStatus())
            .expectedDeliveryDate(job.getExpectedDeliveryDate())
            .notes(job.getNotes())
            .createdAt(job.getCreatedAt())
            .updatedAt(job.getUpdatedAt())
            .completedAt(job.getCompletedAt())
            .build();
    }

    private ProductionJobHistoryResponse toHistoryResponse(ProductionJobHistory history) {
        return ProductionJobHistoryResponse.builder()
            .id(history.getId())
            .productionJobId(history.getProductionJob().getId())
            .jobNumber(history.getProductionJob().getJobNumber())
            .fromStage(productionStageService.toResponse(history.getFromStage()))
            .toStage(productionStageService.toResponse(history.getToStage()))
            .performedByEmployee(employeeService.toResponse(history.getPerformedByEmployee()))
            .actionType(history.getActionType())
            .note(history.getNote())
            .createdAt(history.getCreatedAt())
            .build();
    }
}
