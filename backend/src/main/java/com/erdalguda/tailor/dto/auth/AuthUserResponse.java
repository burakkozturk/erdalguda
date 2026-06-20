package com.erdalguda.tailor.dto.auth;

import com.erdalguda.tailor.entity.UserRole;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthUserResponse {

    private Long id;
    private String username;
    private String fullName;
    private String email;
    private UserRole role;
    private String roleLabel;
    private Long employeeId;
    private String employeeName;
    private Long customerId;
}
