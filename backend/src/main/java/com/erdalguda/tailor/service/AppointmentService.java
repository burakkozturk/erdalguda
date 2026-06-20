package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.AppointmentRequest;
import com.erdalguda.tailor.dto.AppointmentResponse;
import com.erdalguda.tailor.dto.AppointmentStatusUpdateRequest;
import com.erdalguda.tailor.entity.Appointment;
import com.erdalguda.tailor.entity.AppointmentStatus;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.AppointmentRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;

    public AppointmentService(AppointmentRepository appointmentRepository) {
        this.appointmentRepository = appointmentRepository;
    }

    @Transactional
    public AppointmentResponse createAppointment(AppointmentRequest request) {
        Appointment appointment = new Appointment();
        appointment.setFullName(request.getFullName().trim());
        appointment.setPhone(request.getPhone().trim());
        appointment.setEmail(blankToNull(request.getEmail()));
        appointment.setRequestedService(blankToNull(request.getRequestedService()));
        appointment.setPreferredDate(request.getPreferredDate());
        appointment.setNotes(blankToNull(request.getNotes()));
        appointment.setStatus(AppointmentStatus.PENDING);
        return toResponse(appointmentRepository.save(appointment));
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getAllAppointments() {
        return appointmentRepository.findAll().stream()
            .sorted(Comparator.comparing(Appointment::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .map(this::toResponse)
            .toList();
    }

    @Transactional
    public AppointmentResponse updateStatus(Long id, AppointmentStatusUpdateRequest request) {
        Appointment appointment = appointmentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Randevu bulunamadı: " + id));
        appointment.setStatus(request.getStatus());
        return toResponse(appointmentRepository.save(appointment));
    }

    @Transactional
    public void deleteAppointment(Long id) {
        Appointment appointment = appointmentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Randevu bulunamadı: " + id));
        appointmentRepository.delete(appointment);
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private AppointmentResponse toResponse(Appointment appointment) {
        return AppointmentResponse.builder()
            .id(appointment.getId())
            .fullName(appointment.getFullName())
            .phone(appointment.getPhone())
            .email(appointment.getEmail())
            .requestedService(appointment.getRequestedService())
            .preferredDate(appointment.getPreferredDate())
            .notes(appointment.getNotes())
            .status(appointment.getStatus())
            .createdAt(appointment.getCreatedAt())
            .updatedAt(appointment.getUpdatedAt())
            .build();
    }
}
