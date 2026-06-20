package com.erdalguda.tailor.dto.dashboard;

public record MonthlyTrendResponse(String month, long customerCount, long productionJobCount) {
}
