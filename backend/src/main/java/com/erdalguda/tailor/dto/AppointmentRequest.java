package com.erdalguda.tailor.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppointmentRequest {

    @NotBlank
    private String fullName;

    @NotBlank
    private String phone;

    @Email
    private String email;

    private String requestedService;
    private LocalDate preferredDate;
    private String notes;
}
