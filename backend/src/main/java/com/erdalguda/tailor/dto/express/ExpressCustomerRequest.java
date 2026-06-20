package com.erdalguda.tailor.dto.express;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExpressCustomerRequest {

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    @NotBlank
    private String phone;

    @Email
    private String email;

    @Positive
    private BigDecimal heightCm;

    @Positive
    private BigDecimal weightKg;

    private String address;
    private String notes;
}
