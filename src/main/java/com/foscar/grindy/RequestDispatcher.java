package com.foscar.grindy;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

final class RequestDispatcher {
    private RequestDispatcher() {
    }

    static void handle(HttpExchange exchange, ApiHandler apiHandler, StaticFileHandler staticFileHandler) throws IOException {
        try {
            String path = normalizePath(exchange.getRequestURI().getPath());
            if (path.startsWith("/api/")) {
                apiHandler.handle(exchange, path);
                return;
            }
            staticFileHandler.handle(exchange, path);
        } catch (Exception error) {
            HttpResponses.json(exchange, 500, "{\"message\":\"" + Json.escape(error.getMessage()) + "\"}");
        } finally {
            exchange.close();
        }
    }

    private static String normalizePath(String rawPath) {
        String decoded = URLDecoder.decode(rawPath, StandardCharsets.UTF_8);
        return decoded.isBlank() ? "/" : decoded;
    }
}
