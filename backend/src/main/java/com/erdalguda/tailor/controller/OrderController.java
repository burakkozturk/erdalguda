package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.OrderRequest;
import com.erdalguda.tailor.dto.OrderResponse;
import com.erdalguda.tailor.service.FabricService;
import com.erdalguda.tailor.service.OrderService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@PreAuthorize("hasAnyRole('ADMIN','SALES')")
public class OrderController {

    private final OrderService orderService;
    private final FabricService fabricService;

    public OrderController(OrderService orderService, FabricService fabricService) {
        this.orderService = orderService;
        this.fabricService = fabricService;
    }

    @GetMapping
    public List<OrderResponse> listOrders() {
        return orderService.listAllOrders();
    }

    @GetMapping("/{id}")
    public OrderResponse getOrder(@PathVariable Long id) {
        return orderService.getOrderById(id);
    }

    @PostMapping
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody OrderRequest request) {
        OrderResponse response = orderService.createOrder(request);
        return ResponseEntity.created(URI.create("/api/orders/" + response.getId())).body(response);
    }

    @PutMapping("/{id}")
    public OrderResponse updateOrder(@PathVariable Long id, @Valid @RequestBody OrderRequest request) {
        return orderService.updateOrder(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOrder(@PathVariable Long id) {
        orderService.deleteOrder(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/trigger-render")
    public ResponseEntity<Void> triggerRender(@PathVariable Long id) {
        orderService.getOrderById(id);
        fabricService.warmUpPython();
        return ResponseEntity.noContent().build();
    }
}
