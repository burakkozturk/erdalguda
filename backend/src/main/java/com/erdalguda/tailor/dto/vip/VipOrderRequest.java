package com.erdalguda.tailor.dto.vip;

import com.erdalguda.tailor.entity.ProductType;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VipOrderRequest {

    @NotNull
    private ProductType productType;

    private LocalDate expectedDeliveryDate;
    private BigDecimal totalAmount;
    private String notes;

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
