package com.foscar.grindy;

record OnboardingData(String goal, String experience, String conditions, String selectedGoal, String selectedPlan) {
    static OnboardingData empty() {
        return new OnboardingData("", "", "", "", "");
    }

    OnboardingData normalized() {
        return new OnboardingData(clean(goal), clean(experience), clean(conditions), clean(selectedGoal), clean(selectedPlan));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
