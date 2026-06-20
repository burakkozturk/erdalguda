package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.GarmentType;
import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class FabricResponse {
    private Long id;
    private String fabricId;
    private String key;
    private String name;
    private String label;
    private String subtitle;
    private boolean defaultFabric;
    private GarmentType type;
    private String tag;
    private boolean inStock;
    private LocalDateTime createdAt;
    private String createdBy;
    private String swatchUrl;
}
