import {CUSTOM_VALUE} from "./config.js";
import {state} from "./state.js";
import {canContinue, choiceOptionValue, effectiveOptions, isCustomStepValue} from "./validators.js";
import {escapeAttr, escapeHtml} from "./utils.js";

export function renderStep(step) {
    if (step.type === "loader") {
        return `
            <img class="loader-art" src="/loader.svg?v=20260514-no-top-buttons" alt="GRINDY">
        `;
    }
    if (step.type === "welcome") {
        return `
            <img class="screen-art" src="/welcome-screen.svg?v=20260514-no-top-buttons" alt="Преврати цель в систему">
            <button id="next" class="welcome-hit-area" type="button" aria-label="Начать"></button>
        `;
    }
    if (step.id === "goal") {
        return goalStep(step);
    }
    if (step.id === "experience") {
        return nativeChoiceStep(step);
    }
    if (step.id === "conditions") {
        return nativeChoiceStep(step);
    }
    if (step.id === "selectedGoal") {
        return chooseGoalStep(step);
    }
    if (step.id === "selectedPlan") {
        return yourPlanStep(step);
    }
    return genericStep(step);
}

function genericStep(step) {
    return `
        <header class="question-header">
            <button id="back" class="nav-button ${state.onboardingStep === 2 ? "is-close" : ""}" type="button" aria-label="Назад"></button>
            <div class="progress"><span style="width: ${step.progress}px"></span></div>
        </header>
        <section class="question-copy">
            <h1>${escapeHtml(step.title)}</h1>
            <p>${escapeHtml(step.subtitle)}</p>
        </section>
        ${step.type === "textarea" ? textareaStep(step) : choiceStep(step)}
        <footer class="actions">
            ${step.custom ? `<button id="custom" class="secondary-button ${state.onboarding[step.id] === CUSTOM_VALUE ? "is-selected" : ""}" type="button">Свой вариант</button>` : ""}
            <button id="next" class="primary-button" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
        </footer>
    `;
}

function chooseGoalStep(step) {
    const goals = goalOptions(step);
    if (!state.onboarding.selectedGoal || !goals.some((goal, index) => goalValue(goal, index) === state.onboarding.selectedGoal)) {
        state.onboarding.selectedGoal = goalValue(goals[0], 0);
    }
    const selected = state.onboarding.selectedGoal;
    const selectedIndex = Math.max(0, goals.findIndex((goal, index) => goalValue(goal, index) === selected));
    const selectedGoal = goals[selectedIndex] || goals[0];
    const art = [
        "/Choose%20the%20Goal.svg?v=20260514-no-top-buttons",
        "/Choose%20the%20Goal-2.svg?v=20260514-no-top-buttons",
        "/Choose%20the%20Goal-3.svg?v=20260514-no-top-buttons"
    ][selectedIndex] || "/Choose%20the%20Goal.svg?v=20260514-no-top-buttons";

    return `
        <div class="choose-goal-stage ${state.goalCardFlip ? "is-flipping" : ""}">
            <img class="screen-art choose-goal-art" src="${art}" alt="${escapeAttr(step.title)}">
            <span class="choose-goal-flip-card" aria-hidden="true">
                <img src="${art}" alt="">
            </span>
            ${goalCardOverlay(selectedGoal, selectedIndex)}
        </div>
        <button id="back" class="choose-goal-back-hit-area" type="button" aria-label="Назад"></button>
        <button
            class="choose-goal-card-hit-area"
            type="button"
            data-direction="next"
            aria-label="Показать следующую цель"></button>
        <section class="choose-goal-selector" aria-label="${escapeAttr(step.title)}">
            ${goals.map((goal, index) => `
                <button
                    class="choose-goal-dot choose-goal-dot-${index + 1} ${selected === goalValue(goal, index) ? "is-selected" : ""}"
                    type="button"
                    data-value="${escapeAttr(goalValue(goal, index))}"
                    aria-label="Вариант цели ${index + 1}"
                    aria-pressed="${selected === goalValue(goal, index) ? "true" : "false"}"></button>
            `).join("")}
        </section>
        <button id="next" class="choose-goal-next-hit-area" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
    `;
}

