package com.erdalguda.tailor.dto.scan;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FabricScanResponse {

    private String fabricId;
    private String name;
    private String typeLabel;
    private boolean inStock;
    private String tag;
    private String subtitle;
    private String swatchUrl;
}
