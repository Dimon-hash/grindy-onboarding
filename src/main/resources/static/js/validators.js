import {CUSTOM_VALUE} from "./config.js";
import {currentSuggestionsKey, state} from "./state.js";

export function canContinue(step) {
    if (!step || step.type === "loader" || step.type === "welcome") {
        return true;
    }
    if (step.type === "textarea") {
        return (state.onboarding.goal || "").length >= step.minLength;
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
    if (!step) {
        return [];
    }
    const snapshot = state.choiceSnapshots && state.choiceSnapshots[step.id];
    // После выбора фиксируем текущие варианты, чтобы пришедший позже AI-ответ не заменил выбранную карточку.
    if (state.choiceTouched && state.choiceTouched[step.id] && Array.isArray(snapshot) && snapshot.length) {
        return snapshot;
    }
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
    return state.suggestionsKey === currentSuggestionsKey();
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
                title: "Начинаю с нуля",
                description: "Пока нет системы, нужен простой старт и первые понятные действия."
            },
            {
                title: "Были рывки",
                description: "Пробовал начинать, но не хватало стабильности и проверки прогресса."
            },
            {
                title: "Есть рабочий опыт",
                description: "Уже знаю, что помогает, нужно собрать это в регулярный план."
            },
            {
                title: "Нужна поддержка",
                description: "Лучше двигаюсь, когда есть подсказки, обратная связь и контроль."
            }
        ];
    }
    return [
        {
            title: "Мало времени",
            description: "Нужны короткие шаги по 10-20 минут, которые реально влезут в день."
        },
        {
            title: "Нужна гибкость",
            description: "План должен иметь запасной вариант для усталости и срывов графика."
        },
        {
            title: "Есть ограничения",
            description: "Важно учесть бюджет, здоровье, окружение, расстояние или расписание."
        },
        {
            title: "Нужна среда",
            description: "Помогут люди, места, напоминания и заранее подготовленные условия."
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
