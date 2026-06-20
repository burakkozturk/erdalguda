package com.erdalguda.tailor.controller;

import com.erdalguda.tailor.dto.scan.FabricScanResponse;
import com.erdalguda.tailor.dto.scan.OrderScanResponse;
import com.erdalguda.tailor.service.ScanService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/scan")
public class ScanController {

    private final ScanService scanService;

    public ScanController(ScanService scanService) {
        this.scanService = scanService;
    }

    @GetMapping("/order/{orderNumber}")
    public OrderScanResponse scanOrder(@PathVariable String orderNumber) {
        return scanService.getOrderScan(orderNumber);
    }

    @GetMapping("/fabric/{fabricId}")
    public FabricScanResponse scanFabric(@PathVariable String fabricId) {
        return scanService.getFabricScan(fabricId);
    }
}
