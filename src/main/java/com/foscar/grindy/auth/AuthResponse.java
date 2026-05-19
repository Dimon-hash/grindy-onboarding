package com.foscar.grindy.auth;

import com.foscar.grindy.user.UserProfile;

/**
 * Response returned after auth: a bearer token plus the current profile/onboarding state.
 */
public record AuthResponse(String token, UserProfile user) {
}
