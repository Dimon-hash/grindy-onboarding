package com.foscar.grindy.http;

import com.sun.net.httpserver.HttpExchange;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tiny in-memory limiter that protects the AI endpoint from repeated rapid requests.
 */
final class RateLimiter {
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final int maxRequests;
    private final long windowSeconds;

    RateLimiter(int maxRequests, long windowSeconds) {
        this.maxRequests = maxRequests;
        this.windowSeconds = windowSeconds;
    }

    boolean allow(HttpExchange exchange) {
        String key = clientKey(exchange);
        long now = Instant.now().getEpochSecond();
        Bucket bucket = buckets.compute(key, (ignored, current) -> {
            if (current == null || now - current.windowStart >= windowSeconds) {
                return new Bucket(now, 1);
            }
            return new Bucket(current.windowStart, current.count + 1);
        });
        return bucket.count <= maxRequests;
    }

    private String clientKey(HttpExchange exchange) {
        String forwardedFor = exchange.getRequestHeaders().getFirst("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return exchange.getRemoteAddress().getAddress().getHostAddress();
    }

    private record Bucket(long windowStart, int count) {
    }
}
