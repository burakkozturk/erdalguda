package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.MeasurementRequest;
import com.erdalguda.tailor.dto.MeasurementResponse;
import com.erdalguda.tailor.service.MeasurementService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeasurementController {

    private final MeasurementService measurementService;

    public MeasurementController(MeasurementService measurementService) {
        this.measurementService = measurementService;
    }

    @GetMapping("/api/customers/{customerId}/measurements")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<List<MeasurementResponse>> getMeasurementsByCustomerId(@PathVariable Long customerId) {
        return ResponseEntity.ok(measurementService.getMeasurementsByCustomerId(customerId));
    }

    @PostMapping("/api/customers/{customerId}/measurements")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<MeasurementResponse> createMeasurement(
        @PathVariable Long customerId,
        @Valid @RequestBody MeasurementRequest request
    ) {
        MeasurementResponse response = measurementService.createMeasurement(customerId, request);
        return ResponseEntity
            .created(URI.create("/api/measurements/" + response.getId()))
            .body(response);
    }

    @GetMapping("/api/measurements/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<MeasurementResponse> getMeasurementById(@PathVariable Long id) {
        return ResponseEntity.ok(measurementService.getMeasurementById(id));
    }

    @PutMapping("/api/measurements/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<MeasurementResponse> updateMeasurement(
        @PathVariable Long id,
        @Valid @RequestBody MeasurementRequest request
    ) {
        return ResponseEntity.ok(measurementService.updateMeasurement(id, request));
    }

    @DeleteMapping("/api/measurements/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<Void> deleteMeasurement(@PathVariable Long id) {
        measurementService.deleteMeasurement(id);
        return ResponseEntity.noContent().build();
    }
}
