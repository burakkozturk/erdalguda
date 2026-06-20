package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.CustomerRequest;
import com.erdalguda.tailor.dto.CustomerResponse;
import com.erdalguda.tailor.dto.OrderRequest;
import com.erdalguda.tailor.dto.OrderResponse;
import com.erdalguda.tailor.dto.express.ExpressCustomerRequest;
import com.erdalguda.tailor.dto.express.ExpressMeasurementRequest;
import com.erdalguda.tailor.dto.express.ExpressOrderRequest;
import com.erdalguda.tailor.dto.express.ExpressRegistrationRequest;
import com.erdalguda.tailor.dto.express.ExpressRegistrationResponse;
import com.erdalguda.tailor.dto.measurement.MeasurementSetRequest;
import com.erdalguda.tailor.dto.measurement.MeasurementSetResponse;
import com.erdalguda.tailor.entity.CurrencyType;
import com.erdalguda.tailor.entity.OrderPaymentStatus;
import com.erdalguda.tailor.entity.User;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpressRegistrationService {

    private static final Set<String> ALLOWED_USERNAMES = Set.of("erdal.guda", "ufuk.bas");

    private final AuthService authService;
    private final CustomerService customerService;
    private final MeasurementSetService measurementSetService;
    private final OrderService orderService;

    public ExpressRegistrationService(
        AuthService authService,
        CustomerService customerService,
        MeasurementSetService measurementSetService,
        OrderService orderService
    ) {
        this.authService = authService;
        this.customerService = customerService;
        this.measurementSetService = measurementSetService;
        this.orderService = orderService;
    }

    @Transactional
    public ExpressRegistrationResponse createExpressRegistration(ExpressRegistrationRequest request) {
        ensureAllowedUser();

        CustomerResponse customer = customerService.createCustomer(toCustomerRequest(request.getCustomer()));
        MeasurementSetResponse measurementSet = measurementSetService.createMeasurementSet(toMeasurementRequest(
            customer.getId(),
            request.getMeasurement()
        ));

        List<ExpressRegistrationResponse.OrderResult> orderResults = new ArrayList<>();
        for (ExpressOrderRequest orderRequest : request.getOrders()) {
            OrderResponse order = orderService.createOrder(toOrderRequest(customer.getId(), orderRequest));
            orderResults.add(ExpressRegistrationResponse.OrderResult.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .productionJobId(order.getProductionJobId())
                .productionJobNumber(order.getProductionJobNumber())
                .productionStageName(order.getProductionStageName())
                .build());
        }

        return ExpressRegistrationResponse.builder()
            .customerId(customer.getId())
            .customerFullName(customer.getFirstName() + " " + customer.getLastName())
            .measurementSetId(measurementSet.getId())
            .orders(orderResults)
            .message("Ekspres kayıt başarıyla tamamlandı.")
            .build();
    }

    private void ensureAllowedUser() {
        User user = authService.getAuthenticatedUser();
        if (!ALLOWED_USERNAMES.contains(user.getUsername())) {
            throw new AccessDeniedException("Bu işlem için yetkiniz bulunmuyor.");
        }
    }

    private CustomerRequest toCustomerRequest(ExpressCustomerRequest request) {
        CustomerRequest customer = new CustomerRequest();
        customer.setFirstName(request.getFirstName());
        customer.setLastName(request.getLastName());
        customer.setPhone(request.getPhone());
        customer.setEmail(request.getEmail());
        customer.setHeightCm(request.getHeightCm());
        customer.setWeightKg(request.getWeightKg());
        customer.setAddress(request.getAddress());
        customer.setNotes(request.getNotes());
        return customer;
    }

    private MeasurementSetRequest toMeasurementRequest(Long customerId, ExpressMeasurementRequest request) {
        MeasurementSetRequest measurement = new MeasurementSetRequest();
        measurement.setCustomerId(customerId);
        if (request != null) {
            measurement.setMeasuredAt(request.getMeasuredAt());
            measurement.setNotes(request.getNotes());
            measurement.setValues(request.getValues());
        }
        return measurement;
    }

    private OrderRequest toOrderRequest(Long customerId, ExpressOrderRequest request) {
        OrderRequest order = new OrderRequest();
        order.setCustomerId(customerId);
        order.setProductType(request.getProductType());
        order.setOrderDate(request.getOrderDate());
        order.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        order.setTotalAmount(request.getTotalAmount());
        order.setCurrency(request.getCurrency() == null ? CurrencyType.TRY : request.getCurrency());
        order.setPaymentStatus(request.getPaymentStatus() == null ? OrderPaymentStatus.UNPAID : request.getPaymentStatus());
        order.setNotes(request.getNotes());
        order.setJacketStyleKey(request.getJacketStyleKey());
        order.setJacketLapelStyle(request.getJacketLapelStyle());
        order.setJacketLapelWidth(request.getJacketLapelWidth());
        order.setJacketPocketStyle(request.getJacketPocketStyle());
        order.setJacketFabricKey(request.getJacketFabricKey());
        order.setJacketFabricLabel(request.getJacketFabricLabel());
        order.setShirtCollarStyle(request.getShirtCollarStyle());
        order.setShirtCollarButtons(request.getShirtCollarButtons());
        order.setShirtCuffStyle(request.getShirtCuffStyle());
        order.setShirtFabricKey(request.getShirtFabricKey());
        order.setShirtFabricLabel(request.getShirtFabricLabel());
        order.setTuxedoStyle(request.getTuxedoStyle());
        order.setTuxedoLapelStyle(request.getTuxedoLapelStyle());
        order.setTuxedoLapelWidth(request.getTuxedoLapelWidth());
        order.setTuxedoPocketStyle(request.getTuxedoPocketStyle());
        order.setTuxedoFabricKey(request.getTuxedoFabricKey());
        order.setTuxedoFabricLabel(request.getTuxedoFabricLabel());
        order.setVestLapelStyle(request.getVestLapelStyle());
        order.setVestPocketStyle(request.getVestPocketStyle());
        order.setVestFabricKey(request.getVestFabricKey());
        order.setVestFabricLabel(request.getVestFabricLabel());
        order.setPantFasteningStyle(request.getPantFasteningStyle());
        order.setPantPleatStyle(request.getPantPleatStyle());
        order.setPantFabricKey(request.getPantFabricKey());
        order.setPantFabricLabel(request.getPantFabricLabel());
        order.setJacketFit(request.getJacketFit());
        order.setJacketVent(request.getJacketVent());
        order.setShirtFit(request.getShirtFit());
        order.setPantFit(request.getPantFit());
        order.setPantLegStyle(request.getPantLegStyle());
        order.setPantDrape(request.getPantDrape());
        return order;
    }
}
