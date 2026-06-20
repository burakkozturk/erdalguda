package com.erdalguda.tailor.entity;

public enum OrderPaymentStatus {
    UNPAID("Ödenmedi"),
    PAID("Ödendi");

    private final String label;

    OrderPaymentStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
