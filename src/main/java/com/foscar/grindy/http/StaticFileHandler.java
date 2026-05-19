package com.foscar.grindy.http;

import com.foscar.grindy.GrindyOnboardingApplication;
import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.InputStream;

/**
 * Serves bundled static assets from src/main/resources/static, including SPA fallback to index.html.
 */
public final class StaticFileHandler {
    public void handle(HttpExchange exchange, String path) throws IOException {
        String resourcePath = path;
        if ("/".equals(resourcePath) || !resourcePath.contains(".")) {
            resourcePath = "/index.html";
        }
        if (resourcePath.contains("..")) {
            HttpResponses.text(exchange, 400, "Bad request");
            return;
        }

        try (InputStream stream = GrindyOnboardingApplication.class.getResourceAsStream("/static" + resourcePath)) {
            if (stream == null) {
                HttpResponses.text(exchange, 404, "Not found");
                return;
            }
            HttpResponses.send(exchange, 200, contentType(resourcePath), stream.readAllBytes());
        }
    }

    private String contentType(String path) {
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
}
