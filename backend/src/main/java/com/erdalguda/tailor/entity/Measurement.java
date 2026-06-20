package com.erdalguda.tailor.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurements")
public class Measurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false)
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

    @Column(columnDefinition = "text")
    private String postureNotes;

    @Column(columnDefinition = "text")
    private String generalNotes;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (measuredAt == null) {
            measuredAt = LocalDate.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        if (measuredAt == null) {
            measuredAt = LocalDate.now();
        }
    }
}
