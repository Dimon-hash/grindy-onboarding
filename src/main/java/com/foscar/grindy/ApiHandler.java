package com.foscar.grindy;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

final class ApiHandler {
    private final Json json;
    private final AuthService authService;
    private final UserStore userStore;
    private final AiSuggestionService aiSuggestionService;

    ApiHandler(Json json, AuthService authService, UserStore userStore, AiSuggestionService aiSuggestionService) {
        this.json = json;
        this.authService = authService;
        this.userStore = userStore;
        this.aiSuggestionService = aiSuggestionService;
    }

    void handle(HttpExchange exchange, String path) throws IOException {
        String method = exchange.getRequestMethod();
        if ("POST".equals(method) && "/api/auth/telegram".equals(path)) {
            AuthRequest request = json.read(exchange.getRequestBody().readAllBytes(), AuthRequest.class);
            UserContext user = authService.fromAuthBody(request);
            UserProfile profile = UserProfile.from(user, userStore.readOnboarding(user.storageId()));
            HttpResponses.json(exchange, 200, json.write(new AuthResponse(user.storageId(), profile)));
            return;
        }
        if ("GET".equals(method) && "/api/me".equals(path)) {
            UserContext user = authService.fromHeader(exchange);
            HttpResponses.json(exchange, 200, json.write(UserProfile.from(user, userStore.readOnboarding(user.storageId()))));
            return;
        }
        if ("PATCH".equals(method) && "/api/me/onboarding".equals(path)) {
            UserContext user = authService.fromHeader(exchange);
            OnboardingData onboarding = json.read(exchange.getRequestBody().readAllBytes(), OnboardingData.class);
            userStore.saveOnboarding(user.storageId(), onboarding);
            HttpResponses.json(exchange, 200, json.write(UserProfile.from(user, userStore.readOnboarding(user.storageId()))));
            return;
        }
        if ("POST".equals(method) && "/api/onboarding/suggestions".equals(path)) {
            UserContext user = authService.fromHeader(exchange);
            OnboardingData onboarding = json.read(exchange.getRequestBody().readAllBytes(), OnboardingData.class);
            SuggestionsResponse suggestions = aiSuggestionService.suggestions(user, onboarding);
            HttpResponses.json(exchange, 200, json.write(suggestions));
            return;
        }
        HttpResponses.json(exchange, 404, "{\"message\":\"Not found\"}");
    }
}
