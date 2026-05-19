package com.foscar.grindy.onboarding;

/**
 * Cached AI result plus the fingerprint of the onboarding context that produced it.
 */
public record CachedSuggestions(String fingerprint, SuggestionsResponse suggestions) {
}
