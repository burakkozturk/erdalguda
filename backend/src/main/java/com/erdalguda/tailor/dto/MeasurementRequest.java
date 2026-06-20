package com.erdalguda.tailor.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MeasurementRequest {

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
}
