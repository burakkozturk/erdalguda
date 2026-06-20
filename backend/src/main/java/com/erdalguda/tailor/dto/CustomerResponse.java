package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.Gender;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CustomerResponse {

    private Long id;
    private String firstName;
    private String lastName;
    private String phone;
    private String email;
    private Gender gender;
    private BigDecimal heightCm;
    private BigDecimal weightKg;
    private String address;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
