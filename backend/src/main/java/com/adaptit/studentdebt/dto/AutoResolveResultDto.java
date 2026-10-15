package com.adaptit.studentdebt.dto;

import java.util.List;

/** Response of POST /api/cases/auto-resolve (issue #58). */
public record AutoResolveResultDto(int resolvedCount, List<String> debtorKeys) {
}
