package com.foscar.grindy;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

final class Json {
    private final ObjectMapper mapper;

    Json() {
        mapper = new ObjectMapper()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    <T> T read(String value, Class<T> type) throws JsonProcessingException {
        return mapper.readValue(value == null || value.isBlank() ? "{}" : value, type);
    }

    <T> T read(byte[] value, Class<T> type) throws IOException {
        return read(new String(value, StandardCharsets.UTF_8), type);
    }

    JsonNode tree(String value) throws JsonProcessingException {
        return mapper.readTree(value);
    }

    String write(Object value) throws JsonProcessingException {
        return mapper.writeValueAsString(value);
    }

    static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
