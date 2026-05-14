import {CUSTOM_VALUE} from "./config.js";
import {state} from "./state.js";

export function canContinue(step) {
    if (!step || step.type === "loader" || step.type === "welcome") {
        return true;
    }
    if (step.type === "textarea") {
        return (state.onboarding.goal || "").trim().length >= step.minLength;
    }
    if (step.id === "experience") {
        const experience = (state.onboarding.experience || "").trim();
        return Boolean(experience) && experience !== CUSTOM_VALUE;
    }
    if (step.id === "conditions") {
        const conditions = (state.onboarding.conditions || "").trim();
        return Boolean(conditions) && conditions !== CUSTOM_VALUE;
    }
    if (step.id === "selectedPlan") {
        return true;
    }
    return Boolean((state.onboarding[step.id] || "").trim());
}

export function choiceOptionValue(step, index) {
    const option = effectiveOptions(step)[index] || "";
    return `${optionTitle(option)}-${index}`;
}

export function isCustomStepValue(step, value) {
    if (!step || !value) {
        return false;
    }
    return !effectiveOptions(step).some((option, index) => value === `${optionTitle(option)}-${index}`);
}

export function effectiveOptions(step) {
    const suggestions = state.suggestions && state.suggestions[step.id];
    if (Array.isArray(suggestions) && suggestions.length) {
        return suggestions;
    }
    return step.options || [];
}

function optionTitle(option) {
    if (option && typeof option === "object") {
        return option.title || "";
    }
    return option || "";
}
