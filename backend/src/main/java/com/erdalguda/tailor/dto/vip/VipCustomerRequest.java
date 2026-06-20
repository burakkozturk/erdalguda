package com.erdalguda.tailor.dto.vip;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VipCustomerRequest {

    @NotBlank
    @Size(max = 80)
    private String username;

    @NotBlank
    @Size(min = 8, max = 120)
    private String password;

    @NotBlank
    @Size(max = 120)
    private String firstName;

    @NotBlank
    @Size(max = 120)
    private String lastName;

    @Size(max = 40)
    private String phone;

    @Email
    @Size(max = 160)
    private String email;
}
