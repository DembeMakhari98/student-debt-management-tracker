package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.OfficerDto;
import com.adaptit.studentdebt.service.AssignmentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The officers a case can be assigned to (issue #56). */
@RestController
public class OfficerController {

    private final AssignmentService assignmentService;

    public OfficerController(AssignmentService assignmentService) {
        this.assignmentService = assignmentService;
    }

    @GetMapping("/api/officers")
    public List<OfficerDto> officers() {
        return assignmentService.officers().stream().map(OfficerDto::from).toList();
    }
}
