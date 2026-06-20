package com.erdalguda.tailor.dto.auth;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminResetPasswordRequest {

    private String newPassword;
}
