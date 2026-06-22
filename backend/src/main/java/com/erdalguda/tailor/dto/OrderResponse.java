package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.CurrencyType;
import com.erdalguda.tailor.entity.OrderPaymentStatus;
import com.erdalguda.tailor.entity.OrderStatus;
import com.erdalguda.tailor.entity.ProductType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class OrderResponse {

    private Long id;
    private String orderNumber;
    private Long customerId;
    private String customerFullName;
    private ProductType productType;
    private String productTypeLabel;
    private LocalDate orderDate;
    private LocalDate expectedDeliveryDate;
    private BigDecimal totalAmount;
    private CurrencyType currency;
    private String currencyLabel;
    private OrderPaymentStatus paymentStatus;
    private String paymentStatusLabel;
    private BigDecimal depositAmount;
    private BigDecimal remainingAmount;
    private OrderStatus status;
    private String statusLabel;
    private Long productionJobId;
    private String productionJobNumber;
    private String productionStageName;
    private Integer productionStageOrder;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    private String jacketStyleKey;
    private String jacketLapelStyle;
    private String jacketLapelWidth;
    private String jacketPocketStyle;
    private String jacketFabricKey;
    private String jacketFabricLabel;

    private String shirtCollarStyle;
    private String shirtCollarButtons;
    private String shirtCuffStyle;
    private String shirtFabricKey;
    private String shirtFabricLabel;

    private String tuxedoStyle;
    private String tuxedoLapelStyle;
    private String tuxedoLapelWidth;
    private String tuxedoPocketStyle;
    private String tuxedoFabricKey;
    private String tuxedoFabricLabel;

    private String vestLapelStyle;
    private String vestPocketStyle;
    private String vestFabricKey;
    private String vestFabricLabel;

    private String pantFasteningStyle;
    private String pantPleatStyle;
    private String pantFabricKey;
    private String pantFabricLabel;

    // Data-only fields (Fit, vent, paça, dökum, …) — see OrderRequest.
    private String jacketFit;
    private String jacketVent;
    private String shirtFit;
    private String pantFit;
    private String pantLegStyle;
    private String pantDrape;

    // Palto (Overcoat) fields
    private String coatStyle;
    private String coatCollarStyle;
    private String coatLapelStyle;
    private String coatLapelLength;
    private String coatLapelWidth;
    private String coatFastening;
    private String coatPocketStyle;
    private String coatFabricKey;
    private String coatFabricLabel;
}
