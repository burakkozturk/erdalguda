package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.MessageResponse;
import com.erdalguda.tailor.dto.auth.AuthUserResponse;
import com.erdalguda.tailor.dto.auth.ChangePasswordRequest;
import com.erdalguda.tailor.dto.auth.LoginRequest;
import com.erdalguda.tailor.dto.auth.LoginResponse;
import com.erdalguda.tailor.service.AuthService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthUserResponse> me() {
        return ResponseEntity.ok(authService.getCurrentUser());
    }

    @PutMapping("/change-password")
    public ResponseEntity<MessageResponse> changePassword(
        Principal principal,
        @Valid @RequestBody ChangePasswordRequest request
    ) {
        authService.changeOwnPassword(principal.getName(), request);
        return ResponseEntity.ok(new MessageResponse("Şifre başarıyla değiştirildi."));
    }
}
