package com.foscar.grindy;

record UserContext(String storageId, String telegramId, String username, String firstName, String lastName) {
    static final String LOCAL_USER_ID = "local_user";

    static UserContext local() {
        return new UserContext(LOCAL_USER_ID, "", "local_user", "Grindy", "");
    }
}
