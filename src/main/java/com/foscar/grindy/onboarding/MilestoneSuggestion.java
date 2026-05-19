package com.foscar.grindy.onboarding;

public record MilestoneSuggestion(String title, String description) {
    public MilestoneSuggestion normalized() {
        return new MilestoneSuggestion(clean(title, "Этап", 40), clean(description, "Понятный следующий шаг", 170));
    }

    private static String clean(String value, String fallback, int limit) {
        String clean = value == null ? "" : value.trim();
        if (clean.isBlank()) {
            return fallback;
        }
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }
}
