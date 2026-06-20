package com.erdalguda.tailor.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MoveProductionJobRequest {

    private Long toStageId;
    private Long performedByEmployeeId;
    private String note;
}
