import {state} from "./state.js";

// Browser API client used by the static mini app.
export class ApiError extends Error {
    constructor(status, body) {
        super(body || `Request failed with status ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

export async function authenticate(payload) {
    const auth = await api("/api/auth/telegram", {method: "POST", body: payload, auth: false});
    state.token = auth.token;
    state.user = auth.user;
    localStorage.setItem("grindy.token", state.token);
}

export async function saveOnboarding() {
    state.user = await api("/api/me/onboarding", {
        method: "PATCH",
        body: state.onboarding
    });
}

export async function loadCurrentUser() {
    state.user = await api("/api/me");
}

export async function loadOnboardingSuggestions() {
    return api("/api/onboarding/suggestions", {
        method: "POST",
        timeoutMs: 15000,
        body: {
            ...state.onboarding,
            // В UI значения хранятся как "Название-0", а модели нужен чистый человеческий текст.
            experience: readableChoiceValue(state.onboarding.experience),
            conditions: readableChoiceValue(state.onboarding.conditions),
            selectedGoal: readableChoiceValue(state.onboarding.selectedGoal),
            experienceHistory: state.onboarding.experienceHistory || state.choiceHistory.experience.join(" | "),
            conditionsHistory: state.onboarding.conditionsHistory || state.choiceHistory.conditions.join(" | ")
        }
    });
}

function readableChoiceValue(value) {
    return String(value || "").trim().replace(/-\d+$/, "").trim();
}

export async function api(path, options = {}) {
    const headers = options.headers ? {...options.headers} : {};
    const timeoutMs = Number(options.timeoutMs || 0);
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeout = controller
        ? window.setTimeout(() => controller.abort(new Error("Request timeout")), timeoutMs)
        : null;
    if (options.auth !== false && state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    let response;
    try {
        response = await fetch(path, {
            method: options.method || "GET",
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            signal: controller ? controller.signal : undefined
        });
    } finally {
        if (timeout) {
            window.clearTimeout(timeout);
        }
    }
    if (!response.ok) {
        throw new ApiError(response.status, await response.text());
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}
