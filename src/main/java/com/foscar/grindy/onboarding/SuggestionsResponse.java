package com.foscar.grindy.onboarding;

import java.util.ArrayList;
import java.util.List;

/**
 * Full AI suggestion payload consumed by the frontend.
 */
public record SuggestionsResponse(
        List<ChoiceSuggestion> experience,
        List<ChoiceSuggestion> conditions,
        List<GoalSuggestion> goals,
        PlanSuggestion plan,
        String source
) {
    public SuggestionsResponse normalized(String sourceOverride) {
        return new SuggestionsResponse(
                limit(experience, 4).stream().map(ChoiceSuggestion::normalized).toList(),
                limit(conditions, 4).stream().map(ChoiceSuggestion::normalized).toList(),
                limit(goals, 3).stream().map(GoalSuggestion::normalized).toList(),
                plan == null ? PlanSuggestion.fallback() : plan.normalized(),
                sourceOverride == null || sourceOverride.isBlank() ? (source == null || source.isBlank() ? "fallback" : source) : sourceOverride
        );
    }

    private static <T> List<T> limit(List<T> items, int size) {
        List<T> clean = new ArrayList<>();
        if (items != null) {
            for (T item : items) {
                if (item != null && clean.size() < size) {
                    clean.add(item);
                }
            }
        }
        return clean;
    }
}
