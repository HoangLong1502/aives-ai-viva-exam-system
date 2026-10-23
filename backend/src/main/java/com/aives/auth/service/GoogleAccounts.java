package com.aives.auth.service;

public interface GoogleAccounts {

    GoogleProfile verify(String idToken);

    record GoogleProfile(String subject, String email, String name) {
    }
}
