package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.ProductType;
import com.erdalguda.tailor.entity.ProductionJobStatus;
import com.erdalguda.tailor.entity.ProductionPriority;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductionJobResponse {

    private Long id;
    private String jobNumber;
    private Long customerId;
    private String customerFullName;
    private Long relatedOrderId;
    private String relatedOrderNumber;
    private ProductType productType;
    private String productTypeDisplayName;
    private ProductionStageResponse currentStage;
    private EmployeeResponse assignedEmployee;
    private ProductionPriority priority;
    private ProductionJobStatus status;
    private LocalDate expectedDeliveryDate;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime completedAt;
}
