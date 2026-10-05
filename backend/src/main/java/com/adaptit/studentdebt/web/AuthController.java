package com.adaptit.studentdebt.web;

import com.adaptit.studentdebt.dto.AuthUserDto;
import com.adaptit.studentdebt.dto.LoginRequestDto;
import com.adaptit.studentdebt.dto.LoginResponseDto;
import com.adaptit.studentdebt.repository.AppUserRepository;
import com.adaptit.studentdebt.security.JwtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Sign-in: exchanges a username and password for a JWT, and reports who the token belongs to. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final AppUserRepository appUserRepository;
    private final JwtService jwtService;

    public AuthController(AuthenticationManager authenticationManager, AppUserRepository appUserRepository,
                          JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.appUserRepository = appUserRepository;
        this.jwtService = jwtService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestDto request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.username().trim(), request.password()));
        } catch (AuthenticationException e) {
            // One message for unknown user, wrong password and disabled account, so usernames can't be probed.
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Incorrect username or password"));
        }
        var user = appUserRepository.findByUsernameIgnoreCase(authentication.getName()).orElseThrow();
        var issued = jwtService.issue(user);
        return ResponseEntity.ok(new LoginResponseDto(issued.token(), issued.expiresAt(), AuthUserDto.from(user)));
    }

    @GetMapping("/me")
    public AuthUserDto me(Authentication authentication) {
        return appUserRepository.findByUsernameIgnoreCase(authentication.getName())
                .map(AuthUserDto::from)
                .orElseThrow(() -> new NotFoundException("User " + authentication.getName() + " not found"));
    }
}
