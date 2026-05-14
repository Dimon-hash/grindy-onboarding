import {resetStoredUiVersion} from "./config.js";
import {normalizeStep} from "./utils.js";

resetStoredUiVersion();

export const state = {
    token: localStorage.getItem("grindy.token"),
    user: null,
    isSplash: true,
    isReady: false,
    savingStepId: "",
    pendingSplashTap: false,
    customDrawerStepId: "",
    customDrafts: {
        experience: "",
        conditions: ""
    },
    customPreviousValues: {
        experience: "",
        conditions: ""
    },
    onboardingStep: normalizeStep(Number(localStorage.getItem("grindy.step") || 1)),
    onboarding: {
        goal: "",
        experience: "",
        conditions: "",
        selectedGoal: "",
        selectedPlan: ""
    }
};

export const nodes = {
    app: document.getElementById("app"),
    onboardingWizard: document.getElementById("onboarding-wizard")
};
