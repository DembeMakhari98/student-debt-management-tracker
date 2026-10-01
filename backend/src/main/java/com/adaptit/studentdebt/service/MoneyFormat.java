package com.adaptit.studentdebt.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Locale;

/** ZAR formatting matching the prototype's R(n) helper — "R 12,000". */
public final class MoneyFormat {

    private static final NumberFormat GROUPING = NumberFormat.getIntegerInstance(new Locale("en", "ZA"));

    private MoneyFormat() {
    }

    public static String r(BigDecimal amount) {
        long rounded = amount.setScale(0, RoundingMode.HALF_UP).longValue();
        return "R " + GROUPING.format(rounded);
    }

    public static String r(double amount) {
        return r(BigDecimal.valueOf(amount));
    }
}
