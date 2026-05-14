package com.foscar.grindy.user;

import com.foscar.grindy.auth.AuthService;
import com.foscar.grindy.json.Json;
import com.foscar.grindy.onboarding.CachedSuggestions;
import com.foscar.grindy.onboarding.OnboardingData;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class UserStore {
    private final Path usersDir;
    private final Json json;

    public UserStore(Path dataDir, Json json) {
        this.usersDir = dataDir.resolve("users");
        this.json = json;
    }

    public OnboardingData readOnboarding(String storageId) throws IOException {
        Path userFile = onboardingPath(storageId);
        if (Files.exists(userFile)) {
            String saved = Files.readString(userFile, StandardCharsets.UTF_8).trim();
            if (saved.startsWith("{") && saved.endsWith("}")) {
                return json.read(saved, OnboardingData.class).normalized();
            }
        }
        return OnboardingData.empty();
    }

    public void saveOnboarding(String storageId, OnboardingData onboarding) throws IOException {
        Files.createDirectories(usersDir);
        Files.writeString(onboardingPath(storageId), json.write(onboarding.normalized()), StandardCharsets.UTF_8);
    }

    public CachedSuggestions readSuggestions(String storageId) throws IOException {
        Path file = suggestionsPath(storageId);
        if (!Files.exists(file)) {
            return null;
        }
        String saved = Files.readString(file, StandardCharsets.UTF_8).trim();
        if (!saved.startsWith("{") || !saved.endsWith("}")) {
            return null;
        }
        return json.read(saved, CachedSuggestions.class);
    }

    public void saveSuggestions(String storageId, CachedSuggestions suggestions) throws IOException {
        Files.createDirectories(usersDir);
        Files.writeString(suggestionsPath(storageId), json.write(suggestions), StandardCharsets.UTF_8);
    }

    private Path onboardingPath(String storageId) {
        return usersDir.resolve(AuthService.sanitizeStorageId(storageId) + ".json");
    }

    private Path suggestionsPath(String storageId) {
        return usersDir.resolve(AuthService.sanitizeStorageId(storageId) + ".suggestions.json");
    }
}
