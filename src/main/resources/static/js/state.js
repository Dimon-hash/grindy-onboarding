import {resetStoredUiVersion} from "./config.js";
import {normalizeStep} from "./utils.js";

// Shared mutable UI state for the whole onboarding flow.
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
    // Сколько дополнительных уточняющих раундов уже прошёл пользователь на карточках.
    choiceDepth: {
        experience: 0,
        conditions: 0
    },
    // История выбранных ответов нужна ИИ, чтобы следующий набор вариантов углублял контекст, а не повторялся.
    choiceHistory: {
        experience: [],
        conditions: []
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
        experienceHistory: "",
        conditionsHistory: "",
        selectedGoal: "",
        selectedPlan: ""
    }
};

export const nodes = {
    app: document.getElementById("app"),
    onboardingWizard: document.getElementById("onboarding-wizard")
};

// Единый ключ контекста: если он не менялся, можно не перегенерировать AI-подсказки.
export function currentSuggestionsKey() {
    return [
        state.onboarding.goal || "",
        state.onboarding.experienceHistory || "",
        state.onboarding.conditionsHistory || "",
        state.onboarding.selectedGoal || "",
        state.onboarding.selectedPlan || ""
    ].map((value) => String(value || "").trim()).join("|");
}
