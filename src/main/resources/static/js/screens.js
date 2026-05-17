import {CUSTOM_VALUE} from "./config.js";
import {state} from "./state.js";
import {canContinue, choiceOptionValue, effectiveOptions, isCustomStepValue} from "./validators.js";
import {escapeAttr, escapeHtml} from "./utils.js";

export function renderStep(step) {
    if (step.type === "loader") {
        return `
            <img class="loader-art" src="/loader.svg?v=20260517-clean-top-ai" alt="GRINDY">
        `;
    }
    if (step.type === "welcome") {
        return `
            <img class="screen-art" src="/welcome-screen.svg?v=20260517-clean-top-ai" alt="Преврати цель в систему">
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
        "/Choose%20the%20Goal.svg?v=20260517-clean-top-ai",
        "/Choose%20the%20Goal-2.svg?v=20260517-clean-top-ai",
        "/Choose%20the%20Goal-3.svg?v=20260517-clean-top-ai"
    ][selectedIndex] || "/Choose%20the%20Goal.svg?v=20260517-clean-top-ai";

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
        ? "/Your%20Plan,%20Plan%20Changed.svg?v=20260517-clean-top-ai"
        : "/Your%20Plan.svg?v=20260517-clean-top-ai";
    return `
        <div class="your-plan-scroll">
            <img class="your-plan-art" src="${art}" alt="${escapeAttr(step.title)}">
            ${planOverlay(planForDisplay())}
            <span class="your-plan-scroll-spacer" aria-hidden="true"></span>
        </div>
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="change-plan" class="your-plan-change-hit-area" type="button">Скорректировать план</button>
        <button id="next" class="your-plan-next-hit-area" type="button">${escapeHtml(step.button)}</button>
    `;
}

function planCorrectionStep(step) {
    const draft = state.planDraft || "";
    const filled = Boolean(draft.trim());
    const art = filled
        ? "/Your%20Plan,%20Change%20the%20plan,%20Filled.svg?v=20260517-clean-top-ai"
        : "/Your%20Plan,%20Change%20the%20plan.svg?v=20260517-clean-top-ai";
    return `
        <img class="screen-art your-plan-edit-art" src="${art}" alt="${escapeAttr(step.title)}">
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="plan-correction-close" class="plan-correction-close-hit-area" type="button" aria-label="Закрыть корректировку плана"></button>
        <label class="plan-correction-input-layer ${filled ? "has-value" : ""}">
            <textarea id="plan-correction-input" maxlength="220" enterkeyhint="done" aria-label="Что хотите поменять?" placeholder="Хочу сделать план короче и интенсивнее">${escapeHtml(draft)}</textarea>
        </label>
        ${textSuggestions("plan-correction", planCorrectionHints(), "plan-correction-input")}
        <button id="plan-correction-save" class="plan-correction-save-hit-area" type="button" ${filled ? "" : "disabled"}>Скорректировать план</button>
    `;
}

function goalStep(step) {
    const value = state.onboarding.goal || "";
    return `
        <img class="screen-art" src="/goal.svg?v=20260517-clean-top-ai" alt="Что будем достигать?">
        <button id="back" class="goal-back-hit-area" type="button" aria-label="Назад"></button>
        <label class="goal-input-layer ${value.trim() ? "has-value" : ""}">
            <textarea id="goal-input" maxlength="${step.limit}" enterkeyhint="done" placeholder="${escapeAttr(step.placeholder)}">${escapeHtml(value)}</textarea>
            <span id="counter" class="goal-counter">${value.length} / ${step.limit}</span>
        </label>
        ${textSuggestions("goal", goalTextHints(value), "goal-input")}
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
            <section class="native-choice-list native-custom-panel ${draft.trim() ? "has-value" : ""}">
                <span>Свой вариант</span>
                <textarea id="custom-choice-input" maxlength="220" enterkeyhint="done" placeholder="${escapeAttr(customPlaceholder(step))}">${escapeHtml(draft)}</textarea>
                ${textSuggestions("native-custom", choiceTextHints(step), "custom-choice-input")}
            </section>
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
    if (Array.isArray(suggestions) && suggestions.length && suggestionsMatchCurrentGoal()) {
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

function planForDisplay() {
    if (state.suggestions.plan && Array.isArray(state.suggestions.plan.milestones) && suggestionsMatchCurrentGoal()) {
        return state.suggestions.plan;
    }
    const goal = (state.onboarding.goal || "цели").trim();
    return {
        summary: `Примерный план под твою цель: ${goal.slice(0, 90)}${goal.length > 90 ? "..." : ""}`,
        milestones: [
            {title: "Старт", description: "Зафиксируй текущую точку и выбери один простой шаг на сегодня."},
            {title: "Первая неделя", description: "Собери минимальный ритм: короткие действия, отметки прогресса и понятные напоминания."},
            {title: "Первый месяц", description: "Убери то, что мешает чаще всего, и закрепи действия в обычном графике."},
            {title: "Контроль", description: "Раз в неделю смотри, что сработало, и корректируй план без чувства вины."},
            {title: "Закрепление", description: "Усиль результат и подготовь следующий уровень, когда базовый ритм станет устойчивым."}
        ]
    };
}

function experienceDrawerStep(step, draft) {
    return `
        <img class="screen-art experience-drawer-art" src="/experience-drawer-opened.svg?v=20260517-clean-top-ai" alt="${escapeAttr(step.title)}">
        <button id="back" class="experience-drawer-back-hit-area" type="button" aria-label="Назад"></button>
        <button id="custom-drawer-close" class="experience-drawer-close-hit-area" type="button" aria-label="Закрыть свой вариант"></button>
        <label class="experience-drawer-input-layer ${draft.trim() ? "has-value" : ""}">
            <textarea id="custom-choice-input" maxlength="220" enterkeyhint="done" aria-label="Свой вариант" placeholder="${escapeAttr(customPlaceholder(step))}">${escapeHtml(draft)}</textarea>
        </label>
        ${textSuggestions("experience-drawer", choiceTextHints(step), "custom-choice-input")}
        <button id="next" class="experience-drawer-next-button" type="button" ${canContinue(step) ? "" : "disabled"}>${escapeHtml(step.button)}</button>
    `;
}

function textSuggestions(kind, suggestions, targetId) {
    const clean = [...new Set((suggestions || []).map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 3);
    if (!clean.length) {
        return "";
    }
    return `
        <section class="ai-text-suggestions ai-text-suggestions-${kind}" aria-label="AI-подсказки">
            ${clean.map((suggestion) => `
                <button class="ai-text-suggestion" type="button" data-target="${escapeAttr(targetId)}" data-value="${escapeAttr(suggestion)}">
                    ${escapeHtml(suggestion)}
                </button>
            `).join("")}
        </section>
    `;
}

export function goalTextHints(value) {
    const base = String(value || "").trim();
    const goals = Array.isArray(state.suggestions.goals) ? state.suggestions.goals : [];
    if (goals.length && suggestionsMatchCurrentGoal()) {
        return goals.map((goal) => {
            const title = goal.title || "Дойти до цели";
            const description = goal.description || "с понятным планом и спокойным темпом";
            return `${title}: ${description}`;
        });
    }
    if (base.length > 10) {
        return [
            `${base}. Хочу понятный план на 3 месяца, чтобы двигаться без перегруза и видеть прогресс каждую неделю.`,
            `${base}. Важно встроить это в обычный график, с короткими шагами и поддержкой, когда мотивация проседает.`
        ];
    }
    return [
        "Хочу выбрать одну важную цель и довести её до результата за 3 месяца без резких рывков.",
        "Хочу собрать понятный план, который будет учитывать мой график, опыт и реальные ограничения."
    ];
}

function customPlaceholder(step) {
    if (step.id === "experience") {
        return "Что уже пробовал для этой цели?";
    }
    if (step.id === "conditions") {
        return "Что важно учесть: время, график, ограничения?";
    }
    return "Опиши свой вариант";
}

function suggestionsMatchCurrentGoal() {
    const savedGoal = (state.suggestionsKey || "").split("|")[0] || "";
    return savedGoal === (state.onboarding.goal || "").trim();
}

function choiceTextHints(step) {
    return choiceOptions(step).map((option) => `${option.title}. ${option.description}`);
}

function planCorrectionHints() {
    const plan = state.suggestions.plan;
    const milestones = plan && Array.isArray(plan.milestones) ? plan.milestones : [];
    const milestoneTitle = milestones[1] && milestones[1].title ? milestones[1].title.toLowerCase() : "первые шаги";
    return [
        "Сделай план мягче и реалистичнее на загруженные дни.",
        `Добавь больше конкретики про ${milestoneTitle}.`,
        "Разбей действия на короткие шаги по 15-20 минут."
    ];
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
