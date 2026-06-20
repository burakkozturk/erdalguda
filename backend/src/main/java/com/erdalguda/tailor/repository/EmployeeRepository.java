package com.erdalguda.tailor.repository;

import com.erdalguda.tailor.entity.Employee;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    List<Employee> findByActiveTrue();

    Optional<Employee> findByFullName(String fullName);
}
