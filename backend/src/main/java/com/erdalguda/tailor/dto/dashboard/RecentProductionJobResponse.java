package com.erdalguda.tailor.dto.dashboard;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record RecentProductionJobResponse(
    Long id,
    String jobNumber,
    String customerFullName,
    String productTypeLabel,
    String currentStageName,
    String assignedEmployeeName,
    String priorityLabel,
    String statusLabel,
    LocalDate expectedDeliveryDate,
    LocalDateTime createdAt
) {
}
