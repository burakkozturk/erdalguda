package com.erdalguda.tailor.dto.dashboard;

import com.erdalguda.tailor.entity.ProductType;

public record ProductTypeStatsResponse(ProductType productType, String productTypeLabel, long count) {
}
