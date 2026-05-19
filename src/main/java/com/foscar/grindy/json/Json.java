package com.foscar.grindy.json;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Small Jackson wrapper so JSON parsing/serialization settings stay in one place.
 */
public final class Json {
    private final ObjectMapper mapper;

    public Json() {
        mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    public <T> T read(String value, Class<T> type) throws JsonProcessingException {
        return mapper.readValue(value == null || value.isBlank() ? "{}" : value, type);
    }

    public <T> T read(byte[] value, Class<T> type) throws IOException {
        return read(new String(value, StandardCharsets.UTF_8), type);
    }

    public JsonNode tree(String value) throws JsonProcessingException {
        return mapper.readTree(value);
    }

    public String write(Object value) throws JsonProcessingException {
        return mapper.writeValueAsString(value);
    }

    public static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
