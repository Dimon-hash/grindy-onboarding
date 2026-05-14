package com.foscar.grindy.onboarding;

public record ChoiceSuggestion(String title, String description) {
    public ChoiceSuggestion normalized() {
        return new ChoiceSuggestion(clean(title, "Свой сценарий"), clean(description, "Подходит под твою цель и текущий ритм."));
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
