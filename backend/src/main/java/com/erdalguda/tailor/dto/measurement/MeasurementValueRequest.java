package com.erdalguda.tailor.dto.measurement;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MeasurementValueRequest {

    private String definitionKey;
    private Integer definitionOrder;
    private String definitionLabel;
    private BigDecimal numericValue;
    private String unit;
    private String notes;
}
