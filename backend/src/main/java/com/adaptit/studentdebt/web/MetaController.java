package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.domain.FundingSource;
import com.adaptit.studentdebt.dto.MetaDto;
import com.adaptit.studentdebt.repository.DebtorRepository;
import com.adaptit.studentdebt.repository.SystemSettingRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Year;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

/** Filter options and autonomy config for the global chrome (issue #16, business case §3.6). */
@RestController
public class MetaController {

    private static final List<MetaDto.AutonomyLevelDto> LEVELS = List.of(
            new MetaDto.AutonomyLevelDto(1, "1 · Observe", "Score and report only"),
            new MetaDto.AutonomyLevelDto(2, "2 · Recommend", "Human accepts every action"),
            new MetaDto.AutonomyLevelDto(3, "3 · Act within policy", "Low-risk actions automatic"),
            new MetaDto.AutonomyLevelDto(4, "4 · Act and report", "Full workflow, post-hoc review")
    );

    private final DebtorRepository debtorRepository;
    private final SystemSettingRepository systemSettingRepository;

    public MetaController(DebtorRepository debtorRepository, SystemSettingRepository systemSettingRepository) {
        this.debtorRepository = debtorRepository;
        this.systemSettingRepository = systemSettingRepository;
    }

    @GetMapping("/api/meta")
    public MetaDto meta() {
        List<Integer> years = debtorRepository.findAll().stream()
                .map(d -> d.getFinancialYear())
                .distinct()
                .sorted(Comparator.reverseOrder())
                .toList();
        int calendarYear = Year.now().getValue();
        int latestYear = years.isEmpty() ? calendarYear : years.get(0);
        int defaultYear = years.contains(calendarYear) ? calendarYear : latestYear;

        List<MetaDto.FundingOptionDto> fundingSources = Arrays.stream(FundingSource.values())
                .map(f -> new MetaDto.FundingOptionDto(f.name(), f.getLabel()))
                .toList();

        int autonomyLevel = systemSettingRepository.findById("autonomy_level")
                .map(s -> Integer.parseInt(s.getSettingValue()))
                .orElse(2);

        return new MetaDto(years, calendarYear, defaultYear, fundingSources, autonomyLevel, LEVELS);
    }
}
