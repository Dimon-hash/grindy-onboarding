package com.foscar.grindy;

import com.sun.net.httpserver.HttpExchange;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class AuthService {
    private static final Pattern JSON_STRING_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
    private static final Pattern JSON_NUMBER_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*(\\d+)");

    UserContext fromHeader(HttpExchange exchange) {
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

    UserContext fromAuthBody(AuthRequest request) {
        if (request != null && request.initData() != null && !request.initData().isBlank()) {
            UserContext telegramUser = fromInitData(request.initData());
            if (!telegramUser.storageId().isBlank()) {
                return telegramUser;
            }
        }
        if (request != null && request.username() != null && !request.username().isBlank()) {
            return new UserContext(sanitizeStorageId(request.username()), "", request.username(), "Grindy", "");
        }
        return UserContext.local();
    }

    private UserContext fromInitData(String initData) {
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

    private Map<String, String> parseQuery(String query) {
        Map<String, String> values = new HashMap<>();
        for (String pair : query.split("&")) {
            int separator = pair.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = URLDecoder.decode(pair.substring(0, separator), StandardCharsets.UTF_8);
            String value = URLDecoder.decode(pair.substring(separator + 1), StandardCharsets.UTF_8);
            values.put(key, value);
        }
        return values;
    }

    static String sanitizeStorageId(String value) {
        String sanitized = value == null ? "" : value.replaceAll("[^A-Za-z0-9_.-]", "_");
        return sanitized.isBlank() ? UserContext.LOCAL_USER_ID : sanitized;
    }

    private String extractJsonString(String json, String key) {
        Pattern pattern = Pattern.compile(JSON_STRING_PATTERN.pattern().formatted(Pattern.quote(key)));
        Matcher matcher = pattern.matcher(json == null ? "" : json);
        return matcher.find() ? unescapeJson(matcher.group(1)) : "";
    }

    private String extractJsonNumber(String json, String key) {
        Pattern pattern = Pattern.compile(JSON_NUMBER_PATTERN.pattern().formatted(Pattern.quote(key)));
        Matcher matcher = pattern.matcher(json == null ? "" : json);
        return matcher.find() ? matcher.group(1) : "";
    }

    private String unescapeJson(String value) {
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
}
