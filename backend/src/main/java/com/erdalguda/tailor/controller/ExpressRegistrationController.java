package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.express.ExpressRegistrationRequest;
import com.erdalguda.tailor.dto.express.ExpressRegistrationResponse;
import com.erdalguda.tailor.service.ExpressRegistrationService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/express-registration")
@PreAuthorize("isAuthenticated()")
public class ExpressRegistrationController {

    private final ExpressRegistrationService expressRegistrationService;

    public ExpressRegistrationController(ExpressRegistrationService expressRegistrationService) {
        this.expressRegistrationService = expressRegistrationService;
    }

    @PostMapping
    public ResponseEntity<ExpressRegistrationResponse> createExpressRegistration(
        @Valid @RequestBody ExpressRegistrationRequest request
    ) {
        ExpressRegistrationResponse response = expressRegistrationService.createExpressRegistration(request);
        return ResponseEntity.created(URI.create("/api/customers/" + response.getCustomerId())).body(response);
    }
}
