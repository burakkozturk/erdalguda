package com.erdalguda.tailor.dto.measurement;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MeasurementSetResponse {

    private Long id;
    private Long customerId;
    private String customerFullName;
    private LocalDate measuredAt;
    private String measuredByUserFullName;
    private String notes;
    private List<MeasurementValueResponse> values;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
