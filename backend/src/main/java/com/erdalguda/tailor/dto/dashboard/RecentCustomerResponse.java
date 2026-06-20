package com.erdalguda.tailor.dto.dashboard;

import java.time.LocalDateTime;

public record RecentCustomerResponse(
    Long id,
    String fullName,
    String phone,
    LocalDateTime createdAt
) {
}
