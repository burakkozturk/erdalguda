package com.erdalguda.tailor.entity;

public enum CurrencyType {
    TRY("TL"),
    USD("USD"),
    EUR("EUR");

    private final String label;

    CurrencyType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
