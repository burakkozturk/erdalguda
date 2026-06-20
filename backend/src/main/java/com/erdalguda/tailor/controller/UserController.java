package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.MessageResponse;
import com.erdalguda.tailor.dto.UserResponse;
import com.erdalguda.tailor.dto.auth.AdminResetPasswordRequest;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.repository.UserRepository;
import com.erdalguda.tailor.service.AuthService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserRepository userRepository;
    private final AuthService authService;

    public UserController(UserRepository userRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.authService = authService;
    }

    @GetMapping
    public List<UserResponse> listUsers() {
        return userRepository.findByActiveTrueOrderByFullNameAsc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @PutMapping("/{id}/reset-password")
    public MessageResponse resetPassword(
        @PathVariable Long id,
        @Valid @RequestBody(required = false) AdminResetPasswordRequest request
    ) {
        authService.resetUserPasswordAsAdmin(id, request == null ? null : request.getNewPassword());
        return new MessageResponse("Şifre başarıyla sıfırlandı.");
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .email(user.getEmail())
            .role(user.getRole())
            .roleLabel(user.getRole().getLabel())
            .employeeId(user.getEmployee() == null ? null : user.getEmployee().getId())
            .employeeName(user.getEmployee() == null ? null : user.getEmployee().getFullName())
            .active(user.isActive())
            .createdAt(user.getCreatedAt())
            .updatedAt(user.getUpdatedAt())
            .build();
    }
}
