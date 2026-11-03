package com.aives.auth.service;

import com.aives.user.dto.PublicUser;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import com.aives.user.repository.UserRepository;
import com.aives.web.ApiException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final GoogleAccounts googleAccounts;

    public AuthService(
            UserRepository users,
            PasswordEncoder passwords,
            JwtService jwt,
            GoogleAccounts googleAccounts
    ) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        this.googleAccounts = googleAccounts;
    }

    public LoginResponse login(String email, String password) {
        UserAccount user = users.findByEmail(email).orElseThrow(() ->
                new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        if (user.passwordHash() == null || user.passwordHash().isBlank()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "This account signs in with Google");
        }
        if (!passwords.matches(password, user.passwordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        return session(user);
    }

    public LoginResponse register(String name, String email, String password) {
        if (users.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        UserAccount created = new UserAccount(
                UUID.randomUUID().toString(),
                email,
                name.trim(),
                passwords.encode(password),
                Role.STUDENT,
                null
        );
        users.insert(created);
        return session(created);
    }

    public LoginResponse google(String idToken) {
        GoogleAccounts.GoogleProfile profile = googleAccounts.verify(idToken);
        String email = profile.email().trim().toLowerCase(java.util.Locale.ROOT);
        UserAccount existing = users.findByEmail(email).orElse(null);
        if (existing == null) {
            String name = profile.name() == null || profile.name().isBlank()
                    ? email.substring(0, email.indexOf('@'))
                    : profile.name().trim();
            UserAccount created = new UserAccount(
                    UUID.randomUUID().toString(),
                    email,
                    name,
                    null,
                    Role.STUDENT,
                    profile.subject()
            );
            users.insert(created);
            return session(created);
        }
        if (existing.googleSub() == null) {
            users.linkGoogleSubject(existing.id(), profile.subject());
        }
        return session(users.findByEmail(email).orElse(existing));
    }

    public MeResponse me(PublicUser user) {
        return new MeResponse(user);
    }

    private LoginResponse session(UserAccount user) {
        return new LoginResponse(jwt.sign(user), user.toPublic());
    }

    public record LoginResponse(String accessToken, PublicUser user) {
    }

    public record MeResponse(PublicUser user) {
    }
}
