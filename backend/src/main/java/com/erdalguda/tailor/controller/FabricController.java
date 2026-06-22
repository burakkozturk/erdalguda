package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.FabricRequest;
import com.erdalguda.tailor.dto.FabricResponse;
import com.erdalguda.tailor.entity.GarmentType;
import com.erdalguda.tailor.service.FabricService;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fabrics")
public class FabricController {

    private final FabricService fabricService;

    public FabricController(FabricService fabricService) {
        this.fabricService = fabricService;
    }

    @GetMapping
    public List<FabricResponse> listFabrics(
        @RequestParam(required = false) GarmentType type
    ) {
        return fabricService.findAll(type);
    }

    @GetMapping("/{fabricId}")
    public FabricResponse getFabric(@PathVariable String fabricId) {
        return fabricService.findByFabricId(fabricId);
    }

    @PostMapping
    public ResponseEntity<FabricResponse> createFabric(@RequestBody FabricRequest request) {
        FabricResponse response = fabricService.create(request);
        return ResponseEntity.created(URI.create("/api/fabrics/" + response.getFabricId())).body(response);
    }

    @PostMapping("/generate")
    public ResponseEntity<String> generateFabric(HttpServletRequest request) throws IOException {
        String contentType = request.getHeader(HttpHeaders.CONTENT_TYPE);
        return fabricService.generate(request.getInputStream().readAllBytes(), contentType);
    }

    @PutMapping("/{fabricId}")
    @PreAuthorize("hasRole('ADMIN')")
    public FabricResponse updateFabric(
        @PathVariable String fabricId,
        @RequestBody FabricRequest request
    ) {
        return fabricService.update(fabricId, request);
    }

    @DeleteMapping("/{fabricId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteFabric(@PathVariable String fabricId) {
        fabricService.delete(fabricId);
        return ResponseEntity.noContent().build();
    }
}
