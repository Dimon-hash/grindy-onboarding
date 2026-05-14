package com.foscar.grindy.onboarding;

import java.util.List;

public record GoalSuggestion(String duration, String title, String description, List<String> bullets, String accent) {
    public GoalSuggestion normalized() {
        return new GoalSuggestion(
                clean(duration, "3 месяца"),
                clean(title, "Дойти до цели"),
                clean(description, "Понятная цель с реалистичным темпом и регулярными действиями."),
                bullets == null || bullets.isEmpty()
                        ? List.of("Без резких перегрузок", "С понятными шагами", "С еженедельной проверкой")
                        : bullets.stream().limit(4).map(String::trim).filter(item -> !item.isBlank()).toList(),
                clean(accent, "blue")
        );
    }

    private static String clean(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
