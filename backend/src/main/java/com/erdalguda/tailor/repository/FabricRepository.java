package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.Fabric;
import com.erdalguda.tailor.entity.GarmentType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FabricRepository extends JpaRepository<Fabric, Long> {
    Optional<Fabric> findByFabricId(String fabricId);
    boolean existsByFabricId(String fabricId);
    List<Fabric> findAllByOrderByCreatedAtDesc();
    List<Fabric> findAllByTypeOrderByCreatedAtDesc(GarmentType type);
}
