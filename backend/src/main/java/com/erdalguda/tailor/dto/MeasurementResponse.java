package com.erdalguda.tailor.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MeasurementResponse {

    private Long id;
    private Long customerId;
    private LocalDate measuredAt;
    private BigDecimal heightCm;
    private BigDecimal weightKg;
    private BigDecimal neck;
    private BigDecimal chest;
    private BigDecimal waist;
    private BigDecimal hip;
    private BigDecimal shoulderWidth;
    private BigDecimal backWidth;
    private BigDecimal sleeveLength;
    private BigDecimal biceps;
    private BigDecimal wrist;
    private BigDecimal jacketLength;
    private BigDecimal backLength;
    private BigDecimal trouserWaist;
    private BigDecimal trouserHip;
    private BigDecimal trouserOutseam;
    private BigDecimal trouserInseam;
    private BigDecimal thigh;
    private BigDecimal knee;
    private BigDecimal ankle;
    private String postureNotes;
    private String generalNotes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
