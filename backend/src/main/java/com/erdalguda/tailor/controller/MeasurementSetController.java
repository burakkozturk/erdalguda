package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.measurement.MeasurementDefinitionResponse;
import com.erdalguda.tailor.dto.measurement.MeasurementSetRequest;
import com.erdalguda.tailor.dto.measurement.MeasurementSetResponse;
import com.erdalguda.tailor.service.MeasurementSetService;
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
public class MeasurementSetController {

    private final MeasurementSetService measurementSetService;

    public MeasurementSetController(MeasurementSetService measurementSetService) {
        this.measurementSetService = measurementSetService;
    }

    @GetMapping("/api/measurement-definitions")
    @PreAuthorize("isAuthenticated()")
    public List<MeasurementDefinitionResponse> listMeasurementDefinitions() {
        return measurementSetService.listMeasurementDefinitions();
    }

    @GetMapping("/api/measurement-sets")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public List<MeasurementSetResponse> listMeasurementSets() {
        return measurementSetService.listMeasurementSets();
    }

    @GetMapping("/api/measurement-sets/{id}")
    @PreAuthorize("isAuthenticated()")
    public MeasurementSetResponse getMeasurementSet(@PathVariable Long id) {
        return measurementSetService.getMeasurementSetById(id);
    }

    @GetMapping("/api/customers/{customerId}/measurement-sets")
    @PreAuthorize("isAuthenticated()")
    public List<MeasurementSetResponse> listCustomerMeasurementSets(@PathVariable Long customerId) {
        return measurementSetService.listMeasurementSetsByCustomer(customerId);
    }

    @PostMapping("/api/measurement-sets")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<MeasurementSetResponse> createMeasurementSet(@Valid @RequestBody MeasurementSetRequest request) {
        MeasurementSetResponse response = measurementSetService.createMeasurementSet(request);
        return ResponseEntity.created(URI.create("/api/measurement-sets/" + response.getId())).body(response);
    }

    @PutMapping("/api/measurement-sets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public MeasurementSetResponse updateMeasurementSet(@PathVariable Long id, @Valid @RequestBody MeasurementSetRequest request) {
        return measurementSetService.updateMeasurementSet(id, request);
    }

    @DeleteMapping("/api/measurement-sets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SALES')")
    public ResponseEntity<Void> deleteMeasurementSet(@PathVariable Long id) {
        measurementSetService.deleteMeasurementSet(id);
        return ResponseEntity.noContent().build();
    }
}
