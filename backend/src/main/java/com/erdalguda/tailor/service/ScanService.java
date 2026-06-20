package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.scan.FabricScanResponse;
import com.erdalguda.tailor.dto.scan.OrderScanResponse;
import com.erdalguda.tailor.dto.scan.OrderScanResponse.MeasurementItem;
import com.erdalguda.tailor.dto.scan.OrderScanResponse.RenderHint;
import com.erdalguda.tailor.dto.scan.OrderScanResponse.StyleItem;
import com.erdalguda.tailor.entity.Fabric;
import com.erdalguda.tailor.entity.GarmentType;
import com.erdalguda.tailor.entity.MeasurementSet;
import com.erdalguda.tailor.entity.MeasurementValue;
import com.erdalguda.tailor.entity.Order;
import com.erdalguda.tailor.entity.ProductType;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.FabricRepository;
import com.erdalguda.tailor.repository.MeasurementSetRepository;
import com.erdalguda.tailor.repository.OrderRepository;
import com.erdalguda.tailor.repository.ProductionJobRepository;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScanService {

    private static final String S3_BASE = "https://erdalguda-assets.s3.eu-north-1.amazonaws.com";
    private static final String BLAZER_SWATCH = S3_BASE + "/blazer/generated-swatches/%s.png";
    private static final String SHIRT_SWATCH  = S3_BASE + "/shirts/generated-swatches/%s.png";

    private final OrderRepository orderRepository;
    private final FabricRepository fabricRepository;
    private final MeasurementSetRepository measurementSetRepository;
    private final ProductionJobRepository productionJobRepository;

    public ScanService(
        OrderRepository orderRepository,
        FabricRepository fabricRepository,
        MeasurementSetRepository measurementSetRepository,
        ProductionJobRepository productionJobRepository
    ) {
        this.orderRepository = orderRepository;
        this.fabricRepository = fabricRepository;
        this.measurementSetRepository = measurementSetRepository;
        this.productionJobRepository = productionJobRepository;
    }

    @Transactional(readOnly = true)
    public OrderScanResponse getOrderScan(String orderNumber) {
        Order order = orderRepository.findByOrderNumber(orderNumber)
            .orElseThrow(() -> new ResourceNotFoundException("Sipariş bulunamadı: " + orderNumber));

        String stageName = productionJobRepository.findByRelatedOrderId(order.getId())
            .map(job -> job.getCurrentStage() != null ? job.getCurrentStage().getName() : null)
            .orElse(null);

        // order.getCustomer() is LAZY — accessed here inside the active transaction
        String customerName = order.getCustomer().getFirstName() + " " + order.getCustomer().getLastName();
        Long customerId = order.getCustomer().getId();

        return OrderScanResponse.builder()
            .orderNumber(order.getOrderNumber())
            .customerFullName(customerName)
            .productTypeLabel(order.getProductType() != null ? order.getProductType().name() : "—")
            .productionStageName(stageName)
            .orderStatusLabel(order.getStatus() != null ? order.getStatus().name() : "—")
            .notes(order.getNotes())
            .primaryFabricSwatchUrl(resolvePrimarySwatchUrl(order))
            .renderHint(buildRenderHint(order))
            .styleItems(buildStyleItems(order))
            .measurements(buildMeasurements(customerId))
            .build();
    }

    @Transactional(readOnly = true)
    public FabricScanResponse getFabricScan(String fabricId) {
        Fabric fabric = fabricRepository.findByFabricId(fabricId)
            .orElseThrow(() -> new ResourceNotFoundException("Kumaş bulunamadı: " + fabricId));

        String typeLabel = switch (fabric.getType()) {
            case JACKET -> "Ceket / Takım Elbise";
            case SHIRT  -> "Gömlek";
        };

        String swatchTemplate = fabric.getType() == GarmentType.SHIRT ? SHIRT_SWATCH : BLAZER_SWATCH;

        return FabricScanResponse.builder()
            .fabricId(fabric.getFabricId())
            .name(fabric.getName())
            .typeLabel(typeLabel)
            .inStock(fabric.isInStock())
            .tag(fabric.getTag())
            .subtitle(fabric.getSubtitle())
            .swatchUrl(String.format(swatchTemplate, fabric.getFabricId()))
            .build();
    }

    // -------------------------------------------------------------------------

    private List<StyleItem> buildStyleItems(Order order) {
        List<StyleItem> items = new ArrayList<>();
        if (order.getProductType() == null) return items;

        switch (order.getProductType()) {
            case JACKET -> {
                addItem(items, "Stil", order.getJacketStyleKey());
                addItem(items, "Yaka", order.getJacketLapelStyle());
                addItem(items, "Yaka Genişliği", order.getJacketLapelWidth());
                addItem(items, "Cep", order.getJacketPocketStyle());
                addItem(items, "Kesim", order.getJacketFit());
                addItem(items, "Yırtmaç", order.getJacketVent());
                addItem(items, "Kumaş", order.getJacketFabricLabel());
            }
            case SUIT -> {
                addItem(items, "Ceket Stil", order.getJacketStyleKey());
                addItem(items, "Ceket Yaka", order.getJacketLapelStyle());
                addItem(items, "Ceket Kumaş", order.getJacketFabricLabel());
                addItem(items, "Gömlek Yaka", order.getShirtCollarStyle());
                addItem(items, "Gömlek Manşet", order.getShirtCuffStyle());
                addItem(items, "Gömlek Kumaş", order.getShirtFabricLabel());
                addItem(items, "Pantolon Bel", order.getPantFasteningStyle());
                addItem(items, "Pantolon Pile", order.getPantPleatStyle());
                addItem(items, "Pantolon Kumaş", order.getPantFabricLabel());
            }
            case SHIRT -> {
                addItem(items, "Yaka Stili", order.getShirtCollarStyle());
                addItem(items, "Yaka Düğmesi", order.getShirtCollarButtons());
                addItem(items, "Manşet", order.getShirtCuffStyle());
                addItem(items, "Kesim", order.getShirtFit());
                addItem(items, "Kumaş", order.getShirtFabricLabel());
            }
            case TROUSERS -> {
                addItem(items, "Bel İliği", order.getPantFasteningStyle());
                addItem(items, "Pile", order.getPantPleatStyle());
                addItem(items, "Kesim", order.getPantFit());
                addItem(items, "Paça Stili", order.getPantLegStyle());
                addItem(items, "Kumaş", order.getPantFabricLabel());
            }
            case VEST -> {
                addItem(items, "Yaka", order.getVestLapelStyle());
                addItem(items, "Cep", order.getVestPocketStyle());
                addItem(items, "Kumaş", order.getVestFabricLabel());
            }
            default -> {}
        }
        return items;
    }

    private List<MeasurementItem> buildMeasurements(Long customerId) {
        List<MeasurementSet> sets =
            measurementSetRepository.findByCustomerIdOrderByMeasuredAtDescCreatedAtDesc(customerId);
        if (sets.isEmpty()) return List.of();

        // values already eagerly loaded via @EntityGraph on the repository method
        return sets.get(0).getValues().stream()
            .sorted(Comparator.comparing(MeasurementValue::getDefinitionOrder))
            .map(v -> MeasurementItem.builder()
                .order(v.getDefinitionOrder())
                .label(v.getDefinitionLabel())
                .value(v.getNumericValue() != null ? v.getNumericValue().toPlainString() : "—")
                .unit(v.getUnit())
                .build())
            .toList();
    }

    private RenderHint buildRenderHint(Order order) {
        if (order.getProductType() == null) return null;
        return switch (order.getProductType()) {
            case TROUSERS -> {
                String key = order.getPantFabricKey();
                if (key == null || key.isBlank()) yield null;
                yield RenderHint.builder()
                    .garmentType("pant")
                    .fabricKey(key)
                    .styleKeys(Map.of(
                        "fasteningStyle", nvl(order.getPantFasteningStyle(), "centered"),
                        "pleatStyle",     nvl(order.getPantPleatStyle(), "none")
                    ))
                    .build();
            }
            case SHIRT -> {
                String key = order.getShirtFabricKey();
                if (key == null || key.isBlank()) yield null;
                yield RenderHint.builder()
                    .garmentType("shirt")
                    .fabricKey(key)
                    .styleKeys(Map.of(
                        "collarStyle",   nvl(order.getShirtCollarStyle(), "cutaway"),
                        "collarButtons", nvl(order.getShirtCollarButtons(), "1"),
                        "cuffStyle",     nvl(order.getShirtCuffStyle(), "single")
                    ))
                    .build();
            }
            case VEST -> {
                String key = order.getVestFabricKey();
                if (key == null || key.isBlank()) yield null;
                yield RenderHint.builder()
                    .garmentType("vest")
                    .fabricKey(key)
                    .styleKeys(Map.of(
                        "stylePrefix", nvl(order.getVestLapelStyle(), "single-4btn"),
                        "lapelStyle",  nvl(order.getVestPocketStyle(), "notch")
                    ))
                    .build();
            }
            default -> null;
        };
    }

    private static String nvl(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String resolvePrimarySwatchUrl(Order order) {
        if (order.getProductType() == null) return null;
        String fabricId = switch (order.getProductType()) {
            case JACKET, SUIT, VEST -> order.getJacketFabricKey();
            case SHIRT              -> order.getShirtFabricKey();
            case TROUSERS           -> order.getPantFabricKey();
            default                 -> null;
        };
        if (fabricId == null || fabricId.isBlank()) return null;
        String template = order.getProductType() == ProductType.SHIRT ? SHIRT_SWATCH : BLAZER_SWATCH;
        return String.format(template, fabricId);
    }

    private void addItem(List<StyleItem> items, String label, String value) {
        if (value != null && !value.isBlank()) {
            items.add(StyleItem.builder().label(label).value(value).build());
        }
    }
}
