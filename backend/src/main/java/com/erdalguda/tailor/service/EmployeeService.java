package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.EmployeeResponse;
import com.erdalguda.tailor.entity.Employee;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.EmployeeRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> getAllActiveEmployees() {
        return employeeRepository.findByActiveTrue()
            .stream()
            .map(this::toResponse)
            .toList();
    }

    Employee findEmployee(Long id) {
        return employeeRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Employee not found with id: " + id));
    }

    EmployeeResponse toResponse(Employee employee) {
        if (employee == null) {
            return null;
        }
        return EmployeeResponse.builder()
            .id(employee.getId())
            .fullName(employee.getFullName())
            .roleTitle(employee.getRoleTitle())
            .active(employee.isActive())
            .createdAt(employee.getCreatedAt())
            .updatedAt(employee.getUpdatedAt())
            .build();
    }
}
