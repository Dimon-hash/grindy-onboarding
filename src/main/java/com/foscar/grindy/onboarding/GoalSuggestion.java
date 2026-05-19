package com.foscar.grindy.onboarding;

import java.util.List;

/**
 * One generated goal card shown in the final goal carousel.
 */
public record GoalSuggestion(String duration, String title, String description, List<String> bullets, String accent) {
    public GoalSuggestion normalized() {
        return new GoalSuggestion(
                clean(duration, "3 месяца", 18),
                clean(title, "Дойти до цели", 34),
                clean(description, "Понятная цель с реалистичным темпом и регулярными действиями.", 112),
                bullets == null || bullets.isEmpty()
                        ? List.of("Без резких перегрузок", "С понятными шагами", "С еженедельной проверкой")
                        : bullets.stream().limit(4).map((item) -> clean(item, "", 38)).filter(item -> !item.isBlank()).toList(),
                cleanAccent(accent)
        );
    }

    private static String clean(String value, String fallback, int limit) {
        String clean = value == null ? "" : value.trim();
        if (clean.isBlank()) {
            return fallback;
        }
        return clean.length() <= limit ? clean : clean.substring(0, limit);
    }

    private static String cleanAccent(String value) {
        String clean = value == null ? "" : value.trim();
        return switch (clean) {
            case "orange", "green" -> clean;
            default -> "blue";
        };
    }
}
