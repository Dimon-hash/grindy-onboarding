package com.foscar.grindy;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.Executors;

public final class GrindyOnboardingApplication {
    private static final int DEFAULT_PORT = 8080;
    private static final String LOCAL_USER_ID = "local_user";
    private static final Path DATA_DIR = Path.of(System.getenv().getOrDefault("GRINDY_DATA_DIR", "data"));
    private static final Path USERS_DIR = DATA_DIR.resolve("users");
    private static final Pattern JSON_STRING_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
    private static final Pattern JSON_NUMBER_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*(\\d+)");

    private GrindyOnboardingApplication() {
    }

    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", String.valueOf(DEFAULT_PORT)));
        HttpServer server = HttpServer.create(new InetSocketAddress("0.0.0.0", port), 0);
        server.createContext("/", GrindyOnboardingApplication::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.printf(Locale.ROOT, "Grindy onboarding started on http://0.0.0.0:%d%n", port);
    }

    private static void handle(HttpExchange exchange) throws IOException {
        try {
            String path = normalizePath(exchange.getRequestURI().getPath());
            if (path.startsWith("/api/")) {
                handleApi(exchange, path);
                return;
            }
            serveStatic(exchange, path);
        } catch (Exception error) {
            byte[] body = json("{\"message\":\"" + escapeJson(error.getMessage()) + "\"}");
            send(exchange, 500, "application/json; charset=utf-8", body);
        } finally {
            exchange.close();
        }
    }

    private static void handleApi(HttpExchange exchange, String path) throws IOException {
        String method = exchange.getRequestMethod();
        if ("POST".equals(method) && "/api/auth/telegram".equals(path)) {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            UserContext user = userFromAuthBody(body);
            send(exchange, 200, "application/json; charset=utf-8", authResponse(user));
            return;
        }
        if ("GET".equals(method) && "/api/me".equals(path)) {
            UserContext user = userFromAuthHeader(exchange);
            send(exchange, 200, "application/json; charset=utf-8", userResponse(user));
            return;
        }
        if ("PATCH".equals(method) && "/api/me/onboarding".equals(path)) {
            UserContext user = userFromAuthHeader(exchange);
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            Files.createDirectories(USERS_DIR);
            Files.writeString(onboardingPath(user.storageId()), body, StandardCharsets.UTF_8);
            send(exchange, 200, "application/json; charset=utf-8", userResponse(user));
            return;
        }
        send(exchange, 404, "application/json; charset=utf-8", json("{\"message\":\"Not found\"}"));
    }

    private static byte[] authResponse(UserContext user) throws IOException {
        String profile = new String(userResponse(user), StandardCharsets.UTF_8);
        String body = "{\"token\":\"" + escapeJson(user.storageId()) + "\",\"user\":" + profile + "}";
        return json(body);
    }

    private static byte[] userResponse(UserContext user) throws IOException {
        String onboarding = readOnboarding(user.storageId());
        String body = """
                {
                  "id": "%s",
                  "telegramId": "%s",
                  "username": "%s",
                  "firstName": "%s",
                  "lastName": "%s",
                  "tariffPlan": "TRIAL",
                  "mentorChatEnabled": false,
                  "createdAt": "%s",
                  "onboarding": %s
                }
                """.formatted(
                escapeJson(user.storageId()),
                escapeJson(user.telegramId()),
                escapeJson(user.username()),
                escapeJson(user.firstName()),
                escapeJson(user.lastName()),
                Instant.now(),
                onboarding
        );
        return json(body);
    }

    private static UserContext userFromAuthHeader(HttpExchange exchange) {
        String header = exchange.getRequestHeaders().getFirst("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String storageId = sanitizeStorageId(header.substring("Bearer ".length()).trim());
            if (!storageId.isBlank()) {
                String telegramId = storageId.startsWith("tg_") ? storageId.substring(3) : "";
                return new UserContext(storageId, telegramId, "", "Grindy", "");
            }
        }
        return UserContext.local();
    }

    private static UserContext userFromAuthBody(String body) {
        String initData = extractJsonString(body, "initData");
        if (!initData.isBlank()) {
            UserContext telegramUser = userFromInitData(initData);
            if (!telegramUser.storageId().isBlank()) {
                return telegramUser;
            }
        }
        String username = extractJsonString(body, "username");
        if (!username.isBlank()) {
            return new UserContext(sanitizeStorageId(username), "", username, "Grindy", "");
        }
        return UserContext.local();
    }

