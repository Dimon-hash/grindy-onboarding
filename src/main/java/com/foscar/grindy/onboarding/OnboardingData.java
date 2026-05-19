package com.foscar.grindy.onboarding;

/**
 * Persisted onboarding answers; history fields store the multi-round choices used for AI personalization.
 */
public record OnboardingData(
        String goal,
        String experience,
        String conditions,
        String experienceHistory,
        String conditionsHistory,
        String selectedGoal,
        String selectedPlan
) {
    public static OnboardingData empty() {
        return new OnboardingData("", "", "", "", "", "", "");
    }

    public OnboardingData normalized() {
        return new OnboardingData(
                clean(goal, 500),
                clean(experience, 320),
                clean(conditions, 320),
                clean(experienceHistory, 500),
                clean(conditionsHistory, 500),
                clean(selectedGoal, 180),
                clean(selectedPlan, 500)
        );
    }

    private static String clean(String value, int limit) {
        String clean = value == null ? "" : value.trim();
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }
}
