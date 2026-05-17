import {resetStoredUiVersion} from "./config.js";
import {normalizeStep} from "./utils.js";

resetStoredUiVersion();

export const state = {
    token: localStorage.getItem("grindy.token"),
    user: null,
    isSplash: true,
    isReady: false,
    isAdvancing: false,
    savingStepId: "",
    pendingSplashTap: false,
    customDrawerStepId: "",
    goalCardFlip: false,
    goalCardFlipDirection: "next",
    goalCardFlipFromIndex: 0,
    planCorrectionOpen: false,
    planDraft: "",
    planChanged: false,
    suggestionsLoading: false,
    suggestionsRequest: null,
    suggestionsKey: "",
    bootError: "",
    suggestions: {
        experience: [],
        conditions: [],
        goals: [],
        plan: null
    },
    choiceTouched: {
        experience: false,
        conditions: false
    },
    choiceSnapshots: {
        experience: [],
        conditions: []
    },
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
