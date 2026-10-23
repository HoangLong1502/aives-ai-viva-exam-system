package com.aives.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.aives.config.AppProperties;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import com.aives.user.repository.UserRepository;
import com.aives.web.ApiException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

class AuthServiceTest {

    private final InMemoryUsers users = new InMemoryUsers();
    private final AuthService auth = new AuthService(
            users,
            new BCryptPasswordEncoder(10),
            new JwtService(new AppProperties("test-secret", Duration.ofDays(1), "http://localhost:3001", "", "", null)),
            idToken -> new GoogleAccounts.GoogleProfile("google-subject", "new.person@gmail.com", "New Person")
    );

    @Test
    void registerCreatesAStudentSession() {
        AuthService.LoginResponse response = auth.register("Ada Lovelace", "ada@aives.test", "correcthorse");

        assertEquals(Role.STUDENT, response.user().role());
        assertEquals("ada@aives.test", response.user().email());
        assertTrue(response.accessToken().split("\\.").length == 3);
    }

    @Test
    void registerRejectsAnExistingEmail() {
        auth.register("Ada Lovelace", "ada@aives.test", "correcthorse");

        ApiException error = assertThrows(
                ApiException.class,
                () -> auth.register("Someone", "ada@aives.test", "anotherpass")
        );

        assertEquals(HttpStatus.CONFLICT, error.status());
    }

    @Test
    void googleCreatesAnAccountThenSignsInTheSameEmail() {
        AuthService.LoginResponse created = auth.google("token");
        AuthService.LoginResponse again = auth.google("token");

        assertEquals(created.user().id(), again.user().id());
        assertEquals("new.person@gmail.com", created.user().email());
        assertEquals(1, users.findAllOrdered().size());
    }

    private static final class InMemoryUsers implements UserRepository {
        private final List<UserAccount> rows = new ArrayList<>();

        @Override
        public Optional<UserAccount> findByEmail(String email) {
            return rows.stream().filter(user -> user.email().equals(email)).findFirst();
        }

        @Override
        public Optional<UserAccount> findById(String id) {
            return rows.stream().filter(user -> user.id().equals(id)).findFirst();
        }

        @Override
        public List<UserAccount> findAllOrdered() {
            return List.copyOf(rows);
        }

        @Override
        public long countByRole(Role role) {
            return rows.stream().filter(user -> user.role() == role).count();
        }

        @Override
        public UserAccount updateRole(String id, Role role) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void insert(UserAccount user) {
            rows.add(user);
        }

        @Override
        public java.util.Optional<com.aives.user.dto.UserProfile> findProfile(String id) {
            return java.util.Optional.empty();
        }

        @Override
        public com.aives.user.dto.UserProfile updateProfile(String id, String name, String phone) {
            throw new UnsupportedOperationException();
        }

        @Override
        public void linkGoogleSubject(String id, String googleSub) {
            UserAccount current = findById(id).orElseThrow();
            rows.removeIf(user -> user.id().equals(id));
            rows.add(new UserAccount(
                    current.id(),
                    current.email(),
                    current.name(),
                    current.passwordHash(),
                    current.role(),
                    googleSub
            ));
        }
    }
}
