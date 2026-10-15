package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AssignmentRequestDto;
import com.adaptit.studentdebt.dto.CaseDetailDto;
import com.adaptit.studentdebt.dto.DebtorRowDto;
import com.adaptit.studentdebt.dto.DecisionRequestDto;
import com.adaptit.studentdebt.security.CurrentUser;
import com.adaptit.studentdebt.security.PortfolioResolver;
import com.adaptit.studentdebt.service.AssignmentService;
import com.adaptit.studentdebt.service.CaseService;
import com.adaptit.studentdebt.service.CsvExportService;
import com.adaptit.studentdebt.service.DebtorQueryService;
import com.adaptit.studentdebt.service.DecisionService;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * The Debt Management Tracker worklist, the Case Management list/detail, CSV export and the
 * officer decision endpoint (issues #11, #12, #13, #17). Lists and the export cover the caller's
 * portfolio (own | team | all); a single case can be opened or decided within the caller's team, or
 * anywhere for a manager or administrator (issue #55). Managers and administrators can reassign
 * a case (issue #56).
 */
@RestController
@RequestMapping("/api/debtors")
public class DebtorController {

    private final DebtorQueryService debtorQueryService;
    private final CaseService caseService;
    private final DecisionService decisionService;
    private final CsvExportService csvExportService;
    private final PortfolioResolver portfolioResolver;
    private final AssignmentService assignmentService;

    public DebtorController(DebtorQueryService debtorQueryService, CaseService caseService,
                             DecisionService decisionService, CsvExportService csvExportService,
                             PortfolioResolver portfolioResolver, AssignmentService assignmentService) {
        this.debtorQueryService = debtorQueryService;
        this.caseService = caseService;
        this.decisionService = decisionService;
        this.csvExportService = csvExportService;
        this.portfolioResolver = portfolioResolver;
        this.assignmentService = assignmentService;
    }

    /**
     * scope: picked (default) | refunds | paying | cases (picked + refunds, for the case list).
     * portfolio: own (default) | team | all (MANAGER/ADMIN only).
     */
    @GetMapping
    public List<DebtorRowDto> list(@RequestParam(required = false) String year,
                                    @RequestParam(required = false) String funding,
                                    @RequestParam(defaultValue = "picked") String scope,
                                    @RequestParam(required = false) String portfolio,
                                    Authentication authentication) {
        Integer y = YearParam.parse(year);
        var f = FundingParam.parse(funding);
        var p = portfolioResolver.resolve(authentication, portfolio);
        return switch (scope) {
            case "refunds" -> debtorQueryService.refundRows(y, f, p);
            case "paying" -> debtorQueryService.payingRows(y, f, p);
            case "cases" -> debtorQueryService.caseRows(y, f, p);
            default -> debtorQueryService.pickedRows(y, f, p);
        };
    }

    @GetMapping("/{debtorKey}")
    public CaseDetailDto detail(@PathVariable String debtorKey, Authentication authentication) {
        debtorQueryService.requireAccess(debtorKey, portfolioResolver.caseAccess(authentication));
        return caseService.detailFor(debtorKey);
    }

    @PostMapping("/{debtorKey}/decision")
    public CaseDetailDto decide(@PathVariable String debtorKey,
                                 @Valid @RequestBody DecisionRequestDto request,
                                 Authentication authentication) {
        debtorQueryService.requireAccess(debtorKey, portfolioResolver.caseAccess(authentication));
        // Attribute the decision to the token's user, whatever the client put in decidedBy.
        var attributed = new DecisionRequestDto(request.action(), request.amendedTerms(), request.reason(),
                CurrentUser.displayName(authentication));
        return decisionService.decide(debtorKey, attributed);
    }

    /** MANAGER/ADMIN only, enforced in SecurityConfig. */
    @PatchMapping("/{debtorKey}/assignment")
    public CaseDetailDto reassign(@PathVariable String debtorKey,
                                   @Valid @RequestBody AssignmentRequestDto request,
                                   Authentication authentication) {
        return assignmentService.reassign(debtorKey, request.officerKey().trim(), CurrentUser.displayName(authentication));
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<String> export(@RequestParam(required = false) String year,
                                          @RequestParam(required = false) String funding,
                                          @RequestParam(required = false) String portfolio,
                                          Authentication authentication) {
        Integer y = YearParam.parse(year);
        var f = FundingParam.parse(funding);
        String csv = csvExportService.export(y, f, portfolioResolver.resolve(authentication, portfolio));
        String fileName = csvExportService.fileName(y, f);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(fileName).build().toString())
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }
}
