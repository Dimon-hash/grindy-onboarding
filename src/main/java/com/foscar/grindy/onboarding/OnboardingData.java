package com.foscar.grindy.onboarding;

public record OnboardingData(String goal, String experience, String conditions, String selectedGoal, String selectedPlan) {
    public static OnboardingData empty() {
        return new OnboardingData("", "", "", "", "");
    }

    public OnboardingData normalized() {
        return new OnboardingData(clean(goal), clean(experience), clean(conditions), clean(selectedGoal), clean(selectedPlan));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
