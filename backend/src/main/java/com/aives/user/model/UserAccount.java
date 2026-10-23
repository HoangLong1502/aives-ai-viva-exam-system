package com.aives.user.model;

import com.aives.user.dto.PublicUser;

public record UserAccount(
        String id,
        String email,
        String name,
        String passwordHash,
        Role role,
        String googleSub
) {
    public PublicUser toPublic() {
        return new PublicUser(id, email, name, role);
    }
}
