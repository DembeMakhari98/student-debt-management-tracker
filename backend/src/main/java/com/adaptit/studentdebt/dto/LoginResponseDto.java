package com.adaptit.studentdebt.dto;

import java.time.Instant;

/** Response of POST /api/auth/login: the bearer token to send on every other /api call. */
public record LoginResponseDto(String token, Instant expiresAt, AuthUserDto user) {
}
