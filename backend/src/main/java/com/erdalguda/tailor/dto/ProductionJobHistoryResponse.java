package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.ProductionActionType;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductionJobHistoryResponse {

    private Long id;
    private Long productionJobId;
    private String jobNumber;
    private ProductionStageResponse fromStage;
    private ProductionStageResponse toStage;
    private EmployeeResponse performedByEmployee;
    private ProductionActionType actionType;
    private String note;
    private LocalDateTime createdAt;
}
