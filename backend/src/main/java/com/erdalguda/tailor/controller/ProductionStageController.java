package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.ProductionStageResponse;
import com.erdalguda.tailor.service.ProductionStageService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/production-stages")
public class ProductionStageController {

    private final ProductionStageService productionStageService;

    public ProductionStageController(ProductionStageService productionStageService) {
        this.productionStageService = productionStageService;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProductionStageResponse>> getAllActiveStagesOrdered() {
        return ResponseEntity.ok(productionStageService.getAllActiveStagesOrdered());
    }
}
