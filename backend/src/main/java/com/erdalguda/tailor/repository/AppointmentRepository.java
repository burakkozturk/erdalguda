package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.Appointment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
}
