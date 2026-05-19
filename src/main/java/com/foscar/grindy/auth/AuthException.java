package com.foscar.grindy.auth;

/**
 * Marker exception for authentication failures that should become HTTP 401 responses.
 */
public final class AuthException extends RuntimeException {
    public AuthException(String message) {
        super(message);
    }
}
