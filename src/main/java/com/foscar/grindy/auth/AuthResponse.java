package com.foscar.grindy.auth;

import com.foscar.grindy.user.UserProfile;

public record AuthResponse(String token, UserProfile user) {
}
