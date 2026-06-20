package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.ProductionJob;
import com.erdalguda.tailor.entity.ProductionJobStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionJobRepository extends JpaRepository<ProductionJob, Long> {

    List<ProductionJob> findByCurrentStageId(Long stageId);

    List<ProductionJob> findByStatus(ProductionJobStatus status);

    List<ProductionJob> findByCustomerId(Long customerId);

    Optional<ProductionJob> findByRelatedOrderId(Long relatedOrderId);

    List<ProductionJob> findAllByRelatedOrderId(Long relatedOrderId);

    Optional<ProductionJob> findTopByOrderByIdDesc();

    boolean existsByJobNumber(String jobNumber);

    boolean existsByRelatedOrderId(Long relatedOrderId);
}
