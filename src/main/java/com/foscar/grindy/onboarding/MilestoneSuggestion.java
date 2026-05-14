package com.foscar.grindy.onboarding;

public record MilestoneSuggestion(String title, String description) {
    public MilestoneSuggestion normalized() {
        return new MilestoneSuggestion(clean(title, "Этап"), clean(description, "Понятный следующий шаг"));
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
