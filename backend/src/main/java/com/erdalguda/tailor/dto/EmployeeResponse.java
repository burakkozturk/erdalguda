package com.erdalguda.tailor.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class EmployeeResponse {

    private Long id;
    private String fullName;
    private String roleTitle;
    private boolean active;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
