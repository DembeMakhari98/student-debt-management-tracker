package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AutoResolveResultDto;
import com.adaptit.studentdebt.service.AutoResolveService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Triggers the server-side autonomous execution scoring run (issue #58). MANAGER/ADMIN only —
 * enforced by {@code SecurityConfig}'s path rule for this exact endpoint, not here.
 */
@RestController
public class CaseAutoResolveController {

    private final AutoResolveService autoResolveService;

    public CaseAutoResolveController(AutoResolveService autoResolveService) {
        this.autoResolveService = autoResolveService;
    }

    @PostMapping("/api/cases/auto-resolve")
    public AutoResolveResultDto autoResolve() {
        return autoResolveService.autoResolve();
    }
}
