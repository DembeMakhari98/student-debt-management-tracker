package com.adaptit.studentdebt.dto;

/** One proposed-terms row, e.g. {"Instalments", "4 × R 3,050"}. */
public record TermDto(String key, String value) {
}
