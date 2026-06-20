package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.Measurement;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeasurementRepository extends JpaRepository<Measurement, Long> {

    List<Measurement> findByCustomerIdOrderByMeasuredAtDescCreatedAtDesc(Long customerId);
}
