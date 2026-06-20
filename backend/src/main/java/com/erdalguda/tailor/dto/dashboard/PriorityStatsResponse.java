package com.erdalguda.tailor.dto.dashboard;

import com.erdalguda.tailor.entity.ProductionPriority;

public record PriorityStatsResponse(ProductionPriority priority, String priorityLabel, long count) {
}
