package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.MoveProductionJobRequest;
import com.erdalguda.tailor.dto.ProductionJobHistoryResponse;
import com.erdalguda.tailor.dto.ProductionJobRequest;
import com.erdalguda.tailor.dto.ProductionJobResponse;
import com.erdalguda.tailor.service.ProductionJobService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProductionJobController {

    private final ProductionJobService productionJobService;

    public ProductionJobController(ProductionJobService productionJobService) {
        this.productionJobService = productionJobService;
    }

    @GetMapping("/production-jobs")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProductionJobResponse>> getAllJobs() {
        return ResponseEntity.ok(productionJobService.getAllJobs());
    }

    @GetMapping("/production-jobs/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ProductionJobResponse> getJobById(@PathVariable Long id) {
        return ResponseEntity.ok(productionJobService.getJobById(id));
    }

    @GetMapping("/production-jobs/stage/{stageId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProductionJobResponse>> getJobsByStage(@PathVariable Long stageId) {
        return ResponseEntity.ok(productionJobService.getJobsByStage(stageId));
    }

    @GetMapping("/customers/{customerId}/production-jobs")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProductionJobResponse>> getJobsByCustomer(@PathVariable Long customerId) {
        return ResponseEntity.ok(productionJobService.getJobsByCustomer(customerId));
    }

    @PostMapping("/production-jobs")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<ProductionJobResponse> createJob(@Valid @RequestBody ProductionJobRequest request) {
        ProductionJobResponse response = productionJobService.createJob(request);
        return ResponseEntity
            .created(URI.create("/api/production-jobs/" + response.getId()))
            .body(response);
    }

    @PutMapping("/production-jobs/{id}/move")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ProductionJobResponse> moveJob(
        @PathVariable Long id,
        @RequestBody MoveProductionJobRequest request
    ) {
        return ResponseEntity.ok(productionJobService.moveJob(id, request));
    }

    @PutMapping("/production-jobs/{id}/complete")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ProductionJobResponse> completeJob(
        @PathVariable Long id,
        @RequestBody MoveProductionJobRequest request
    ) {
        return ResponseEntity.ok(
            productionJobService.completeJob(id, request.getPerformedByEmployeeId(), request.getNote())
        );
    }

    @PutMapping("/production-jobs/{id}/cancel")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductionJobResponse> cancelJob(
        @PathVariable Long id,
        @RequestBody MoveProductionJobRequest request
    ) {
        return ResponseEntity.ok(
            productionJobService.cancelJob(id, request.getPerformedByEmployeeId(), request.getNote())
        );
    }

    @GetMapping("/production-jobs/{id}/history")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<ProductionJobHistoryResponse>> getJobHistory(@PathVariable Long id) {
        return ResponseEntity.ok(productionJobService.getJobHistory(id));
    }
}
