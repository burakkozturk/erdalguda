package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.MeasurementSet;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeasurementSetRepository extends JpaRepository<MeasurementSet, Long> {

    @EntityGraph(attributePaths = {"customer", "measuredByUser", "measuredByEmployee", "values"})
    List<MeasurementSet> findAllByOrderByMeasuredAtDescCreatedAtDesc();

    @EntityGraph(attributePaths = {"customer", "measuredByUser", "measuredByEmployee", "values"})
    List<MeasurementSet> findByCustomerIdOrderByMeasuredAtDescCreatedAtDesc(Long customerId);
}
