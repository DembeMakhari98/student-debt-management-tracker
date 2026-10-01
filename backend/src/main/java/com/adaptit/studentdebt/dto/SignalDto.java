package com.adaptit.studentdebt.dto;

/** One at-a-glance chip on a case, e.g. "2 missed instalments". */
public record SignalDto(String text, boolean hot) {
}
