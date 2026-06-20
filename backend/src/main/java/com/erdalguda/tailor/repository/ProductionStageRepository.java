package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.ProductionStage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductionStageRepository extends JpaRepository<ProductionStage, Long> {

    List<ProductionStage> findByActiveTrueOrderByStageOrderAsc();

    Optional<ProductionStage> findByStageOrder(Integer stageOrder);
}
