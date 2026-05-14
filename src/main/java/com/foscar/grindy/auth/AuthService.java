package com.foscar.grindy.auth;

import com.foscar.grindy.config.AppConfig;
import com.sun.net.httpserver.HttpExchange;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AuthService {
    private static final Pattern JSON_STRING_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");
    private static final Pattern JSON_NUMBER_PATTERN = Pattern.compile("\"%s\"\\s*:\\s*(\\d+)");
    private static final String TOKEN_SEPARATOR = ".";
    private final AppConfig config;

    public AuthService(AppConfig config) {
        this.config = config;
    }

    public UserContext fromHeader(HttpExchange exchange) {
        String header = exchange.getRequestHeaders().getFirst("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            UserContext user = userFromToken(header.substring("Bearer ".length()).trim());
            if (!user.storageId().isBlank()) {
                return user;
            }
        }
        if (config.allowLocalAuth()) {
            return UserContext.local();
        }
        throw new AuthException("Unauthorized");
    }

    public UserContext fromAuthBody(AuthRequest request) {
        if (request != null && request.initData() != null && !request.initData().isBlank()) {
            UserContext telegramUser = fromInitData(request.initData());
            if (!telegramUser.storageId().isBlank()) {
                return telegramUser;
            }
        }
        if (config.allowLocalAuth() && request != null && request.username() != null && !request.username().isBlank()) {
            return new UserContext(sanitizeStorageId(request.username()), "", request.username(), "Grindy", "");
        }
        throw new AuthException("Unauthorized");
    }

    public String issueToken(UserContext user) {
        String payload = base64Url(String.join("\n",
                safeTokenPart(user.storageId()),
                safeTokenPart(user.telegramId()),
                safeTokenPart(user.username()),
                safeTokenPart(user.firstName()),
                safeTokenPart(user.lastName())
        ));
        return payload + TOKEN_SEPARATOR + sign(payload);
    }

    private UserContext fromInitData(String initData) {
        Map<String, String> params = parseQuery(initData);
        if (!config.telegramBotToken().isBlank() && !isValidTelegramInitData(params)) {
            throw new AuthException("Invalid Telegram signature");
        }
        if (config.telegramBotToken().isBlank() && !config.allowLocalAuth()) {
            throw new AuthException("Telegram bot token is not configured");
        }
        String userJson = params.getOrDefault("user", "");
        String id = extractJsonNumber(userJson, "id");
        if (id.isBlank()) {
            throw new AuthException("Telegram user is missing");
        }
        String username = extractJsonString(userJson, "username");
        String firstName = extractJsonString(userJson, "first_name");
        String lastName = extractJsonString(userJson, "last_name");
        return new UserContext("tg_" + id, id, username, firstName.isBlank() ? "Grindy" : firstName, lastName);
    }

    private boolean isValidTelegramInitData(Map<String, String> params) {
        String expectedHash = params.getOrDefault("hash", "");
        if (expectedHash.isBlank()) {
            return false;
        }
        TreeMap<String, String> sorted = new TreeMap<>(params);
        sorted.remove("hash");
        StringBuilder checkString = new StringBuilder();
        sorted.forEach((key, value) -> {
            if (!checkString.isEmpty()) {
                checkString.append('\n');
            }
            checkString.append(key).append('=').append(value);
        });
        byte[] secretKey = hmacSha256("WebAppData".getBytes(StandardCharsets.UTF_8), config.telegramBotToken());
        String actualHash = HexFormat.of().formatHex(hmacSha256(secretKey, checkString.toString()));
        return MessageDigest.isEqual(actualHash.getBytes(StandardCharsets.UTF_8), expectedHash.getBytes(StandardCharsets.UTF_8));
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

    public static String sanitizeStorageId(String value) {
        String sanitized = value == null ? "" : value.replaceAll("[^A-Za-z0-9_.-]", "_");
        return sanitized.isBlank() ? UserContext.LOCAL_USER_ID : sanitized;
    }

    private UserContext userFromToken(String token) {
        int separator = token.indexOf(TOKEN_SEPARATOR);
        if (separator < 0) {
            String storageId = config.allowLocalAuth() ? sanitizeStorageId(token) : "";
            return new UserContext(storageId, "", storageId, "Grindy", "");
        }
        String payload = token.substring(0, separator);
        String signature = token.substring(separator + 1);
        if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8), signature.getBytes(StandardCharsets.UTF_8))) {
            return new UserContext("", "", "", "", "");
        }
        String decoded = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
        String[] parts = decoded.split("\\n", -1);
        String storageId = sanitizeStorageId(parts.length > 0 ? parts[0] : "");
        if (parts.length >= 5) {
            return new UserContext(storageId, parts[1], parts[2], parts[3].isBlank() ? "Grindy" : parts[3], parts[4]);
        }
        String telegramId = storageId.startsWith("tg_") ? storageId.substring(3) : "";
        return new UserContext(storageId, telegramId, storageId, "Grindy", "");
    }

    private String sign(String payload) {
        String secret = !config.telegramBotToken().isBlank()
                ? config.telegramBotToken()
                : System.getenv().getOrDefault("GRINDY_TOKEN_SECRET", "grindy-local-token-secret");
        return base64Url(hmacSha256(secret.getBytes(StandardCharsets.UTF_8), payload));
    }

    private String base64Url(String value) {
        return base64Url(value.getBytes(StandardCharsets.UTF_8));
    }

    private String base64Url(byte[] value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private String safeTokenPart(String value) {
        return value == null ? "" : value.replace('\n', ' ').replace('\r', ' ').trim();
    }

    private byte[] hmacSha256(byte[] key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new AuthException("Cannot verify auth signature");
        }
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
