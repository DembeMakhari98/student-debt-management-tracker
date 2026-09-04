package com.adaptit.studentdebt.dto;

import java.time.Instant;

public record ActivityEntryDto(String text, String source, Instant createdAt) {
}
