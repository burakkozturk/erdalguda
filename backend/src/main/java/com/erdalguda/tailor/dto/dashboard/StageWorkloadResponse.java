package com.erdalguda.tailor.dto.dashboard;

public record StageWorkloadResponse(
    Integer stageOrder,
    String stageName,
    String responsibleEmployeeName,
    long jobCount
) {
}
