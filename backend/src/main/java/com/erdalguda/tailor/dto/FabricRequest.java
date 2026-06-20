package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.GarmentType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FabricRequest {
    private String fabricId;
    private String key;
    private String name;
    private String label;
    private String subtitle;
    private boolean defaultFabric;
    private String createdBy;
    private GarmentType type;
    private String tag;
    private boolean inStock = true;
}
