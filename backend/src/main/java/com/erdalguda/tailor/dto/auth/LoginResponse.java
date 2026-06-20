package com.erdalguda.tailor.dto.auth;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {

    private String token;
    private AuthUserResponse user;
}