function yourPlanStep(step) {
    if (!state.onboarding.selectedPlan) {
        state.onboarding.selectedPlan = "default-plan";
    }
    if (state.planCorrectionOpen) {
        return planCorrectionStep(step);
    }
    const hasEditedPlan = state.planChanged || (state.onboarding.selectedPlan && state.onboarding.selectedPlan !== "default-plan");
    const art = hasEditedPlan
        ? "/Your%20Plan,%20Plan%20Changed.svg?v=20260514-no-top-buttons"
        : "/Your%20Plan.svg?v=20260514-no-top-buttons";
    return `
        <div class="your-plan-scroll">
            <img class="your-plan-art" src="${art}" alt="${escapeAttr(step.title)}">
            ${planOverlay(state.suggestions.plan)}
            <span class="your-plan-scroll-spacer" aria-hidden="true"></span>
        </div>
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="change-plan" class="your-plan-change-hit-area" type="button" aria-label="Скорректировать план"></button>
        <button id="next" class="your-plan-next-hit-area" type="button">${escapeHtml(step.button)}</button>
    `;
}

function planCorrectionStep(step) {
    const draft = state.planDraft || "";
    const filled = Boolean(draft.trim());
    const art = filled
        ? "/Your%20Plan,%20Change%20the%20plan,%20Filled.svg?v=20260514-no-top-buttons"
        : "/Your%20Plan,%20Change%20the%20plan.svg?v=20260514-no-top-buttons";
    return `
        <img class="screen-art your-plan-edit-art" src="${art}" alt="${escapeAttr(step.title)}">
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="plan-correction-close" class="plan-correction-close-hit-area" type="button" aria-label="Закрыть корректировку плана"></button>
        <label class="plan-correction-input-layer ${filled ? "has-value" : ""}">
            <textarea id="plan-correction-input" maxlength="220" enterkeyhint="done" aria-label="Что хотите поменять?" placeholder="Хочу сделать план короче и интенсивнее">${escapeHtml(draft)}</textarea>
        </label>
        <button id="plan-correction-save" class="plan-correction-save-hit-area" type="button" ${filled ? "" : "disabled"}>Скорректировать план</button>
    `;
}

function goalStep(step) {
    const value = state.onboarding.goal || "";
    return `
        <img class="screen-art" src="/goal.svg?v=20260514-no-top-buttons" alt="Что будем достигать?">
        <button id="back" class="goal-back-hit-area" type="button" aria-label="Назад"></button>
        <label class="goal-input-layer ${value.trim() ? "has-value" : ""}">
            <textarea id="goal-input" maxlength="${step.limit}" enterkeyhint="done" placeholder="${escapeAttr(step.placeholder)}">${escapeHtml(value)}</textarea>
            <span id="counter" class="goal-counter">${value.length} / ${step.limit}</span>
        </label>
        <button id="next" class="goal-next-button" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
    `;
}

function nativeChoiceStep(step) {
    if (!state.onboarding[step.id] && state.customDrawerStepId !== step.id) {
        state.onboarding[step.id] = choiceOptionValue(step, 0);
    }
    const selected = state.onboarding[step.id] || "";
    const draft = state.customDrafts[step.id] || (isCustomStepValue(step, selected) && selected !== CUSTOM_VALUE ? selected : "");
    const drawerOpen = state.customDrawerStepId === step.id;
    const selectedIsCustom = isCustomStepValue(step, selected);

    if (drawerOpen && step.id === "experience") {
        return experienceDrawerStep(step, draft);
    }

    return `
        <header class="native-question-header">
            <button id="back" class="native-back-button" type="button" aria-label="Назад"></button>
            <div class="native-progress"><span style="width: ${step.progress}px"></span></div>
        </header>
        <section class="native-question-copy">
            <h1>${escapeHtml(step.title)}</h1>
            <p>${escapeHtml(step.subtitle)}</p>
        </section>
        ${drawerOpen ? `
            <label class="native-choice-list native-custom-panel ${draft.trim() ? "has-value" : ""}">
                <span>Свой вариант</span>
                <textarea id="custom-choice-input" maxlength="220" enterkeyhint="done" placeholder="Опиши свой опыт или условия">${escapeHtml(draft)}</textarea>
            </label>
        ` : `
            <section class="native-choice-list" aria-label="${escapeAttr(step.title)}">
                ${choiceOptions(step).map((option, index) => {
                    const value = choiceOptionValue(step, index);
                    const isSelected = selected === value;
                    return `
                        <button
                            class="native-choice-card ${isSelected ? "is-selected" : ""}"
                            type="button"
                            data-value="${escapeAttr(value)}"
                            aria-pressed="${isSelected ? "true" : "false"}">
                            <span class="native-choice-text">
                                <strong>${escapeHtml(option.title)}</strong>
                                <span>${escapeHtml(option.description)}</span>
                            </span>
                            <span class="native-radio" aria-hidden="true"></span>
                        </button>
                    `;
                }).join("")}
            </section>
        `}
        <footer class="native-choice-footer">
            ${step.custom ? `
                <button id="custom" class="native-custom-button ${selectedIsCustom ? "is-selected" : ""}" type="button" aria-pressed="${selectedIsCustom ? "true" : "false"}">
                    <span class="native-custom-divider"></span>
                    <span class="native-custom-label"><span class="native-pencil" aria-hidden="true"></span>Свой вариант</span>
                    <span class="native-custom-divider"></span>
                </button>
            ` : ""}
            <button id="next" class="native-next-button" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
        </footer>
    `;
}

