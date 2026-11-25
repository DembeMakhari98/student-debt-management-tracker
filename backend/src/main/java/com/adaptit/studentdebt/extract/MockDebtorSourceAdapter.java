package com.adaptit.studentdebt.extract;

import com.adaptit.studentdebt.domain.FundingSource;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Stands in for a real pull from ITS Integrator (issue #1) until that integration is
 * confirmed. Returns the same 26-record demonstration book used by the Liquibase seed
 * data and the Angular frontend's mock dataset, so every environment agrees on numbers.
 */
@Component
public class MockDebtorSourceAdapter implements DebtorSourceAdapter {

    private static final String ELEC = "NC(V) L4 Electrical Infrastructure Construction";
    private static final String FIN = "Report 191 N4 Financial Management";
    private static final String ENG = "NC(V) L3 Engineering and Related Design";
    private static final String OFF = "NC(V) L2 Office Administration";
    private static final String HOSP = "NC(V) L4 Hospitality";
    private static final String MKT = "Report 191 N5 Marketing Management";
    private static final String HR = "Report 191 N6 Human Resource Management";
    private static final String CIV = "NC(V) L3 Civil Engineering and Building Construction";
    private static final String BUS = "Report 191 N6 Business Management";

    /** Student Numbers (issue #305) — the same values Liquibase changeset 018 seeds. */
    static final Map<String, String> STUDENT_NUMBERS = Map.ofEntries(
            Map.entry("STU-100234", "100234604"),
            Map.entry("STU-100251", "100251584"),
            Map.entry("STU-100288", "100288991"),
            Map.entry("STU-100290", "100290734"),
            Map.entry("STU-100301", "100301486"),
            Map.entry("STU-100312", "100312571"),
            Map.entry("STU-100333", "100333703"),
            Map.entry("STU-100360", "100360730"),
            Map.entry("STU-100341", "100341674"),
            Map.entry("STU-100355", "100355873"),
            Map.entry("STU-098012", "098012752"),
            Map.entry("STU-098044", "098044969"),
            Map.entry("STU-098077", "098077224"),
            Map.entry("STU-098090", "098090052"),
            Map.entry("STU-098111", "098111851"),
            Map.entry("STU-098140", "098140954"),
            Map.entry("STU-098155", "098155191"),
            Map.entry("STU-095003", "095003632"),
            Map.entry("STU-095021", "095021650"),
            Map.entry("STU-095050", "095050753"),
            Map.entry("STU-095066", "095066028"),
            Map.entry("STU-091009", "091009712"),
            Map.entry("STU-091033", "091033625"),
            Map.entry("STU-091074", "091074851"),
            Map.entry("STU-088002", "088002668"),
            Map.entry("STU-088040", "088040780"));

    @Override
    public List<ExtractedDebtor> extractDebtors() {
        List<ExtractedDebtor> out = new ArrayList<>();

        // ---- 2026 ----
        out.add(row("STU-100234", "Thabo Mokoena", 2026, ELEC, FundingSource.SELF, "Self-funded", 2, "2026-06-12", null,
                12000, 8000, 4000, 0, 0, null, null, null));
        out.add(row("STU-100251", "Lerato Naidoo", 2026, FIN, FundingSource.GOV, "NSFAS pending", 3, "2026-02-04", null,
                0, 0, 15200, 9800, 22000, null, null, null));
        out.add(row("STU-100288", "Kagiso Botha", 2026, ENG, FundingSource.PRIVATE, "Bursary partial", 1, "2026-07-18", null,
                6400, 6400, 0, 0, 0, null, null, null));
        out.add(row("STU-100290", "Sipho Dlamini", 2026, OFF, FundingSource.SELF, "Self-funded", 0, "2026-08-05", null,
                3200, 0, 0, 0, 0, null, null, null));
        out.add(row("STU-100301", "Refilwe van Wyk", 2026, HOSP, FundingSource.GOV, "NSFAS declined", 4, null, "Defaulted",
                0, 0, 0, 11500, 33500, null, null, null));
        out.add(row("STU-100312", "Palesa Khumalo", 2026, MKT, FundingSource.PRIVATE, "Bursary confirmed", 0, "2026-08-01", null,
                9000, 0, 0, 0, 0, null, null, null));
        out.add(row("STU-100333", "Ayanda Pillay", 2026, HR, FundingSource.SELF, "Self-funded", 3, "2026-03-20", null,
                0, 0, 2600, 2600, 5200, null, null, null));
        out.add(row("STU-100360", "Naledi Mahlangu", 2026, CIV, FundingSource.GOV, "NSFAS pending", 1, "2026-07-10", null,
                0, 14000, 0, 0, 0, null, null, null));
        out.add(row("STU-100341", "Mpho Sithole", 2026, ELEC, FundingSource.SELF, "Self-funded", 0, "2026-07-28", null,
                -4200, 0, 0, 0, 0, "2026-07-28", 24, "Duplicate EFT receipted twice"));
        out.add(row("STU-100355", "Jessica Adams", 2026, FIN, FundingSource.PRIVATE, "Bursary overpaid", 0, "2026-07-22", null,
                -11800, 0, 0, 0, 0, "2026-02-12", 190, "Bursary award exceeded assessed fees"));

        // ---- 2025 ----
        out.add(row("STU-098012", "Dineo Nkosi", 2025, ENG, FundingSource.SELF, "Self-funded", 4, "2025-04-14", "Defaulted",
                0, 0, 0, 6200, 18800, null, null, null));
        out.add(row("STU-098044", "Christo Meyer", 2025, HOSP, FundingSource.GOV, "NSFAS lapsed", 5, null, null,
                0, 0, 0, 0, 41200, null, null, null));
        out.add(row("STU-098077", "Farhana Jacobs", 2025, MKT, FundingSource.PRIVATE, "Bursary partial", 2, "2025-09-09", null,
                0, 5000, 5000, 0, 0, null, null, null));
        out.add(row("STU-098090", "Bongani Zulu", 2025, OFF, FundingSource.SELF, "Self-funded", 3, "2025-05-02", null,
                0, 0, 0, 0, 9600, null, null, null));
        out.add(row("STU-098111", "Gerrit Petersen", 2025, CIV, FundingSource.GOV, "NSFAS pending", 4, "2025-03-17", null,
                0, 0, 8800, 8800, 15000, null, null, null));
        out.add(row("STU-098140", "Hlengiwe Maluleke", 2025, HR, FundingSource.PRIVATE, "Bursary overpaid", 0, "2025-10-30", null,
                -7300, 0, 0, 0, 0, "2025-10-30", 212, "Sponsor paid after the student had settled"));
        out.add(row("STU-098155", "Imraan September", 2025, ELEC, FundingSource.SELF, "Self-funded", 3, "2025-06-21", null,
                0, 0, 0, 3400, 12600, null, null, null));

        // ---- 2024 ----
        out.add(row("STU-095003", "Oratile Mabaso", 2024, HOSP, FundingSource.GOV, "NSFAS declined", 6, null, "Defaulted",
                0, 0, 0, 0, 52000, null, null, null));
        out.add(row("STU-095021", "Quinton Fourie", 2024, ENG, FundingSource.SELF, "Self-funded", 5, "2024-02-08", null,
                0, 0, 0, 0, 23400, null, null, null));
        out.add(row("STU-095050", "Elias Ngwenya", 2024, BUS, FundingSource.PRIVATE, "Bursary lapsed", 4, "2024-03-19", null,
                0, 0, 0, 0, 14200, null, null, null));
        out.add(row("STU-095066", "Vanessa Coetzee", 2024, OFF, FundingSource.SELF, "Self-funded", 0, "2024-11-11", null,
                -2100, 0, 0, 0, 0, "2024-11-11", 168, "Module cancellation credited after payment"));

        // ---- 2023 ----
        out.add(row("STU-091009", "Wandile Mthembu", 2023, CIV, FundingSource.GOV, "NSFAS lapsed", 6, null, null,
                0, 0, 0, 0, 38700, null, null, null));
        out.add(row("STU-091033", "Yolanda Steyn", 2023, HR, FundingSource.SELF, "Self-funded", 5, "2023-04-06", null,
                0, 0, 0, 0, 16900, null, null, null));
        out.add(row("STU-091074", "Zodwa Mokgadi", 2023, MKT, FundingSource.PRIVATE, "Bursary lapsed", 4, "2023-05-27", null,
                0, 0, 0, 0, 8100, null, null, null));

        // ---- 2022 ----
        out.add(row("STU-088002", "Unathi Radebe", 2022, FIN, FundingSource.GOV, "NSFAS declined", 6, null, null,
                0, 0, 0, 0, 27500, null, null, null));
        out.add(row("STU-088040", "Xolani Booysen", 2022, BUS, FundingSource.SELF, "Self-funded", 5, "2022-03-15", null,
                0, 0, 0, 0, 11200, null, null, null));

        return out;
    }

    @Override
    public Map<Integer, Integer> extractRegisteredCounts() {
        Map<Integer, Integer> counts = new LinkedHashMap<>();
        counts.put(2022, 4210);
        counts.put(2023, 4388);
        counts.put(2024, 4562);
        counts.put(2025, 4703);
        counts.put(2026, 4812);
        return counts;
    }

    private ExtractedDebtor row(String studentId, String name, int year, String programme, FundingSource fundingSource,
                                String fundingStatus, int missed, String lastPay, String arrangement,
                                double current, double d30, double d60, double d90, double d120,
                                String creditSince, Integer creditDays, String creditReason) {
        return new ExtractedDebtor(
                studentId + "-" + year,
                studentId,
                STUDENT_NUMBERS.get(studentId),
                name,
                year,
                programme,
                fundingSource,
                fundingStatus,
                missed,
                lastPay == null ? null : LocalDate.parse(lastPay),
                arrangement,
                BigDecimal.valueOf(current),
                BigDecimal.valueOf(d30),
                BigDecimal.valueOf(d60),
                BigDecimal.valueOf(d90),
                BigDecimal.valueOf(d120),
                creditSince == null ? null : LocalDate.parse(creditSince),
                creditDays,
                creditReason
        );
    }
}
