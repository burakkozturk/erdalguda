package com.erdalguda.tailor.dto.scan;

import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class OrderScanResponse {

    private String orderNumber;
    private String customerFullName;
    private String productTypeLabel;
    private String productionStageName;
    private String orderStatusLabel;
    private String notes;
    private String primaryFabricSwatchUrl;
    private RenderHint renderHint;
    private List<StyleItem> styleItems;
    private List<MeasurementItem> measurements;

    /**
     * Carries the raw style keys the frontend GarmentViewer needs to
     * compose the correct PNG layer stack from the Python fabric engine.
     */
    @Getter
    @Builder
    public static class RenderHint {
        /** Config/asset namespace: "pant" | "shirt" | "vest" */
        private String garmentType;
        /** Raw fabricId as stored on the order (maps to S3 key). */
        private String fabricKey;
        /** Style keys that drive layer selection, e.g. fasteningStyle, pleatStyle. */
        private Map<String, String> styleKeys;
    }

    @Getter
    @Builder
    public static class StyleItem {
        private String label;
        private String value;
    }

    @Getter
    @Builder
    public static class MeasurementItem {
        private Integer order;
        private String label;
        private String value;
        private String unit;
    }
}
