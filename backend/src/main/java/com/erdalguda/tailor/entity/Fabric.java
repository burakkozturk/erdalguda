package com.erdalguda.tailor.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "fabrics")
public class Fabric {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String fabricId;

    @Column(unique = true)
    private String key;

    @Column(nullable = false)
    private String name;

    private String label;
    private String subtitle;

    @Column(name = "is_default", nullable = false)
    private boolean defaultFabric = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GarmentType type = GarmentType.JACKET;

    private String tag;

    @Column(nullable = false)
    private boolean inStock = true;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private String createdBy;

    @PrePersist
    void prePersist() {
        createdAt = LocalDateTime.now();
    }
}
