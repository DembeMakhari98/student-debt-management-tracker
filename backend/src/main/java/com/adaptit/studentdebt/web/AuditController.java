package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.CaseAccessDto;
import com.adaptit.studentdebt.dto.PortfolioEscalationDto;
import com.adaptit.studentdebt.repository.CaseAccessLogRepository;
import com.adaptit.studentdebt.repository.PortfolioEscalationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read-only audit trails. MANAGER/ADMIN only, enforced in SecurityConfig (issue #62). */
@RestController
public class AuditController {

    private static final int MAX_LIMIT = 500;

    private final PortfolioEscalationRepository portfolioEscalationRepository;
    private final CaseAccessLogRepository caseAccessLogRepository;

    public AuditController(PortfolioEscalationRepository portfolioEscalationRepository,
                           CaseAccessLogRepository caseAccessLogRepository) {
        this.portfolioEscalationRepository = portfolioEscalationRepository;
        this.caseAccessLogRepository = caseAccessLogRepository;
    }

    /** Most recent first. */
    @GetMapping("/api/audit/portfolio-escalations")
    public List<PortfolioEscalationDto> portfolioEscalations(@RequestParam(defaultValue = "100") int limit) {
        int size = Math.max(1, Math.min(limit, MAX_LIMIT));
        return portfolioEscalationRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, size)).stream()
                .map(PortfolioEscalationDto::from)
                .toList();
    }

    /** Who opened which case and when, most recent first; optionally for one case only. */
    @GetMapping("/api/audit/case-access")
    public List<CaseAccessDto> caseAccess(@RequestParam(required = false) String debtorKey,
                                          @RequestParam(defaultValue = "100") int limit) {
        var page = PageRequest.of(0, Math.max(1, Math.min(limit, MAX_LIMIT)));
        var rows = debtorKey == null || debtorKey.isBlank()
                ? caseAccessLogRepository.findAllByOrderByAccessedAtDesc(page)
                : caseAccessLogRepository.findAllByDebtorKeyOrderByAccessedAtDesc(debtorKey.trim(), page);
        return rows.stream().map(CaseAccessDto::from).toList();
    }
}