    private static UserContext userFromInitData(String initData) {
        Map<String, String> params = parseQuery(initData);
        String userJson = params.getOrDefault("user", "");
        String id = extractJsonNumber(userJson, "id");
        if (id.isBlank()) {
            return UserContext.local();
        }
        String username = extractJsonString(userJson, "username");
        String firstName = extractJsonString(userJson, "first_name");
        String lastName = extractJsonString(userJson, "last_name");
        return new UserContext("tg_" + id, id, username, firstName.isBlank() ? "Grindy" : firstName, lastName);
    }

    private static Map<String, String> parseQuery(String query) {
        Map<String, String> values = new HashMap<>();
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = decode(pair.substring(0, separator));
            String value = decode(pair.substring(separator + 1));
            values.put(key, value);
        }
        return values;
    }

    private static String readOnboarding(String storageId) throws IOException {
        Path userFile = onboardingPath(storageId);
        if (Files.exists(userFile)) {
            String saved = Files.readString(userFile, StandardCharsets.UTF_8).trim();
            if (saved.startsWith("{") && saved.endsWith("}")) {
                return saved;
            }
        }
        return """
                {
                  "goal": "",
                  "experience": "",
                  "conditions": "",
                  "selectedGoal": "",
                  "selectedPlan": ""
                }
                """;
    }

    private static Path onboardingPath(String storageId) {
        return USERS_DIR.resolve(sanitizeStorageId(storageId) + ".json");
    }

    private static void serveStatic(HttpExchange exchange, String path) throws IOException {
        String resourcePath = path;
        if ("/".equals(resourcePath) || !resourcePath.contains(".")) {
            resourcePath = "/index.html";
        }
        if (resourcePath.contains("..")) {
            send(exchange, 400, "text/plain; charset=utf-8", "Bad request".getBytes(StandardCharsets.UTF_8));
            return;
        }

        try (InputStream stream = GrindyOnboardingApplication.class.getResourceAsStream("/static" + resourcePath)) {
            if (stream == null) {
                send(exchange, 404, "text/plain; charset=utf-8", "Not found".getBytes(StandardCharsets.UTF_8));
                return;
            }
            byte[] bytes = stream.readAllBytes();
            send(exchange, 200, contentType(resourcePath), bytes);
        }
    }

    private static void send(HttpExchange exchange, int status, String contentType, byte[] body) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", contentType);
        headers.set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(body);
        }
    }

    private static String contentType(String path) {
        if (path.endsWith(".css")) {
            return "text/css; charset=utf-8";
        }
        if (path.endsWith(".js")) {
            return "application/javascript; charset=utf-8";
        }
        if (path.endsWith(".svg")) {
            return "image/svg+xml; charset=utf-8";
        }
        return "text/html; charset=utf-8";
    }

    private static String normalizePath(String rawPath) {
        String decoded = URLDecoder.decode(rawPath, StandardCharsets.UTF_8);
        return decoded.isBlank() ? "/" : decoded;
    }

    private static String extractJsonString(String json, String key) {
        Pattern pattern = Pattern.compile(JSON_STRING_PATTERN.pattern().formatted(Pattern.quote(key)));
        Matcher matcher = pattern.matcher(json == null ? "" : json);
        return matcher.find() ? unescapeJson(matcher.group(1)) : "";
    }

    private static String extractJsonNumber(String json, String key) {
        Pattern pattern = Pattern.compile(JSON_NUMBER_PATTERN.pattern().formatted(Pattern.quote(key)));
        Matcher matcher = pattern.matcher(json == null ? "" : json);
        return matcher.find() ? matcher.group(1) : "";
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static byte[] json(String body) {
        return body.getBytes(StandardCharsets.UTF_8);
    }

    private static String sanitizeStorageId(String value) {
        String sanitized = value == null ? "" : value.replaceAll("[^A-Za-z0-9_.-]", "_");
        return sanitized.isBlank() ? LOCAL_USER_ID : sanitized;
    }

    private static String escapeJson(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String unescapeJson(String value) {
        if (value == null || value.indexOf('\\') < 0) {
            return value == null ? "" : value;
        }
        StringBuilder result = new StringBuilder(value.length());
        boolean escaping = false;
        for (int index = 0; index < value.length(); index++) {
            char symbol = value.charAt(index);
            if (!escaping) {
                if (symbol == '\\') {
                    escaping = true;
                } else {
                    result.append(symbol);
                }
                continue;
            }
            result.append(switch (symbol) {
                case '"', '\\', '/' -> symbol;
                case 'b' -> '\b';
                case 'f' -> '\f';
                case 'n' -> '\n';
                case 'r' -> '\r';
                case 't' -> '\t';
                default -> symbol;
            });
            escaping = false;
        }
        return result.toString();
    }

    private record UserContext(String storageId, String telegramId, String username, String firstName, String lastName) {
        private static UserContext local() {
            return new UserContext(LOCAL_USER_ID, "", "local_user", "Grindy", "");
        }
    }
}
