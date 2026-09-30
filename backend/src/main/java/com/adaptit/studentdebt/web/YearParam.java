package com.adaptit.studentdebt.web;

/**
 * Parses the {@code year} query parameter, which is either a financial year or the
 * literal {@code "all"} (matching the Angular frontend's `'all'` sentinel for the
 * "All years" filter — see DebtService.year in the frontend). {@code null} means "all".
 */
final class YearParam {

    private YearParam() {
    }

    static Integer parse(String year) {
        if (year == null || year.isBlank() || "all".equalsIgnoreCase(year)) {
            return null;
        }
        return Integer.valueOf(year);
    }
}
