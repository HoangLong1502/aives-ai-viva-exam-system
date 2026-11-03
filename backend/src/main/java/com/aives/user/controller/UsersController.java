package com.aives.user.controller;

import com.aives.user.dto.PublicUser;
import com.aives.user.model.Role;
import com.aives.user.service.UsersService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UsersController {

    private final UsersService users;

    public UsersController(UsersService users) {
        this.users = users;
    }

    @GetMapping
    public List<PublicUser> list() {
        return users.listPublic();
    }

    @PatchMapping("/{id}/role")
    public PublicUser assignRole(@PathVariable UUID id, @Valid @RequestBody AssignRoleRequest request) {
        return users.assignRole(id.toString(), request.role());
    }

    public record AssignRoleRequest(@NotNull(message = "must be a valid role") Role role) {
    }
}
