package com.foscar.grindy.auth;

/**
 * Auth payload from Telegram Mini App initData, or a local username in development mode.
 */
public record AuthRequest(String initData, String username) {
}
