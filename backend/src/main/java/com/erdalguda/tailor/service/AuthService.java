package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.auth.AuthUserResponse;
import com.erdalguda.tailor.dto.auth.ChangePasswordRequest;
import com.erdalguda.tailor.dto.auth.LoginRequest;
import com.erdalguda.tailor.dto.auth.LoginResponse;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.UserRepository;
import com.erdalguda.tailor.security.CustomUserDetails;
import com.erdalguda.tailor.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final String DEFAULT_SEEDED_PASSWORD = "erdalguda123";

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
        AuthenticationManager authenticationManager,
        JwtService jwtService,
        UserRepository userRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();

        return LoginResponse.builder()
            .token(jwtService.generateToken(user))
            .user(toAuthUserResponse(user))
            .build();
    }

    @Transactional(readOnly = true)
    public AuthUserResponse getCurrentUser() {
        User user = getAuthenticatedUser();
        return toAuthUserResponse(user);
    }

    @Transactional
    public void changeOwnPassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı."));

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Mevcut şifre hatalı.");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Yeni şifre ve tekrarı eşleşmiyor.");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    @Transactional
    public void resetUserPasswordAsAdmin(Long userId, String newPasswordOrDefault) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("Kullanıcı bulunamadı."));
        String rawPassword = (newPasswordOrDefault == null || newPasswordOrDefault.isBlank())
            ? DEFAULT_SEEDED_PASSWORD
            : newPasswordOrDefault;

        if (rawPassword.length() < 8) {
            throw new IllegalArgumentException("Yeni şifre en az 8 karakter olmalıdır.");
        }

        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
    }

    public User getAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user not found.");
        }
        return userRepository.findById(userDetails.getUser().getId())
            .orElseThrow(() -> new IllegalStateException("Authenticated user not found."));
    }

    public AuthUserResponse toAuthUserResponse(User user) {
        return AuthUserResponse.builder()
            .id(user.getId())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .email(user.getEmail())
            .role(user.getRole())
            .roleLabel(user.getRole().getLabel())
            .employeeId(user.getEmployee() == null ? null : user.getEmployee().getId())
            .employeeName(user.getEmployee() == null ? null : user.getEmployee().getFullName())
            .customerId(user.getCustomer() == null ? null : user.getCustomer().getId())
            .build();
    }
}
