package com.aives.auth.filter;

import com.aives.auth.service.JwtService;
import com.aives.user.dto.PublicUser;
import com.aives.user.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    public static final String ERROR = "aives.authError";

    private final JwtService jwt;
    private final UserRepository users;

    public JwtAuthenticationFilter(JwtService jwt, UserRepository users) {
        this.jwt = jwt;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            if (token.isEmpty()) {
                request.setAttribute(ERROR, "Missing access token");
            } else {
                authenticate(request, token);
            }
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, String token) {
        try {
            String userId = jwt.subject(token);
            users.findById(userId).ifPresentOrElse(user -> {
                PublicUser principal = user.toPublic();
                var authentication = new UsernamePasswordAuthenticationToken(
                        principal,
                        null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name()))
                );
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }, () -> request.setAttribute(ERROR, "Account no longer exists"));
        } catch (RuntimeException exception) {
            request.setAttribute(ERROR, "Invalid or expired session");
        }
    }
}
