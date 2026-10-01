package com.adaptit.studentdebt.dto;

import java.math.BigDecimal;

public record AgeingDto(
        BigDecimal current,
        BigDecimal d30,
        BigDecimal d60,
        BigDecimal d90,
        BigDecimal d120
) {
}
