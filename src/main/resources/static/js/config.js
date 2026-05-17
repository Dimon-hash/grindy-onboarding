export const CUSTOM_VALUE = "__custom__";
export const APP_VERSION = "20260517-reset-onboarding";

export function resetStoredUiVersion() {
    if (localStorage.getItem("grindy.uiVersion") === APP_VERSION) {
        return;
    }
    localStorage.removeItem("grindy.token");
    localStorage.removeItem("grindy.step");
    localStorage.removeItem("grindy.onboardingComplete");
    localStorage.setItem("grindy.uiVersion", APP_VERSION);
}
