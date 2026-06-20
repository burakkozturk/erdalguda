package com.erdalguda.tailor.dto.express;

import com.erdalguda.tailor.dto.measurement.MeasurementValueRequest;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExpressMeasurementRequest {

    private LocalDate measuredAt;
    private String notes;
    private List<MeasurementValueRequest> values = new ArrayList<>();
}
