package com.foscar.grindy;

import java.time.Instant;

record UserProfile(
        String id,
        String telegramId,
        String username,
        String firstName,
        String lastName,
        String tariffPlan,
        boolean mentorChatEnabled,
        String createdAt,
        OnboardingData onboarding
) {
    static UserProfile from(UserContext user, OnboardingData onboarding) {
        return new UserProfile(
                user.storageId(),
                user.telegramId(),
                user.username(),
                user.firstName(),
                user.lastName(),
                "TRIAL",
                false,
                Instant.now().toString(),
                onboarding.normalized()
        );
    }
}
