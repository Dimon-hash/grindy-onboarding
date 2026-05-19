package com.foscar.grindy.user;

import com.foscar.grindy.auth.UserContext;
import com.foscar.grindy.onboarding.OnboardingData;

import java.time.Instant;

/**
 * Profile shape returned to the mini app after auth and onboarding saves.
 */
public record UserProfile(
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
    public static UserProfile from(UserContext user, OnboardingData onboarding) {
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
