package com.erdalguda.tailor.dto.vip;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VipCustomerResponse {
    private Long userId;
    private Long customerId;
    private String username;
    private String fullName;
    private String email;
}
