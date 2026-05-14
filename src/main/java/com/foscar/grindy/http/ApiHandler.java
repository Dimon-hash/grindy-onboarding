package com.foscar.grindy.http;

import com.foscar.grindy.ai.AiSuggestionService;
import com.foscar.grindy.auth.AuthRequest;
import com.foscar.grindy.auth.AuthResponse;
import com.foscar.grindy.auth.AuthService;
import com.foscar.grindy.auth.UserContext;
import com.foscar.grindy.json.Json;
import com.foscar.grindy.onboarding.OnboardingData;
import com.foscar.grindy.onboarding.SuggestionsResponse;
import com.foscar.grindy.user.UserProfile;
import com.foscar.grindy.user.UserStore;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;

public final class ApiHandler {
    private final Json json;
    private final AuthService authService;
    private final UserStore userStore;
    private final AiSuggestionService aiSuggestionService;
    private final RateLimiter aiRateLimiter = new RateLimiter(30, 60);

    public ApiHandler(Json json, AuthService authService, UserStore userStore, AiSuggestionService aiSuggestionService) {
        this.json = json;
        this.authService = authService;
        this.userStore = userStore;
        this.aiSuggestionService = aiSuggestionService;
    }

    public void handle(HttpExchange exchange, String path) throws IOException {
        String method = exchange.getRequestMethod();
        if ("GET".equals(method) && "/api/health".equals(path)) {
            HttpResponses.json(exchange, 200, "{\"status\":\"ok\"}");
            return;
        }
        if ("POST".equals(method) && "/api/auth/telegram".equals(path)) {
            AuthRequest request = json.read(exchange.getRequestBody().readAllBytes(), AuthRequest.class);
            UserContext user = authService.fromAuthBody(request);
            UserProfile profile = UserProfile.from(user, userStore.readOnboarding(user.storageId()));
            HttpResponses.json(exchange, 200, json.write(new AuthResponse(authService.issueToken(user), profile)));
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
            if (!aiRateLimiter.allow(exchange)) {
                HttpResponses.json(exchange, 429, "{\"message\":\"Too many requests\"}");
                return;
            }
            UserContext user = authService.fromHeader(exchange);
            OnboardingData onboarding = json.read(exchange.getRequestBody().readAllBytes(), OnboardingData.class);
            SuggestionsResponse suggestions = aiSuggestionService.suggestions(user, onboarding);
            HttpResponses.json(exchange, 200, json.write(suggestions));
            return;
        }
        HttpResponses.json(exchange, 404, "{\"message\":\"Not found\"}");
    }
}
