package com.foscar.grindy.auth;

/**
 * Internal identity object used for storage names, API auth and personalization seed.
 */
public record UserContext(String storageId, String telegramId, String username, String firstName, String lastName) {
    public static final String LOCAL_USER_ID = "local_user";

    public static UserContext local() {
        return new UserContext(LOCAL_USER_ID, "", "local_user", "Grindy", "");
    }
}
