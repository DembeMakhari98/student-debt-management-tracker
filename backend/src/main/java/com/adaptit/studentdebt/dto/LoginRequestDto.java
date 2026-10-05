package com.adaptit.studentdebt.dto;

import jakarta.validation.constraints.NotBlank;

/** Body of POST /api/auth/login. */
public record LoginRequestDto(@NotBlank String username, @NotBlank String password) {
}
