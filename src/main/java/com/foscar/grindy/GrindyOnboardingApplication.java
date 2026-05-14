package com.foscar.grindy;

import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.Executors;

public final class GrindyOnboardingApplication {
    private static final int DEFAULT_PORT = 8080;

    private GrindyOnboardingApplication() {
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", String.valueOf(DEFAULT_PORT)));
        Path dataDir = Path.of(System.getenv().getOrDefault("GRINDY_DATA_DIR", "data"));

        Json json = new Json();
        UserStore userStore = new UserStore(dataDir, json);
        AuthService authService = new AuthService();
        AiSuggestionService aiSuggestionService = new AiSuggestionService(json, userStore);
        ApiHandler apiHandler = new ApiHandler(json, authService, userStore, aiSuggestionService);
        StaticFileHandler staticFileHandler = new StaticFileHandler();

        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/", exchange -> RequestDispatcher.handle(exchange, apiHandler, staticFileHandler));
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();

        System.out.printf(Locale.ROOT, "Grindy onboarding started on http://0.0.0.0:%d%n", port);
    }
}
