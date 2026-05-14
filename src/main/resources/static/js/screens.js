import {CUSTOM_VALUE} from "./config.js";
import {state} from "./state.js";
import {canContinue, choiceOptionValue, isCustomStepValue} from "./validators.js";
import {escapeAttr, escapeHtml} from "./utils.js";

export function renderStep(step) {
    if (step.type === "loader") {
        return `
            <img class="loader-art" src="/loader.svg?v=20260513-0400" alt="GRINDY">
        `;
    }
    if (step.type === "welcome") {
        return `
            <img class="screen-art" src="/welcome-screen.svg?v=20260513-0500" alt="Преврати цель в систему">
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
    if (!state.onboarding.selectedGoal) {
        state.onboarding.selectedGoal = step.options[0];
    }
    const selected = state.onboarding.selectedGoal;
    const selectedIndex = Math.max(0, step.options.indexOf(selected));
    const art = [
        "/Choose%20the%20Goal.svg?v=20260514-choose-goal",
        "/Choose%20the%20Goal-2.svg?v=20260514-choose-goal",
        "/Choose%20the%20Goal-3.svg?v=20260514-choose-goal"
    ][selectedIndex] || "/Choose%20the%20Goal.svg?v=20260514-choose-goal";

    return `
        <img class="screen-art choose-goal-art" src="${art}" alt="${escapeAttr(step.title)}">
        <button id="back" class="choose-goal-back-hit-area" type="button" aria-label="Назад"></button>
        <section class="choose-goal-selector" aria-label="${escapeAttr(step.title)}">
            ${step.options.map((option, index) => `
                <button
                    class="choose-goal-dot choose-goal-dot-${index + 1} ${selected === option ? "is-selected" : ""}"
                    type="button"
                    data-value="${escapeAttr(option)}"
                    aria-label="Вариант цели ${index + 1}"
                    aria-pressed="${selected === option ? "true" : "false"}"></button>
            `).join("")}
        </section>
        <button id="next" class="choose-goal-next-hit-area" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
    `;
}

function yourPlanStep(step) {
    if (!state.onboarding.selectedPlan) {
        state.onboarding.selectedPlan = "default-plan";
    }
    return `
        <img class="screen-art your-plan-art" src="/Your%20Plan.svg?v=20260514-your-plan" alt="${escapeAttr(step.title)}">
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="change-plan" class="your-plan-change-hit-area" type="button" aria-label="Скорректировать план"></button>
        <button id="next" class="your-plan-next-hit-area" type="button">${escapeHtml(step.button)}</button>
    `;
}

function goalStep(step) {
    const value = state.onboarding.goal || "";
    return `
        <img class="screen-art" src="/goal.svg?v=20260513-0600" alt="Что будем достигать?">
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
                ${step.options.map((option, index) => {
                    const value = choiceOptionValue(step, index);
                    const isSelected = selected === value;
                    return `
                        <button
                            class="native-choice-card ${isSelected ? "is-selected" : ""}"
                            type="button"
                            data-value="${escapeAttr(value)}"
                            aria-pressed="${isSelected ? "true" : "false"}">
                            <span class="native-choice-text">
                                <strong>${escapeHtml(option)}</strong>
                                <span>Более подробное описание<br>в две такие строки, может больше</span>
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

function experienceDrawerStep(step, draft) {
    return `
        <img class="screen-art experience-drawer-art" src="/experience-drawer-opened.svg?v=20260514-custom-modal" alt="${escapeAttr(step.title)}">
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
