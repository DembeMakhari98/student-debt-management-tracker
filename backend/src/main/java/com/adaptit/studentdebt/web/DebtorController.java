package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.service.CaseService;
import com.adaptit.studentdebt.service.CsvExportService;
import com.adaptit.studentdebt.service.DebtorQueryService;
import com.adaptit.studentdebt.service.DecisionService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The Debt Management Tracker worklist, the Case Management list/detail, CSV export and the
 * officer decision endpoint (issues #11, #12, #13, #17).
 */
@RestController
@RequestMapping("/api/debtors")
public class DebtorController {

    private final DebtorQueryService debtorQueryService;
    private final CaseService caseService;
    private final DecisionService decisionService;
    private final CsvExportService csvExportService;

    public DebtorController(DebtorQueryService debtorQueryService, CaseService caseService,
                             DecisionService decisionService, CsvExportService csvExportService) {
        this.debtorQueryService = debtorQueryService;
        this.caseService = caseService;
        this.decisionService = decisionService;
        this.csvExportService = csvExportService;
    }

    /** scope: picked (default) | refunds | paying | cases (picked + refunds, for the case list). */
    @GetMapping
    public List<DebtorRowDto> list(@RequestParam(required = false) String year,
                                    @RequestParam(required = false) String funding,
                                    @RequestParam(defaultValue = "picked") String scope) {
        Integer y = YearParam.parse(year);
        var f = FundingParam.parse(funding);
        return switch (scope) {
            case "refunds" -> debtorQueryService.refundRows(y, f);
            case "paying" -> debtorQueryService.payingRows(y, f);
            case "cases" -> debtorQueryService.caseRows(y, f);
            default -> debtorQueryService.pickedRows(y, f);
        };
    }

    @GetMapping("/{debtorKey}")
    public CaseDetailDto detail(@PathVariable String debtorKey) {
        return caseService.detailFor(debtorKey);
    }

    @PostMapping("/{debtorKey}/decision")
    public CaseDetailDto decide(@PathVariable String debtorKey,
                                 @Valid @RequestBody DecisionRequestDto request) {
        return decisionService.decide(debtorKey, request);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> export(@RequestParam(required = false) String year,
                                          @RequestParam(required = false) String funding) {
        Integer y = YearParam.parse(year);
        var f = FundingParam.parse(funding);
        String csv = csvExportService.export(y, f);
        String fileName = csvExportService.fileName(y, f);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
