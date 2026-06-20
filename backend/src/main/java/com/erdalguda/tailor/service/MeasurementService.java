package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.MeasurementRequest;
import com.erdalguda.tailor.dto.MeasurementResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.Measurement;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.MeasurementRepository;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MeasurementService {

    private final CustomerService customerService;
    private final MeasurementRepository measurementRepository;

    public MeasurementService(CustomerService customerService, MeasurementRepository measurementRepository) {
        this.customerService = customerService;
        this.measurementRepository = measurementRepository;
    }

    @Transactional(readOnly = true)
    public List<MeasurementResponse> getMeasurementsByCustomerId(Long customerId) {
        customerService.findCustomer(customerId);
        return measurementRepository.findByCustomerIdOrderByMeasuredAtDescCreatedAtDesc(customerId)
            .stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public MeasurementResponse getMeasurementById(Long id) {
        return toResponse(findMeasurement(id));
    }

    @Transactional
    public MeasurementResponse createMeasurement(Long customerId, MeasurementRequest request) {
        Customer customer = customerService.findCustomer(customerId);
        Measurement measurement = new Measurement();
        measurement.setCustomer(customer);
        applyRequest(measurement, request, true);
        return toResponse(measurementRepository.save(measurement));
    }

    @Transactional
    public MeasurementResponse updateMeasurement(Long id, MeasurementRequest request) {
        Measurement measurement = findMeasurement(id);
        applyRequest(measurement, request, false);
        return toResponse(measurementRepository.save(measurement));
    }

    @Transactional
    public void deleteMeasurement(Long id) {
        Measurement measurement = findMeasurement(id);
        measurementRepository.delete(measurement);
    }

    private Measurement findMeasurement(Long id) {
        return measurementRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Measurement not found with id: " + id));
    }

    private void applyRequest(Measurement measurement, MeasurementRequest request, boolean defaultMeasuredAt) {
        if (request.getMeasuredAt() != null) {
            measurement.setMeasuredAt(request.getMeasuredAt());
        } else if (defaultMeasuredAt) {
            measurement.setMeasuredAt(LocalDate.now());
        }
        measurement.setHeightCm(request.getHeightCm());
        measurement.setWeightKg(request.getWeightKg());
        measurement.setNeck(request.getNeck());
        measurement.setChest(request.getChest());
        measurement.setWaist(request.getWaist());
        measurement.setHip(request.getHip());
        measurement.setShoulderWidth(request.getShoulderWidth());
        measurement.setBackWidth(request.getBackWidth());
        measurement.setSleeveLength(request.getSleeveLength());
        measurement.setBiceps(request.getBiceps());
        measurement.setWrist(request.getWrist());
        measurement.setJacketLength(request.getJacketLength());
        measurement.setBackLength(request.getBackLength());
        measurement.setTrouserWaist(request.getTrouserWaist());
        measurement.setTrouserHip(request.getTrouserHip());
        measurement.setTrouserOutseam(request.getTrouserOutseam());
        measurement.setTrouserInseam(request.getTrouserInseam());
        measurement.setThigh(request.getThigh());
        measurement.setKnee(request.getKnee());
        measurement.setAnkle(request.getAnkle());
        measurement.setPostureNotes(request.getPostureNotes());
        measurement.setGeneralNotes(request.getGeneralNotes());
    }

    private MeasurementResponse toResponse(Measurement measurement) {
        return MeasurementResponse.builder()
            .id(measurement.getId())
            .customerId(measurement.getCustomer().getId())
            .measuredAt(measurement.getMeasuredAt())
            .heightCm(measurement.getHeightCm())
            .weightKg(measurement.getWeightKg())
            .neck(measurement.getNeck())
            .chest(measurement.getChest())
            .waist(measurement.getWaist())
            .hip(measurement.getHip())
            .shoulderWidth(measurement.getShoulderWidth())
            .backWidth(measurement.getBackWidth())
            .sleeveLength(measurement.getSleeveLength())
            .biceps(measurement.getBiceps())
            .wrist(measurement.getWrist())
            .jacketLength(measurement.getJacketLength())
            .backLength(measurement.getBackLength())
            .trouserWaist(measurement.getTrouserWaist())
            .trouserHip(measurement.getTrouserHip())
            .trouserOutseam(measurement.getTrouserOutseam())
            .trouserInseam(measurement.getTrouserInseam())
            .thigh(measurement.getThigh())
            .knee(measurement.getKnee())
            .ankle(measurement.getAnkle())
            .postureNotes(measurement.getPostureNotes())
            .generalNotes(measurement.getGeneralNotes())
            .createdAt(measurement.getCreatedAt())
            .updatedAt(measurement.getUpdatedAt())
            .build();
    }
}