function choiceOptions(step) {
    return effectiveOptions(step).map((option) => {
        if (option && typeof option === "object") {
            return {
                title: option.title || "Свой сценарий",
                description: option.description || "Подходит под твою цель и текущий ритм."
            };
        }
        return {
            title: option,
            description: "Более подробное описание в две такие строки, может больше"
        };
    });
}

function goalOptions(step) {
    const suggestions = state.suggestions.goals;
    if (Array.isArray(suggestions) && suggestions.length) {
        return suggestions.slice(0, 3);
    }
    return step.options.map((option, index) => ({
        duration: "3 месяца",
        title: index === 0 ? "Похудеть на 10 кг" : index === 1 ? "Собрать быстрый старт" : "Закрепить привычку",
        description: "Более подробное описание в три такие строки, может больше. Чтобы человек понял, что будет.",
        bullets: ["Для новичков", "Без экстремальных нагрузок", "3 тренировки в неделю", "Спокойный темп"],
        accent: index === 1 ? "orange" : index === 2 ? "green" : "blue",
        value: option
    }));
}

function goalValue(goal, index) {
    return `${goal.title || goal.value || "goal"}-${index}`;
}

function goalCardOverlay(goal, index) {
    if (!goal) {
        return "";
    }
    const accent = ["blue", "orange", "green"].includes(goal.accent) ? goal.accent : ["blue", "orange", "green"][index] || "blue";
    const bullets = Array.isArray(goal.bullets) ? goal.bullets.slice(0, 4) : [];
    return `
        <article class="choose-goal-ai-card is-${accent}">
            <span class="choose-goal-ai-duration">${escapeHtml(goal.duration || "3 месяца")}</span>
            <h2>${escapeHtml(goal.title || "Дойти до цели")}</h2>
            <p>${escapeHtml(goal.description || "План подстроен под твою цель и текущие условия.")}</p>
            <ul>
                ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
        </article>
    `;
}

function planOverlay(plan) {
    if (!plan || !Array.isArray(plan.milestones)) {
        return "";
    }
    return `
        <section class="your-plan-live-content">
            <p>${escapeHtml(plan.summary || "План собран под твою цель и текущие условия.")}</p>
            <div class="your-plan-live-timeline">
                ${plan.milestones.slice(0, 5).map((milestone, index) => `
                    <article class="your-plan-live-point ${index === 0 ? "is-current" : ""}">
                        <span class="your-plan-live-dot" aria-hidden="true"></span>
                        <div>
                            <h2>${escapeHtml(milestone.title || "Этап")}</h2>
                            <p>${escapeHtml(milestone.description || "Понятный следующий шаг")}</p>
                        </div>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function experienceDrawerStep(step, draft) {
    return `
        <img class="screen-art experience-drawer-art" src="/experience-drawer-opened.svg?v=20260514-no-top-buttons" alt="${escapeAttr(step.title)}">
        <button id="back" class="experience-drawer-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="custom-drawer-close" class="experience-drawer-close-hit-area" type="button" aria-label="Закрыть свой вариант"></button>
        <label class="experience-drawer-input-layer ${draft.trim() ? "has-value" : ""}">
            <textarea id="custom-choice-input" maxlength="220" enterkeyhint="done" aria-label="Свой вариант">${escapeHtml(draft)}</textarea>
        </label>
        <button id="next" class="experience-drawer-next-button" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
    `;
}

function textareaStep(step) {
    const value = state.onboarding[step.id] || "";
    return `
        <label class="goal-field">
            <textarea id="goal-input" maxlength="${step.limit}" enterkeyhint="done" placeholder="${escapeAttr(step.placeholder)}">${escapeHtml(value)}</textarea>
            <span id="counter">${value.length} / ${step.limit}</span>
        </label>
    `;
}

function choiceStep(step) {
    const selected = state.onboarding[step.id] || "";
    const className = step.type === "list" ? "choice-list" : "choice-grid";
    return `
        <section class="${className}">
            ${step.options.map((option, index) => {
                const value = choiceOptionValue(step, index);
                return `
                    <button class="choice ${selected === value ? "is-selected" : ""}" type="button" data-value="${escapeAttr(value)}">
                        ${escapeHtml(option)}
                    </button>
                `;
            }).join("")}
        </section>
    `;
}
