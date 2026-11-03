package com.aives.auth.service;

import com.aives.config.AppProperties;
import com.aives.web.ApiException;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class GoogleIdTokenAccounts implements GoogleAccounts {

    private static final Logger log = LoggerFactory.getLogger(GoogleIdTokenAccounts.class);

    private final AppProperties properties;
    private final NetHttpTransport transport = new NetHttpTransport();
    private final GsonFactory json = GsonFactory.getDefaultInstance();

    public GoogleIdTokenAccounts(AppProperties properties) {
        this.properties = properties;
    }

    @Override
    public GoogleProfile verify(String idToken) {
        String clientId = properties.googleClientId();
        if (clientId == null || clientId.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Google sign-in is not configured");
        }

        try {
            GoogleIdToken verified = new GoogleIdTokenVerifier.Builder(transport, json)
                    .setAudience(List.of(clientId))
                    .build()
                    .verify(idToken);
            if (verified == null) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Google sign-in failed");
            }
            GoogleIdToken.Payload payload = verified.getPayload();
            if (!Boolean.TRUE.equals(payload.getEmailVerified()) || payload.getEmail() == null) {
                throw new ApiException(HttpStatus.UNAUTHORIZED, "Google account email is not verified");
            }
            return new GoogleProfile(payload.getSubject(), payload.getEmail(), (String) payload.get("name"));
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            log.warn("Google sign-in verification failed: {}", exception.getMessage());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Google sign-in failed");
        }
    }
}
