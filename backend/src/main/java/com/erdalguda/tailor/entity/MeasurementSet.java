package com.erdalguda.tailor.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "measurement_sets")
public class MeasurementSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false)
    private LocalDate measuredAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measured_by_user_id")
    private User measuredByUser;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "measured_by_employee_id")
    private Employee measuredByEmployee;

    @Column(columnDefinition = "text")
    private String notes;

    @OneToMany(mappedBy = "measurementSet", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MeasurementValue> values = new ArrayList<>();

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
