package com.erdalguda.tailor.dto.dashboard;

public record EmployeeWorkloadResponse(Long employeeId, String employeeName, String roleTitle, long activeJobCount) {
}
