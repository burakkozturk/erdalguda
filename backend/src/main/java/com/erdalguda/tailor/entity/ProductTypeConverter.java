package com.erdalguda.tailor.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Maps the {@link ProductType} enum to its DB string and back, with a
 * defensive fallback: any DB value that does not correspond to a current
 * enum constant (e.g. legacy 'COAT' rows from a removed garment type)
 * is mapped to {@code null} instead of raising an {@code IllegalArgumentException}.
 *
 * Service-layer read paths must filter out orders / production jobs with a
 * null productType so the row is silently skipped instead of crashing the
 * API.
 *
 * autoApply=true installs the converter for every {@code ProductType}-typed
 * JPA field across the codebase — the {@code @Enumerated} annotation must
 * be removed from those fields for this to take effect.
 */
@Converter(autoApply = true)
public class ProductTypeConverter implements AttributeConverter<ProductType, String> {

    @Override
    public String convertToDatabaseColumn(ProductType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public ProductType convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return null;
        }
        try {
            return ProductType.valueOf(dbData);
        } catch (IllegalArgumentException ex) {
            // Legacy / unknown value — return null so the read path can
            // skip the row without the whole query failing.
            return null;
        }
    }
}
