package com.foscar.grindy.onboarding;

/**
 * One selectable card for experience/conditions steps.
 */
public record ChoiceSuggestion(String title, String description) {
    public ChoiceSuggestion normalized() {
        return new ChoiceSuggestion(
                clean(title, "Свой сценарий", 32),
                clean(description, "Подходит под твою цель и текущий ритм.", 96)
        );
    }

    private static String clean(String value, String fallback, int limit) {
        String clean = value == null ? "" : value.trim();
        if (clean.isBlank()) {
            return fallback;
        }
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }
}
