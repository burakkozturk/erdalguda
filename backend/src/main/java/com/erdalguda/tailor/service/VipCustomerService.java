package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.CustomerRequest;
import com.erdalguda.tailor.dto.CustomerResponse;
import com.erdalguda.tailor.dto.vip.VipCustomerRequest;
import com.erdalguda.tailor.dto.vip.VipCustomerResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.entity.UserRole;
import com.erdalguda.tailor.repository.CustomerRepository;
import com.erdalguda.tailor.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VipCustomerService {

    private final UserRepository userRepository;
    private final CustomerRepository customerRepository;
    private final CustomerService customerService;
    private final PasswordEncoder passwordEncoder;

    public VipCustomerService(
        UserRepository userRepository,
        CustomerRepository customerRepository,
        CustomerService customerService,
        PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.customerRepository = customerRepository;
        this.customerService = customerService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public VipCustomerResponse createVipCustomer(VipCustomerRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            throw new IllegalArgumentException("Bu kullanıcı adı zaten kullanımda: " + request.getUsername());
        }

        CustomerRequest customerReq = new CustomerRequest();
        customerReq.setFirstName(request.getFirstName());
        customerReq.setLastName(request.getLastName());
        customerReq.setPhone(request.getPhone());
        customerReq.setEmail(request.getEmail());

        CustomerResponse customerResponse = customerService.createCustomer(customerReq);
        Customer customer = customerRepository.findById(customerResponse.getId())
            .orElseThrow(() -> new IllegalStateException("Customer not found after creation."));

        User user = new User();
        user.setUsername(request.getUsername());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFirstName() + " " + request.getLastName());
        user.setEmail(request.getEmail());
        user.setRole(UserRole.VIP_CUSTOMER);
        user.setCustomer(customer);
        user.setActive(true);
        userRepository.save(user);

        return VipCustomerResponse.builder()
            .userId(user.getId())
            .customerId(customer.getId())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .email(user.getEmail())
            .build();
    }
}
