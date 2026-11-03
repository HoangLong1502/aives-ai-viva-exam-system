package com.aives.user.service;

import com.aives.user.dto.PublicUser;
import com.aives.user.dto.UserProfile;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import com.aives.user.repository.UserRepository;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.aives.web.ApiException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class UsersServiceTest {

    @Test
    void refusesToDemoteTheLastAdministrator() {
        InMemoryUsers users = new InMemoryUsers();
        users.insert(account("admin", Role.ADMIN));
        UsersService service = new UsersService(users);

        ApiException error = assertThrows(ApiException.class, () -> service.assignRole("admin", Role.EXAMINER));

        assertEquals(HttpStatus.FORBIDDEN, error.status());
        assertEquals("Cannot demote the last administrator", error.getMessage());
        assertEquals(Role.ADMIN, users.findById("admin").orElseThrow().role());
    }

    @Test
    void allowsDemotionWhenAnotherAdministratorRemains() {
        InMemoryUsers users = new InMemoryUsers();
        users.insert(account("admin-1", Role.ADMIN));
        users.insert(account("admin-2", Role.ADMIN));
        UsersService service = new UsersService(users);

        PublicUser updated = service.assignRole("admin-1", Role.EXAMINER);

        assertEquals(Role.EXAMINER, updated.role());
    }

    private static UserAccount account(String id, Role role) {
        return new UserAccount(id, id + "@aives.test", id, "hash", role, null);
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
            UserAccount current = findById(id).orElseThrow();
            rows.removeIf(user -> user.id().equals(id));
            UserAccount updated = new UserAccount(
                    current.id(), current.email(), current.name(), current.passwordHash(), role, current.googleSub());
            rows.add(updated);
            return updated;
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
                    current.googleSub() == null ? googleSub : current.googleSub()
            ));
        }
    }
}
