package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.UserRole;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class UserResponse {

    private Long id;
    private String username;
    private String fullName;
    private String email;
    private UserRole role;
    private String roleLabel;
    private Long employeeId;
    private String employeeName;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
