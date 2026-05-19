package com.foscar.grindy;

import com.foscar.grindy.ai.AiSuggestionService;
import com.foscar.grindy.auth.AuthService;
import com.foscar.grindy.config.AppConfig;
import com.foscar.grindy.http.ApiHandler;
import com.foscar.grindy.http.RequestDispatcher;
import com.foscar.grindy.http.StaticFileHandler;
import com.foscar.grindy.json.Json;
import com.foscar.grindy.user.UserStore;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.Locale;
import java.util.concurrent.Executors;

/**
 * Entry point: wires config, storage, auth, AI suggestions and the built-in HTTP server.
 */
public final class GrindyOnboardingApplication {
    private GrindyOnboardingApplication() {
    }

    public static void main(String[] args) throws IOException {
        AppConfig config = AppConfig.fromEnv();

        Json json = new Json();
        UserStore userStore = new UserStore(config.dataDir(), json);
        AuthService authService = new AuthService(config);
        AiSuggestionService aiSuggestionService = new AiSuggestionService(json, userStore);
        ApiHandler apiHandler = new ApiHandler(json, authService, userStore, aiSuggestionService);
        StaticFileHandler staticFileHandler = new StaticFileHandler();

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", config.port()), 0);
        server.createContext("/", exchange -> RequestDispatcher.handle(exchange, apiHandler, staticFileHandler));
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        System.out.printf(Locale.ROOT, "Grindy onboarding started on http://0.0.0.0:%d%n", config.port());
    }
}
