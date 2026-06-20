package com.erdalguda.tailor.dto.express;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ExpressRegistrationResponse {

    private Long customerId;
    private String customerFullName;
    private Long measurementSetId;
    private List<OrderResult> orders;
    private String message;

    @Getter
    @Builder
    public static class OrderResult {
        private Long orderId;
        private String orderNumber;
        private Long productionJobId;
        private String productionJobNumber;
        private String productionStageName;
    }
}
