package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.ProductType;
import com.erdalguda.tailor.entity.ProductionPriority;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProductionJobRequest {

    @NotNull
    private Long customerId;

    @NotNull
    private ProductType productType;

    private ProductionPriority priority = ProductionPriority.NORMAL;
    private LocalDate expectedDeliveryDate;
    private String notes;
}
