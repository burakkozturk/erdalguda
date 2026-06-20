package com.erdalguda.tailor.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ProductionStageResponse {

    private Long id;
    private Integer stageOrder;
    private String name;
    private String description;
    private EmployeeResponse defaultResponsibleEmployee;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
