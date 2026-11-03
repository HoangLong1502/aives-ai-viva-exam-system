package com.aives.auth.controller;

import com.aives.auth.dto.GoogleLoginRequest;
import com.aives.auth.dto.LoginRequest;
import com.aives.auth.dto.RegisterRequest;
import com.aives.auth.service.AuthService;
import com.aives.auth.service.AuthService.LoginResponse;
import com.aives.auth.service.AuthService.MeResponse;
import com.aives.config.AppProperties;
import com.aives.user.dto.PublicUser;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final AppProperties properties;

    public AuthController(AuthService auth, AppProperties properties) {
        this.auth = auth;
        this.properties = properties;
    }

    @GetMapping("/config")
    public Map<String, String> config() {
        String clientId = properties.googleClientId() == null ? "" : properties.googleClientId();
        return Map.of("clientId", clientId);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request.email(), request.password());
    }

    @PostMapping("/register")
    public LoginResponse register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request.name(), request.email(), request.password());
    }

    @PostMapping("/google")
    public LoginResponse google(@Valid @RequestBody GoogleLoginRequest request) {
        return auth.google(request.idToken());
    }

    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal PublicUser user) {
        return auth.me(user);
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout() {
        return Map.of("success", true);
    }
}
