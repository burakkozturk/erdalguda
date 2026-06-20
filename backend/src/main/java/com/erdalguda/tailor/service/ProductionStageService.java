package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.ProductionStageResponse;
import com.erdalguda.tailor.entity.ProductionStage;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.ProductionStageRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductionStageService {

    private final EmployeeService employeeService;
    private final ProductionStageRepository productionStageRepository;

    public ProductionStageService(
        EmployeeService employeeService,
        ProductionStageRepository productionStageRepository
    ) {
        this.employeeService = employeeService;
        this.productionStageRepository = productionStageRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductionStageResponse> getAllActiveStagesOrdered() {
        return productionStageRepository.findByActiveTrueOrderByStageOrderAsc()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    ProductionStage findStage(Long id) {
        return productionStageRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Production stage not found with id: " + id));
    }

    ProductionStage findStageByOrder(Integer stageOrder) {
        return productionStageRepository.findByStageOrder(stageOrder)
            .orElseThrow(() -> new ResourceNotFoundException("Production stage not found with order: " + stageOrder));
    }

    ProductionStageResponse toResponse(ProductionStage stage) {
        if (stage == null) {
            return null;
        }
        return ProductionStageResponse.builder()
            .id(stage.getId())
            .stageOrder(stage.getStageOrder())
            .name(stage.getName())
            .description(stage.getDescription())
            .defaultResponsibleEmployee(employeeService.toResponse(stage.getDefaultResponsibleEmployee()))
            .active(stage.isActive())
            .createdAt(stage.getCreatedAt())
            .updatedAt(stage.getUpdatedAt())
            .build();
    }
}
