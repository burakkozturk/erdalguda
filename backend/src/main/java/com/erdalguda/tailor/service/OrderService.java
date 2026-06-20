package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.OrderRequest;
import com.erdalguda.tailor.dto.OrderResponse;
import com.erdalguda.tailor.entity.Customer;
import com.erdalguda.tailor.entity.CurrencyType;
import com.erdalguda.tailor.entity.Employee;
import com.erdalguda.tailor.entity.Order;
import com.erdalguda.tailor.entity.OrderPaymentStatus;
import com.erdalguda.tailor.entity.OrderStatus;
import com.erdalguda.tailor.entity.ProductionActionType;
import com.erdalguda.tailor.entity.ProductionJob;
import com.erdalguda.tailor.entity.ProductionJobHistory;
import com.erdalguda.tailor.entity.ProductionJobStatus;
import com.erdalguda.tailor.entity.ProductionPriority;
import com.erdalguda.tailor.entity.ProductionStage;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.OrderRepository;
import com.erdalguda.tailor.repository.ProductionJobHistoryRepository;
import com.erdalguda.tailor.repository.ProductionJobRepository;
import com.erdalguda.tailor.repository.ProductionStageRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderService {

    private static final int FIRST_STAGE_ORDER = 1;

    private final OrderRepository orderRepository;
    private final CustomerService customerService;
    private final ProductionStageRepository productionStageRepository;
    private final ProductionJobRepository productionJobRepository;
    private final ProductionJobHistoryRepository historyRepository;

    public OrderService(
        OrderRepository orderRepository,
        CustomerService customerService,
        ProductionStageRepository productionStageRepository,
        ProductionJobRepository productionJobRepository,
        ProductionJobHistoryRepository historyRepository
    ) {
        this.orderRepository = orderRepository;
        this.customerService = customerService;
        this.productionStageRepository = productionStageRepository;
        this.productionJobRepository = productionJobRepository;
        this.historyRepository = historyRepository;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listAllOrders() {
        // Skip orders whose productType failed to deserialise — see
        // ProductTypeConverter for the legacy-value fallback that produces
        // null here. Without this filter, a single stale 'COAT' row would
        // surface to the UI as a row with productType=null/"-".
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
            .filter(order -> order.getProductType() != null)
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long id) {
        return toResponse(findOrder(id));
    }

    @Transactional
    public OrderResponse createOrder(OrderRequest request) {
        Order order = new Order();
        order.setOrderNumber(nextOrderNumber());
        order.setStatus(OrderStatus.ACTIVE);
        applyRequest(order, request);
        Order savedOrder = orderRepository.save(order);
        createProductionJobIfMissing(savedOrder);
        return toResponse(savedOrder);
    }

    @Transactional
    public OrderResponse updateOrder(Long id, OrderRequest request) {
        Order order = findOrder(id);
        applyRequest(order, request);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public void deleteOrder(Long id) {
        Order order = findOrder(id);
        List<ProductionJob> linkedJobs = productionJobRepository.findAllByRelatedOrderId(id);

        for (ProductionJob job : linkedJobs) {
            historyRepository.deleteByProductionJobId(job.getId());
        }
        if (!linkedJobs.isEmpty()) {
            productionJobRepository.deleteAll(linkedJobs);
            productionJobRepository.flush();
        }

        orderRepository.delete(order);
    }

    private Order findOrder(Long id) {
        return orderRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Sipariş bulunamadı."));
    }

    private void applyRequest(Order order, OrderRequest request) {
        Customer customer = customerService.findCustomer(request.getCustomerId());
        order.setCustomer(customer);
        order.setProductType(request.getProductType());
        order.setOrderDate(request.getOrderDate() == null ? LocalDate.now() : request.getOrderDate());
        order.setExpectedDeliveryDate(request.getExpectedDeliveryDate());
        order.setTotalAmount(request.getTotalAmount() == null ? BigDecimal.ZERO : request.getTotalAmount());
        order.setCurrency(request.getCurrency() == null ? CurrencyType.TRY : request.getCurrency());
        order.setPaymentStatus(request.getPaymentStatus() == null ? OrderPaymentStatus.UNPAID : request.getPaymentStatus());
        if (request.getDepositAmount() != null) {
            order.setDepositAmount(request.getDepositAmount());
        }
        order.setStatus(order.getStatus() == null ? OrderStatus.ACTIVE : order.getStatus());
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
        if (request.getVestLapelStyle()     != null) order.setVestLapelStyle(request.getVestLapelStyle());
        if (request.getVestPocketStyle()    != null) order.setVestPocketStyle(request.getVestPocketStyle());
        if (request.getVestFabricKey()      != null) order.setVestFabricKey(request.getVestFabricKey());
        if (request.getVestFabricLabel()    != null) order.setVestFabricLabel(request.getVestFabricLabel());
        if (request.getPantFasteningStyle() != null) order.setPantFasteningStyle(request.getPantFasteningStyle());
        if (request.getPantPleatStyle()     != null) order.setPantPleatStyle(request.getPantPleatStyle());
        if (request.getPantFabricKey()      != null) order.setPantFabricKey(request.getPantFabricKey());
        if (request.getPantFabricLabel()    != null) order.setPantFabricLabel(request.getPantFabricLabel());

        // Data-only configurator fields — null-tolerant so older orders that
        // don't supply them keep their current value on update.
        if (request.getJacketFit()    != null) order.setJacketFit(request.getJacketFit());
        if (request.getJacketVent()   != null) order.setJacketVent(request.getJacketVent());
        if (request.getShirtFit()     != null) order.setShirtFit(request.getShirtFit());
        if (request.getPantFit()      != null) order.setPantFit(request.getPantFit());
        if (request.getPantLegStyle() != null) order.setPantLegStyle(request.getPantLegStyle());
        if (request.getPantDrape()    != null) order.setPantDrape(request.getPantDrape());

        order.recalculateRemainingAmount();
    }

    private ProductionJob createProductionJobIfMissing(Order order) {
        if (order.getId() != null && productionJobRepository.existsByRelatedOrderId(order.getId())) {
            return productionJobRepository.findByRelatedOrderId(order.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Üretim işi bulunamadı."));
        }

        ProductionStage firstStage = productionStageRepository.findByStageOrder(FIRST_STAGE_ORDER)
            .orElseThrow(() -> new ResourceNotFoundException("Üretim başlangıç aşaması bulunamadı."));

        ProductionJob job = new ProductionJob();
        job.setJobNumber(nextProductionJobNumber());
        job.setCustomer(order.getCustomer());
        job.setRelatedOrder(order);
        job.setProductType(order.getProductType());
        job.setCurrentStage(firstStage);
        job.setAssignedEmployee(firstStage.getDefaultResponsibleEmployee());
        job.setPriority(ProductionPriority.NORMAL);
        job.setStatus(ProductionJobStatus.ACTIVE);
        job.setExpectedDeliveryDate(order.getExpectedDeliveryDate());
        job.setNotes(order.getNotes());

        ProductionJob savedJob = productionJobRepository.save(job);
        saveProductionHistory(
            savedJob,
            firstStage,
            firstStage.getDefaultResponsibleEmployee(),
            "Sipariş oluşturuldu ve üretim hattına aktarıldı."
        );
        return savedJob;
    }

    private String nextProductionJobNumber() {
        int year = Year.now().getValue();
        long nextId = productionJobRepository.findTopByOrderByIdDesc().map(job -> job.getId() + 1).orElse(1L);
        String jobNumber = "EG-%d-%04d".formatted(year, nextId);
        while (productionJobRepository.existsByJobNumber(jobNumber)) {
            nextId++;
            jobNumber = "EG-%d-%04d".formatted(year, nextId);
        }
        return jobNumber;
    }

    private void saveProductionHistory(ProductionJob job, ProductionStage stage, Employee performedBy, String note) {
        ProductionJobHistory history = new ProductionJobHistory();
        history.setProductionJob(job);
        history.setFromStage(null);
        history.setToStage(stage);
        history.setPerformedByEmployee(performedBy);
        history.setActionType(ProductionActionType.CREATED);
        history.setNote(note);
        historyRepository.save(history);
    }

    private String nextOrderNumber() {
        int year = LocalDate.now().getYear();
        long nextId = orderRepository.findTopByOrderByIdDesc().map(order -> order.getId() + 1).orElse(1L);
        String orderNumber = String.format("ORD-%d-%04d", year, nextId);
        while (orderRepository.existsByOrderNumber(orderNumber)) {
            nextId++;
            orderNumber = String.format("ORD-%d-%04d", year, nextId);
        }
        return orderNumber;
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> listOrdersByCustomer(Long customerId) {
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
            .map(this::toResponse)
            .toList();
    }

    private OrderResponse toResponse(Order order) {
        ProductionJob productionJob = order.getId() == null
            ? null
            : productionJobRepository.findByRelatedOrderId(order.getId()).orElse(null);
        CurrencyType currency = order.getCurrency() == null ? CurrencyType.TRY : order.getCurrency();
        OrderPaymentStatus paymentStatus = order.getPaymentStatus() == null
            ? OrderPaymentStatus.UNPAID
            : order.getPaymentStatus();
        OrderStatus status = order.getStatus() == null ? OrderStatus.ACTIVE : order.getStatus();
        return OrderResponse.builder()
            .id(order.getId())
            .orderNumber(order.getOrderNumber())
            .customerId(order.getCustomer().getId())
            .customerFullName(order.getCustomer().getFirstName() + " " + order.getCustomer().getLastName())
            .productType(order.getProductType())
            .productTypeLabel(order.getProductType() == null ? "-" : order.getProductType().getDisplayName())
            .orderDate(order.getOrderDate())
            .expectedDeliveryDate(order.getExpectedDeliveryDate())
            .totalAmount(order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount())
            .currency(currency)
            .currencyLabel(currency.getLabel())
            .paymentStatus(paymentStatus)
            .paymentStatusLabel(paymentStatus.getLabel())
            .depositAmount(order.getDepositAmount() == null ? BigDecimal.ZERO : order.getDepositAmount())
            .remainingAmount(order.getRemainingAmount() == null ? BigDecimal.ZERO : order.getRemainingAmount())
            .status(status)
            .statusLabel(status.getLabel())
            .productionJobId(productionJob == null ? null : productionJob.getId())
            .productionJobNumber(productionJob == null ? null : productionJob.getJobNumber())
            .productionStageName(productionJob == null || productionJob.getCurrentStage() == null ? null : productionJob.getCurrentStage().getName())
            .productionStageOrder(productionJob == null || productionJob.getCurrentStage() == null ? null : productionJob.getCurrentStage().getStageOrder())
            .notes(order.getNotes())
            .createdAt(order.getCreatedAt())
            .updatedAt(order.getUpdatedAt())
            .jacketStyleKey(order.getJacketStyleKey())
            .jacketLapelStyle(order.getJacketLapelStyle())
            .jacketLapelWidth(order.getJacketLapelWidth())
            .jacketPocketStyle(order.getJacketPocketStyle())
            .jacketFabricKey(order.getJacketFabricKey())
            .jacketFabricLabel(order.getJacketFabricLabel())
            .shirtCollarStyle(order.getShirtCollarStyle())
            .shirtCollarButtons(order.getShirtCollarButtons())
            .shirtCuffStyle(order.getShirtCuffStyle())
            .shirtFabricKey(order.getShirtFabricKey())
            .shirtFabricLabel(order.getShirtFabricLabel())
            .tuxedoStyle(order.getTuxedoStyle())
            .tuxedoLapelStyle(order.getTuxedoLapelStyle())
            .tuxedoLapelWidth(order.getTuxedoLapelWidth())
            .tuxedoPocketStyle(order.getTuxedoPocketStyle())
            .tuxedoFabricKey(order.getTuxedoFabricKey())
            .tuxedoFabricLabel(order.getTuxedoFabricLabel())
            .vestLapelStyle(order.getVestLapelStyle())
            .vestPocketStyle(order.getVestPocketStyle())
            .vestFabricKey(order.getVestFabricKey())
            .vestFabricLabel(order.getVestFabricLabel())
            .pantFasteningStyle(order.getPantFasteningStyle())
            .pantPleatStyle(order.getPantPleatStyle())
            .pantFabricKey(order.getPantFabricKey())
            .pantFabricLabel(order.getPantFabricLabel())
            .jacketFit(order.getJacketFit())
            .jacketVent(order.getJacketVent())
            .shirtFit(order.getShirtFit())
            .pantFit(order.getPantFit())
            .pantLegStyle(order.getPantLegStyle())
            .pantDrape(order.getPantDrape())
            .build();
    }
}
