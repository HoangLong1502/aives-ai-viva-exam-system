package com.aives.user.repository;

import com.aives.user.dto.UserProfile;
import com.aives.user.model.Role;
import com.aives.user.model.UserAccount;
import java.util.List;
import java.util.Optional;

public interface UserRepository {

    Optional<UserAccount> findByEmail(String email);

    Optional<UserAccount> findById(String id);

    List<UserAccount> findAllOrdered();

    long countByRole(Role role);

    UserAccount updateRole(String id, Role role);

    void insert(UserAccount user);

    Optional<UserProfile> findProfile(String id);

    UserProfile updateProfile(String id, String name, String phone);

    void linkGoogleSubject(String id, String googleSub);
}
