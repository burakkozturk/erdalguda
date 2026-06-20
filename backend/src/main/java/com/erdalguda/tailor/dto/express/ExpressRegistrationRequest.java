package com.erdalguda.tailor.dto.express;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ExpressRegistrationRequest {

    @Valid
    @NotNull
    private ExpressCustomerRequest customer;

    @Valid
    private ExpressMeasurementRequest measurement;

    @Valid
    @NotNull
    @Size(min = 1)
    private List<ExpressOrderRequest> orders;
}
