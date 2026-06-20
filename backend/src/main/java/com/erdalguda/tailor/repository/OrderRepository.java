package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.Order;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    boolean existsByOrderNumber(String orderNumber);

    Optional<Order> findByOrderNumber(String orderNumber);

    Optional<Order> findTopByOrderByIdDesc();

    List<Order> findAllByOrderByCreatedAtDesc();

    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}
