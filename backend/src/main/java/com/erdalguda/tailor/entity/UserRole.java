package com.erdalguda.tailor.entity;

public enum UserRole {
    ADMIN("Yönetici"),
    VIP_CUSTOMER("VIP Müşteri"),
    SALES("Satış / Ölçü"),
    CUTTING("Kesimhane"),
    PACKAGING("Kargo Hazırlık"),
    CARGO("Kargo"),
    IRONING("Ütü"),
    MACHINIST("Makinacı"),
    QUALITY_CONTROL("Kontrol / Revize"),
    DELIVERY("Teslim");

    private final String label;

    UserRole(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
