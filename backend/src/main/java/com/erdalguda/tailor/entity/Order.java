package com.erdalguda.tailor.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private OrderStatus status = OrderStatus.ACTIVE;

    @Column(nullable = false, length = 80)
    private String orderNumber;

    // No @Enumerated: ProductTypeConverter is auto-applied so unknown
    // legacy DB values (e.g. removed 'COAT') deserialise to null instead
    // of crashing Hibernate.
    @Column(length = 40)
    private ProductType productType;

    private LocalDate orderDate;
    private LocalDate expectedDeliveryDate;
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private CurrencyType currency = CurrencyType.TRY;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private OrderPaymentStatus paymentStatus = OrderPaymentStatus.UNPAID;

    private BigDecimal depositAmount;
    private BigDecimal remainingAmount;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = true)
    private String jacketStyleKey;

    @Column(nullable = true)
    private String jacketLapelStyle;

    @Column(nullable = true)
    private String jacketLapelWidth;

    @Column(nullable = true)
    private String jacketPocketStyle;

    @Column(nullable = true)
    private String jacketFabricKey;

    @Column(nullable = true)
    private String jacketFabricLabel;

    @Column(nullable = true)
    private String shirtCollarStyle;

    @Column(nullable = true)
    private String shirtCollarButtons;

    @Column(nullable = true)
    private String shirtCuffStyle;

    @Column(nullable = true)
    private String shirtFabricKey;

    @Column(nullable = true)
    private String shirtFabricLabel;

    @Column(nullable = true)
    private String tuxedoStyle;

    @Column(nullable = true)
    private String tuxedoLapelStyle;

    @Column(nullable = true)
    private String tuxedoLapelWidth;

    @Column(nullable = true)
    private String tuxedoPocketStyle;

    @Column(nullable = true)
    private String tuxedoFabricKey;

    @Column(nullable = true)
    private String tuxedoFabricLabel;

    @Column(nullable = true)
    private String vestLapelStyle;

    @Column(nullable = true)
    private String vestPocketStyle;

    @Column(nullable = true)
    private String vestFabricKey;

    @Column(nullable = true)
    private String vestFabricLabel;

    @Column(nullable = true)
    private String pantFasteningStyle;

    @Column(nullable = true)
    private String pantPleatStyle;

    @Column(nullable = true)
    private String pantFabricKey;

    @Column(nullable = true)
    private String pantFabricLabel;

    // -------------------------------------------------------------------------
    // Data-only configurator fields. These DO NOT drive the rendered PNG layer
    // composition in the frontend configurator — they are pure order metadata
    // that the customer chose during checkout (Fit, vent, paça, dökum, etc.).
    // -------------------------------------------------------------------------

    /** Jacket/Suit silhouette fit: slim / regular. */
    @Column(nullable = true, length = 20)
    private String jacketFit;

    /** Jacket/Suit back vent: single / double / none. */
    @Column(nullable = true, length = 20)
    private String jacketVent;

    /** Shirt silhouette fit: slim / normal. */
    @Column(nullable = true, length = 20)
    private String shirtFit;

    /** Pant silhouette fit: slim / normal. */
    @Column(nullable = true, length = 20)
    private String pantFit;

    /** Pant leg-end (paça): straight / cuffed. */
    @Column(nullable = true, length = 20)
    private String pantLegStyle;

    /** Pant drape (dökum): none / light / full. */
    @Column(nullable = true, length = 20)
    private String pantDrape;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @jakarta.persistence.PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (orderDate == null) {
            orderDate = LocalDate.now();
        }
        if (status == null) {
            status = OrderStatus.ACTIVE;
        }
        if (currency == null) {
            currency = CurrencyType.TRY;
        }
        if (paymentStatus == null) {
            paymentStatus = OrderPaymentStatus.UNPAID;
        }
        recalculateRemainingAmount();
    }

    @jakarta.persistence.PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        recalculateRemainingAmount();
    }

    public void recalculateRemainingAmount() {
        BigDecimal total = totalAmount == null ? BigDecimal.ZERO : totalAmount;
        BigDecimal deposit = depositAmount == null ? BigDecimal.ZERO : depositAmount;
        remainingAmount = total.subtract(deposit);
    }
}
