package com.erdalguda.tailor.dto.measurement;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MeasurementSetRequest {

    @NotNull
    private Long customerId;

    private LocalDate measuredAt;
    private String notes;
    private List<MeasurementValueRequest> values = new ArrayList<>();
}
