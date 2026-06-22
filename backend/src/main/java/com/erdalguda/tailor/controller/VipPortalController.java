package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.CustomerResponse;
import com.erdalguda.tailor.dto.OrderRequest;
import com.erdalguda.tailor.dto.OrderResponse;
import com.erdalguda.tailor.dto.measurement.MeasurementSetResponse;
import com.erdalguda.tailor.dto.vip.VipOrderRequest;
import com.erdalguda.tailor.entity.User;
import com.erdalguda.tailor.service.AuthService;
import com.erdalguda.tailor.service.CustomerService;
import com.erdalguda.tailor.service.MeasurementSetService;
import com.erdalguda.tailor.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/vip")
@PreAuthorize("hasRole('VIP_CUSTOMER')")
public class VipPortalController {

    private final AuthService authService;
    private final OrderService orderService;
    private final CustomerService customerService;
    private final MeasurementSetService measurementSetService;

    public VipPortalController(
        AuthService authService,
        OrderService orderService,
        CustomerService customerService,
        MeasurementSetService measurementSetService
    ) {
        this.authService = authService;
        this.orderService = orderService;
        this.customerService = customerService;
        this.measurementSetService = measurementSetService;
    }

    private Long resolveCustomerId() {
        User user = authService.getAuthenticatedUser();
        if (user.getCustomer() == null) {
            throw new IllegalStateException("VIP hesabınıza bağlı müşteri kaydı bulunamadı.");
        }
        return user.getCustomer().getId();
    }

    @GetMapping("/me")
    public CustomerResponse getMyProfile() {
        Long customerId = resolveCustomerId();
        return customerService.getCustomerById(customerId);
    }

    @GetMapping("/orders")
    public List<OrderResponse> getMyOrders() {
        Long customerId = resolveCustomerId();
        return orderService.listOrdersByCustomer(customerId);
    }

    @GetMapping("/measurements")
    public List<MeasurementSetResponse> getMyMeasurements() {
        Long customerId = resolveCustomerId();
        return measurementSetService.listMeasurementSetsByCustomer(customerId);
    }

    @PostMapping("/orders")
    public ResponseEntity<OrderResponse> createMyOrder(@Valid @RequestBody VipOrderRequest request) {
        Long customerId = resolveCustomerId();

        OrderRequest orderRequest = new OrderRequest();
        orderRequest.setCustomerId(customerId);
        orderRequest.setProductType(request.getProductType());
        orderRequest.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        orderRequest.setTotalAmount(request.getTotalAmount());
        orderRequest.setNotes(request.getNotes());
        orderRequest.setJacketStyleKey(request.getJacketStyleKey());
        orderRequest.setJacketLapelStyle(request.getJacketLapelStyle());
        orderRequest.setJacketLapelWidth(request.getJacketLapelWidth());
        orderRequest.setJacketPocketStyle(request.getJacketPocketStyle());
        orderRequest.setJacketFabricKey(request.getJacketFabricKey());
        orderRequest.setJacketFabricLabel(request.getJacketFabricLabel());
        orderRequest.setShirtCollarStyle(request.getShirtCollarStyle());
        orderRequest.setShirtCollarButtons(request.getShirtCollarButtons());
        orderRequest.setShirtCuffStyle(request.getShirtCuffStyle());
        orderRequest.setShirtFabricKey(request.getShirtFabricKey());
        orderRequest.setShirtFabricLabel(request.getShirtFabricLabel());
        orderRequest.setTuxedoStyle(request.getTuxedoStyle());
        orderRequest.setTuxedoLapelStyle(request.getTuxedoLapelStyle());
        orderRequest.setTuxedoLapelWidth(request.getTuxedoLapelWidth());
        orderRequest.setTuxedoPocketStyle(request.getTuxedoPocketStyle());
        orderRequest.setTuxedoFabricKey(request.getTuxedoFabricKey());
        orderRequest.setTuxedoFabricLabel(request.getTuxedoFabricLabel());
        orderRequest.setVestLapelStyle(request.getVestLapelStyle());
        orderRequest.setVestPocketStyle(request.getVestPocketStyle());
        orderRequest.setVestFabricKey(request.getVestFabricKey());
        orderRequest.setVestFabricLabel(request.getVestFabricLabel());
        orderRequest.setPantFasteningStyle(request.getPantFasteningStyle());
        orderRequest.setPantPleatStyle(request.getPantPleatStyle());
        orderRequest.setPantFabricKey(request.getPantFabricKey());
        orderRequest.setPantFabricLabel(request.getPantFabricLabel());
        orderRequest.setJacketFit(request.getJacketFit());
        orderRequest.setJacketVent(request.getJacketVent());
        orderRequest.setShirtFit(request.getShirtFit());
        orderRequest.setPantFit(request.getPantFit());
        orderRequest.setPantLegStyle(request.getPantLegStyle());
        orderRequest.setPantDrape(request.getPantDrape());
        orderRequest.setCoatStyle(request.getCoatStyle());
        orderRequest.setCoatCollarStyle(request.getCoatCollarStyle());
        orderRequest.setCoatLapelStyle(request.getCoatLapelStyle());
        orderRequest.setCoatLapelLength(request.getCoatLapelLength());
        orderRequest.setCoatLapelWidth(request.getCoatLapelWidth());
        orderRequest.setCoatFastening(request.getCoatFastening());
        orderRequest.setCoatPocketStyle(request.getCoatPocketStyle());
        orderRequest.setCoatFabricKey(request.getCoatFabricKey());
        orderRequest.setCoatFabricLabel(request.getCoatFabricLabel());

        OrderResponse response = orderService.createOrder(orderRequest);
        return ResponseEntity.created(URI.create("/api/vip/orders/" + response.getId())).body(response);
    }
}
