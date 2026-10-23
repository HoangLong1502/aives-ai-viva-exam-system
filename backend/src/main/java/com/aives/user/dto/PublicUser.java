package com.aives.user.dto;

import com.aives.user.model.Role;

public record PublicUser(
        String id,
        String email,
        String name,
        Role role
) {
}
