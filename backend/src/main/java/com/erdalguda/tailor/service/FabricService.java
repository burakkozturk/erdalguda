package com.erdalguda.tailor.service;

import com.erdalguda.tailor.dto.FabricRequest;
import com.erdalguda.tailor.dto.FabricResponse;
import com.erdalguda.tailor.entity.Fabric;
import com.erdalguda.tailor.entity.GarmentType;
import com.erdalguda.tailor.exception.ResourceNotFoundException;
import com.erdalguda.tailor.repository.FabricRepository;
import java.util.List;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class FabricService {

    private static final String PYTHON_BASE = "http://localhost:8000";
    private static final String S3_ASSET_BASE_URL = "https://erdalguda-assets.s3.eu-north-1.amazonaws.com";
    private static final String BLAZER_SWATCH_TEMPLATE = S3_ASSET_BASE_URL + "/blazer/generated-swatches/%s.png";
    private static final String SHIRT_SWATCH_TEMPLATE  = S3_ASSET_BASE_URL + "/shirts/generated-swatches/%s.png";

    private final FabricRepository fabricRepository;
    private final RestTemplate restTemplate;

    public FabricService(FabricRepository fabricRepository, RestTemplateBuilder restTemplateBuilder) {
        this.fabricRepository = fabricRepository;
        this.restTemplate = restTemplateBuilder.build();
    }

    @Transactional(readOnly = true)
    public List<FabricResponse> findAll(GarmentType type) {
        if (type != null) {
            return fabricRepository.findAllByTypeOrderByCreatedAtDesc(type).stream()
                .map(this::toResponse)
                .toList();
        }
        return fabricRepository.findAllByOrderByCreatedAtDesc().stream()
            .map(this::toResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public FabricResponse findByFabricId(String fabricId) {
        return toResponse(fabricRepository.findByFabricId(fabricId)
            .orElseThrow(() -> new ResourceNotFoundException("Kumaş bulunamadı: " + fabricId)));
    }

    @Transactional
    public FabricResponse create(FabricRequest request) {
        if (fabricRepository.existsByFabricId(request.getFabricId())) {
            return toResponse(fabricRepository.findByFabricId(request.getFabricId()).get());
        }
        Fabric fabric = new Fabric();
        fabric.setFabricId(request.getFabricId());
        fabric.setKey(request.getKey());
        fabric.setName(request.getName());
        fabric.setLabel(request.getLabel());
        fabric.setSubtitle(request.getSubtitle());
        fabric.setDefaultFabric(request.isDefaultFabric());
        fabric.setCreatedBy(request.getCreatedBy());
        fabric.setType(request.getType() != null ? request.getType() : GarmentType.JACKET);
        fabric.setTag(request.getTag());
        fabric.setInStock(request.isInStock());
        return toResponse(fabricRepository.save(fabric));
    }

    @Transactional
    public FabricResponse update(String fabricId, FabricRequest request) {
        Fabric fabric = fabricRepository.findByFabricId(fabricId)
            .orElseThrow(() -> new ResourceNotFoundException("Kumaş bulunamadı: " + fabricId));
        if (request.getName() != null && !request.getName().isBlank()) {
            fabric.setName(request.getName());
        }
        fabric.setTag(request.getTag());
        fabric.setInStock(request.isInStock());
        if (request.getType() != null) {
            fabric.setType(request.getType());
        }
        return toResponse(fabricRepository.save(fabric));
    }

    @Transactional
    public void delete(String fabricId) {
        Fabric fabric = fabricRepository.findByFabricId(fabricId)
            .orElseThrow(() -> new ResourceNotFoundException("Kumaş bulunamadı: " + fabricId));
        if (fabric.isDefaultFabric()) {
            throw new IllegalStateException("Varsayılan kumaş silinemez.");
        }
        fabricRepository.delete(fabric);
        try {
            restTemplate.delete(PYTHON_BASE + "/api/fabrics/" + fabricId);
        } catch (Exception e) {
            System.err.println("[FabricService] Python DELETE warning (ignored): " + e.getMessage());
        }
    }

    public void warmUpPython() {
        try {
            restTemplate.getForObject(PYTHON_BASE + "/api/health", String.class);
        } catch (Exception e) {
            System.err.println("[FabricService] Python warm-up (ignored): " + e.getMessage());
        }
    }

    @Transactional
    public void seedDefaultFabric() {
        // Ensure the canonical default fabric exists. User-created fabrics
        // must survive restarts, so we never purge non-default rows here.
        if (!fabricRepository.existsByFabricId("2191")) {
            FabricRequest req = new FabricRequest();
            req.setFabricId("2191");
            req.setKey("karels-navy");
            req.setName("Karels");
            req.setLabel("Comfort stretch · Twill · Navy Blue");
            req.setSubtitle("Comfort stretch · Twill · Navy Blue");
            req.setDefaultFabric(true);
            req.setCreatedBy("system");
            req.setType(GarmentType.JACKET);
            req.setInStock(true);
            req.setTag("Comfort Stretch");
            create(req);
        }
    }

    private FabricResponse toResponse(Fabric fabric) {
        return FabricResponse.builder()
            .id(fabric.getId())
            .fabricId(fabric.getFabricId())
            .key(fabric.getKey())
            .name(fabric.getName())
            .label(fabric.getLabel())
            .subtitle(fabric.getSubtitle())
            .defaultFabric(fabric.isDefaultFabric())
            .type(fabric.getType())
            .tag(fabric.getTag())
            .inStock(fabric.isInStock())
            .createdAt(fabric.getCreatedAt())
            .createdBy(fabric.getCreatedBy())
            .swatchUrl(String.format(
                fabric.getType() == GarmentType.SHIRT ? SHIRT_SWATCH_TEMPLATE : BLAZER_SWATCH_TEMPLATE,
                fabric.getFabricId()))
            .build();
    }
}
