package com.aives.user.controller;

import com.aives.user.dto.PublicUser;
import com.aives.user.dto.UserProfile;
import com.aives.user.service.UsersService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final UsersService users;

    public ProfileController(UsersService users) {
        this.users = users;
    }

    @GetMapping
    public UserProfile get(@AuthenticationPrincipal PublicUser user) {
        return users.profile(user.id());
    }

    @PutMapping
    public UserProfile update(@AuthenticationPrincipal PublicUser user, @Valid @RequestBody UpdateProfileRequest request) {
        return users.updateProfile(user.id(), request.name(), request.phone());
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "must not be blank") @Size(max = 80) String name,
            @Pattern(regexp = "^$|^\\+?[0-9]{8,15}$", message = "must be 8-15 digits") String phone
    ) {
    }
}
