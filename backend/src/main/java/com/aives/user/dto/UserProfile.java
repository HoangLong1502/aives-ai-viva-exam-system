package com.aives.user.dto;

import com.aives.user.model.Role;

public record UserProfile(String id, String email, String name, String phone, String studentCode, Role role) {
}
