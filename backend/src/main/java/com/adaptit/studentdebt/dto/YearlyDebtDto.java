package com.adaptit.studentdebt.dto;

import java.math.BigDecimal;
import java.util.Map;

/** One bar of the Home debt-by-year chart (issue #176): total debt owed to the institution for
 *  that financial year, split by funding source, keyed by {@link com.adaptit.studentdebt.domain.FundingSource} name. */
public record YearlyDebtDto(int year, Map<String, BigDecimal> byFundingSource, BigDecimal total) {
}
