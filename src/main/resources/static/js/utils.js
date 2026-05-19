// Small shared helpers used by rendering, navigation and safe HTML output.
export function normalizeStep(step) {
    if (!Number.isFinite(step) || step < 1) {
        return 1;
    }
    return Math.trunc(step);
}

export function wait(delay) {
    return new Promise((resolve) => window.setTimeout(resolve, delay));
}

export function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function escapeAttr(value) {
    return escapeHtml(value);
}
