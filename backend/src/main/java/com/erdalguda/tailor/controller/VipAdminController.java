package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.vip.VipCustomerRequest;
import com.erdalguda.tailor.dto.vip.VipCustomerResponse;
import com.erdalguda.tailor.service.VipCustomerService;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class VipAdminController {

    private final VipCustomerService vipCustomerService;

    public VipAdminController(VipCustomerService vipCustomerService) {
        this.vipCustomerService = vipCustomerService;
    }

    @PostMapping("/vip")
    public ResponseEntity<VipCustomerResponse> createVipCustomer(
        @Valid @RequestBody VipCustomerRequest request
    ) {
        VipCustomerResponse response = vipCustomerService.createVipCustomer(request);
        return ResponseEntity.created(URI.create("/api/admin/users/vip/" + response.getUserId()))
            .body(response);
    }
}
