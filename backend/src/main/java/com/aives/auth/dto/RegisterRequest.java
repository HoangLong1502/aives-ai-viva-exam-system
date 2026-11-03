package com.aives.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;

public record RegisterRequest(
        @NotBlank @Size(max = 80) String name,
        @NotBlank @Email(message = "must be an email") String email,
        @NotBlank @Size(min = 8, message = "must be at least 8 characters") String password
) {
    public RegisterRequest {
        if (name != null) {
            name = name.trim();
        }
        if (email != null) {
            email = email.trim().toLowerCase(Locale.ROOT);
        }
    }
}
