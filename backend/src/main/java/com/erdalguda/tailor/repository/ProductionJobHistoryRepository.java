package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.ProductionJobHistory;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionJobHistoryRepository extends JpaRepository<ProductionJobHistory, Long> {

    List<ProductionJobHistory> findByProductionJobIdOrderByCreatedAtDesc(Long productionJobId);

    void deleteByProductionJobId(Long productionJobId);
}
