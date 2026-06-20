package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.CurrencyType;
import com.erdalguda.tailor.entity.OrderPaymentStatus;
import com.erdalguda.tailor.entity.OrderStatus;
import com.erdalguda.tailor.entity.ProductType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OrderRequest {

    @NotNull
    private Long customerId;

    @NotNull
    private ProductType productType;

    private LocalDate orderDate;
    private LocalDate expectedDeliveryDate;

    @PositiveOrZero
    private BigDecimal totalAmount;

    @PositiveOrZero
    private BigDecimal depositAmount;

    private CurrencyType currency;
    private OrderPaymentStatus paymentStatus;
    private String notes;
    private OrderStatus status;

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

    // -------------------------------------------------------------------------
    // Data-only configurator fields (no visual rendering effect).
    // -------------------------------------------------------------------------
    private String jacketFit;
    private String jacketVent;
    private String shirtFit;
    private String pantFit;
    private String pantLegStyle;
    private String pantDrape;
}
