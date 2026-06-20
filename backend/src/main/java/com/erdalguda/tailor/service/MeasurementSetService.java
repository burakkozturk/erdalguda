package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.measurement.MeasurementDefinitionResponse;
import com.erdalguda.tailor.dto.measurement.MeasurementSetRequest;
import com.erdalguda.tailor.dto.measurement.MeasurementSetResponse;
import com.erdalguda.tailor.dto.measurement.MeasurementValueRequest;
import com.erdalguda.tailor.dto.measurement.MeasurementValueResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.MeasurementSet;
import com.erdalguda.tailor.entity.MeasurementValue;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.MeasurementSetRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeasurementSetService {

    private static final String DEFAULT_UNIT = "cm";
    private static final List<MeasurementDefinitionResponse> DEFINITIONS = List.of(
        definition(1, "boyun_capi", "Boyun Çapı"),
        definition(2, "boyun_koku_sol_omuz_ucu_mesafe", "Boyun Kökü ile Sol Omuz Ucu Arası Mesafe"),
        definition(3, "boyun_koku_sag_omuz_ucu_mesafe", "Boyun Kökü ile Sağ Omuz Ucu Arası Mesafe"),
        definition(4, "omuz_genisligi", "Omuz Genişliği"),
        definition(5, "sirt_genisligi", "Sırt Genişliği"),
        definition(6, "gogus_capi", "Göğüs Çapı"),
        definition(7, "gobek_capi", "Göbek Çapı"),
        definition(8, "bel_kemer_capi", "Bel Kemer Çapı"),
        definition(9, "basen_kalca_capi", "Basen Kalça Çapı"),
        definition(10, "etek_boyu", "Etek Boyu"),
        definition(11, "sol_boyun_gogus_yukseklik", "Sol Boyun Göğüs Yüksekliği"),
        definition(12, "sol_omuz_gogus_yukseklik", "Sol Omuz Göğüs Yüksekliği"),
        definition(13, "sol_kol_omuz_kesisim_capi", "Sol Kol Omuz Kesişim Çapı"),
        definition(14, "sol_kol_boyu", "Sol Kol Boyu"),
        definition(15, "sol_pazu_capi", "Sol Pazu Çapı"),
        definition(16, "sol_dirsek", "Sol Dirsek"),
        definition(17, "sol_bilek_capi", "Sol Bilek Çapı"),
        definition(18, "sag_boyun_gogus_yukseklik", "Sağ Boyun Göğüs Yüksekliği"),
        definition(19, "sag_omuz_gogus_yukseklik", "Sağ Omuz Göğüs Yüksekliği"),
        definition(20, "sag_kol_omuz_kesisim_capi", "Sağ Kol Omuz Kesişim Çapı"),
        definition(21, "sag_kol_boyu", "Sağ Kol Boyu"),
        definition(22, "sag_pazu_capi", "Sağ Pazu Çapı"),
        definition(23, "sag_dirsek", "Sağ Dirsek"),
        definition(24, "sag_bilek_capi", "Sağ Bilek Çapı"),
        definition(25, "ceket_etek_boyu_sirttan", "Ceket Etek Boyu Sırttan"),
        definition(26, "gogus_genisligi", "Göğüs Genişliği"),
        definition(27, "gobek_genisligi", "Göbek Genişliği"),
        definition(28, "sol_ust_bacak_baldir_adele_capi", "Sol Üst Bacak Baldır Adele Çapı"),
        definition(29, "sol_diz", "Sol Diz"),
        definition(30, "sol_alt_bacak_adele_capi", "Sol Alt Bacak Adele Çapı"),
        definition(31, "sol_ayak_bilegi_capi", "Sol Ayak Bileği Çapı"),
        definition(32, "sol_bacak_bel_bilek_boyu", "Sol Bacak Bel Bilek Boyu"),
        definition(33, "sol_bacak_bilek_boyu", "Sol Bacak Bilek Boyu"),
        definition(34, "sag_ust_bacak_baldir_capi", "Sağ Üst Bacak Baldır Çapı"),
        definition(35, "sag_diz", "Sağ Diz"),
        definition(36, "sag_alt_bacak_adele_capi", "Sağ Alt Bacak Adele Çapı"),
        definition(37, "sag_ayak_bilegi_capi", "Sağ Ayak Bileği Çapı"),
        definition(38, "sag_bacak_bel_bilek_boyu", "Sağ Bacak Bel Bilek Boyu"),
        definition(39, "sag_bacak_bilek_boyu", "Sağ Bacak Bilek Boyu")
    );

    private final MeasurementSetRepository measurementSetRepository;
    private final CustomerService customerService;
    private final AuthService authService;

    public MeasurementSetService(
        MeasurementSetRepository measurementSetRepository,
        CustomerService customerService,
        AuthService authService
    ) {
        this.measurementSetRepository = measurementSetRepository;
        this.customerService = customerService;
        this.authService = authService;
    }

    public List<MeasurementDefinitionResponse> listMeasurementDefinitions() {
        return DEFINITIONS;
    }

    @Transactional(readOnly = true)
    public List<MeasurementSetResponse> listMeasurementSets() {
        return measurementSetRepository.findAllByOrderByMeasuredAtDescCreatedAtDesc().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public MeasurementSetResponse getMeasurementSetById(Long id) {
        return toResponse(findMeasurementSet(id));
    }

    @Transactional(readOnly = true)
    public List<MeasurementSetResponse> listMeasurementSetsByCustomer(Long customerId) {
        customerService.findCustomer(customerId);
        return measurementSetRepository.findByCustomerIdOrderByMeasuredAtDescCreatedAtDesc(customerId).stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public MeasurementSetResponse createMeasurementSet(MeasurementSetRequest request) {
        MeasurementSet measurementSet = new MeasurementSet();
        applyRequest(measurementSet, request, true);
        try {
            User user = authService.getAuthenticatedUser();
            measurementSet.setMeasuredByUser(user);
            measurementSet.setMeasuredByEmployee(user.getEmployee());
        } catch (RuntimeException ignored) {
            measurementSet.setMeasuredByUser(null);
            measurementSet.setMeasuredByEmployee(null);
        }
        return toResponse(measurementSetRepository.save(measurementSet));
    }

    @Transactional
    public MeasurementSetResponse updateMeasurementSet(Long id, MeasurementSetRequest request) {
        MeasurementSet measurementSet = findMeasurementSet(id);
        applyRequest(measurementSet, request, false);
        return toResponse(measurementSetRepository.save(measurementSet));
    }

    @Transactional
    public void deleteMeasurementSet(Long id) {
        measurementSetRepository.delete(findMeasurementSet(id));
    }

    private MeasurementSet findMeasurementSet(Long id) {
        return measurementSetRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Ölçü seti bulunamadı."));
    }

    private void applyRequest(MeasurementSet measurementSet, MeasurementSetRequest request, boolean defaultMeasuredAt) {
        Customer customer = customerService.findCustomer(request.getCustomerId());
        measurementSet.setCustomer(customer);
        if (request.getMeasuredAt() != null) {
            measurementSet.setMeasuredAt(request.getMeasuredAt());
        } else if (defaultMeasuredAt) {
            measurementSet.setMeasuredAt(LocalDate.now());
        }
        measurementSet.setNotes(request.getNotes());
        measurementSet.getValues().clear();
        if (request.getValues() != null) {
            request.getValues().stream()
                .filter(value -> value.getNumericValue() != null)
                .map(value -> toEntity(measurementSet, value))
                .forEach(measurementSet.getValues()::add);
        }
    }

    private MeasurementValue toEntity(MeasurementSet measurementSet, MeasurementValueRequest request) {
        MeasurementDefinitionResponse definition = findDefinition(request.getDefinitionKey(), request.getDefinitionOrder());
        MeasurementValue value = new MeasurementValue();
        value.setMeasurementSet(measurementSet);
        value.setDefinitionKey(definition.key());
        value.setDefinitionOrder(definition.order());
        value.setDefinitionLabel(definition.label());
        value.setNumericValue(request.getNumericValue());
        value.setUnit(request.getUnit() == null || request.getUnit().isBlank() ? DEFAULT_UNIT : request.getUnit());
        value.setNotes(request.getNotes());
        return value;
    }

    private MeasurementDefinitionResponse findDefinition(String key, Integer order) {
        return DEFINITIONS.stream()
            .filter(definition -> definition.key().equals(key) || definition.order().equals(order))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Geçersiz ölçü tanımı."));
    }

    private MeasurementSetResponse toResponse(MeasurementSet measurementSet) {
        return MeasurementSetResponse.builder()
            .id(measurementSet.getId())
            .customerId(measurementSet.getCustomer().getId())
            .customerFullName(measurementSet.getCustomer().getFirstName() + " " + measurementSet.getCustomer().getLastName())
            .measuredAt(measurementSet.getMeasuredAt())
            .measuredByUserFullName(measurementSet.getMeasuredByUser() == null ? null : measurementSet.getMeasuredByUser().getFullName())
            .notes(measurementSet.getNotes())
            .values(measurementSet.getValues().stream()
                .sorted(Comparator.comparing(MeasurementValue::getDefinitionOrder))
                .map(this::toValueResponse)
                .toList())
            .createdAt(measurementSet.getCreatedAt())
            .updatedAt(measurementSet.getUpdatedAt())
            .build();
    }

    private MeasurementValueResponse toValueResponse(MeasurementValue value) {
        return MeasurementValueResponse.builder()
            .id(value.getId())
            .definitionKey(value.getDefinitionKey())
            .definitionOrder(value.getDefinitionOrder())
            .definitionLabel(value.getDefinitionLabel())
            .numericValue(value.getNumericValue())
            .unit(value.getUnit())
            .notes(value.getNotes())
            .createdAt(value.getCreatedAt())
            .updatedAt(value.getUpdatedAt())
            .build();
    }

    private static MeasurementDefinitionResponse definition(Integer order, String key, String label) {
        return new MeasurementDefinitionResponse(key, order, label, DEFAULT_UNIT);
    }
}
