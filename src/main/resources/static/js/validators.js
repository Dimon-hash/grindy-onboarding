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

export function isSavedChoiceValue(value) {
    return /^.+-\d+$/.test(String(value || "").trim());
}

export function choiceTitleFromValue(value) {
    return String(value || "").trim().replace(/-\d+$/, "").trim();
}

export function effectiveOptions(step) {
    const suggestions = state.suggestions && state.suggestions[step.id];
    if (Array.isArray(suggestions) && suggestions.length && suggestionsMatchCurrentGoal()) {
        return suggestions;
    }
    const contextual = contextualOptions(step);
    if (contextual.length) {
        return contextual;
    }
    return step.options || [];
}

function suggestionsMatchCurrentGoal() {
    const savedGoal = (state.suggestionsKey || "").split("|")[0] || "";
    return savedGoal === (state.onboarding.goal || "").trim();
}

function optionTitle(option) {
    if (option && typeof option === "object") {
        return option.title || "";
    }
    return option || "";
}

function contextualOptions(step) {
    if (!step || !["experience", "conditions"].includes(step.id)) {
        return [];
    }
    const goal = compactGoal();
    if (!goal) {
        return [];
    }
    if (step.id === "experience") {
        return [
            {
                title: "Пробовал сам",
                description: `Уже пытался двигаться к цели «${goal}», но без стабильной системы.`
            },
            {
                title: "Были рывки",
                description: "Получалось включаться на короткое время, потом темп проседал."
            },
            {
                title: "Нужен контроль",
                description: "Лучше получается, когда есть план, проверки и понятные шаги."
            },
            {
                title: "Начинаю заново",
                description: `Хочу спокойно собрать новый подход под цель «${goal}».`
            }
        ];
    }
    return [
        {
            title: "Мало времени",
            description: `Нужны короткие действия для цели «${goal}», которые влезут в день.`
        },
        {
            title: "Нужна гибкость",
            description: "План должен учитывать работу, усталость и непредсказуемые дни."
        },
        {
            title: "Есть ограничения",
            description: "Важно учесть здоровье, график, бюджет или поддержку окружения."
        },
        {
            title: "Без перегруза",
            description: "Хочу двигаться регулярно, но без резких скачков и чувства вины."
        }
    ];
}

function compactGoal() {
    const goal = (state.onboarding.goal || "").replace(/\s+/g, " ").trim();
    if (goal.length < 12) {
        return "";
    }
    return goal.length <= 34 ? goal : `${goal.slice(0, 34).trim()}...`;
}
