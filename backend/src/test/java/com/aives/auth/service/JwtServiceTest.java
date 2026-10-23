package com.aives.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.aives.config.AppProperties;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    @Test
    void roundTripsTheUserId() {
        JwtService jwt = new JwtService(new AppProperties(
                "aives-dev-jwt-secret-change-me",
                Duration.ofDays(7),
                "http://localhost:3001",
                "",
                "",
                null
        ));
        UserAccount user = new UserAccount("user-1", "jordan.h@example.net", "Jordan Hale", "hash", Role.ADMIN, null);

        assertEquals("user-1", jwt.subject(jwt.sign(user)));
    }
}
