package com.erdalguda.tailor.dto.measurement;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MeasurementValueResponse {

    private Long id;
    private String definitionKey;
    private Integer definitionOrder;
    private String definitionLabel;
    private BigDecimal numericValue;
    private String unit;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
