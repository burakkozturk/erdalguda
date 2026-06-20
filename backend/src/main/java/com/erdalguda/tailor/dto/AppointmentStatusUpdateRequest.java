package com.erdalguda.tailor.dto;

import com.erdalguda.tailor.entity.AppointmentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AppointmentStatusUpdateRequest {

    @NotNull
    private AppointmentStatus status;
}
