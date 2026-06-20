package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.AppointmentStatus;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AppointmentResponse {

    private Long id;
    private String fullName;
    private String phone;
    private String email;
    private String requestedService;
    private LocalDate preferredDate;
    private String notes;
    private AppointmentStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
