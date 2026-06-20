package com.erdalguda.tailor.entity;

public enum OrderStatus {
    DRAFT("Taslak"),
    ACTIVE("Aktif"),
    READY("Hazır"),
    DELIVERED("Teslim Edildi"),
    CANCELLED("İptal");

    private final String label;

    OrderStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
