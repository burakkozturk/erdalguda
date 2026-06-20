package com.erdalguda.tailor.entity;

public enum ProductType {
    SHIRT("Gömlek"),
    JACKET("Ceket"),
    TROUSERS("Pantolon"),
    VEST("Yelek"),
    SUIT("Takım Elbise"),
    SMOKIN("Smokin");

    private final String displayName;

    ProductType(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
