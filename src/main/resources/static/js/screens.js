import {CUSTOM_VALUE} from "./config.js";
import {state} from "./state.js";
import {canContinue, choiceOptionValue, effectiveOptions, isCustomStepValue} from "./validators.js";
import {escapeAttr, escapeHtml} from "./utils.js";

export function renderStep(step) {
    if (step.type === "loader") {
        return `
            <img class="loader-art" src="/loader.svg?v=20260517-card-book" alt="GRINDY">
        `;
    }
    if (step.type === "welcome") {
        return `
            <img class="screen-art" src="/welcome-screen.svg?v=20260517-card-book" alt="Преврати цель в систему">
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
    const art = chooseGoalArt(selectedIndex);
    const flipArt = chooseGoalArt(state.goalCardFlipFromIndex);

    return `
        <div class="choose-goal-stage ${state.goalCardFlip ? `is-flipping is-flipping-${escapeAttr(state.goalCardFlipDirection)}` : ""}">
            <img class="screen-art choose-goal-art" src="${art}" alt="${escapeAttr(step.title)}">
            <span class="choose-goal-flip-card" aria-hidden="true">
                <img src="${flipArt}" alt="">
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
        ? "/Your%20Plan,%20Plan%20Changed.svg?v=20260517-card-book"
        : "/Your%20Plan.svg?v=20260517-card-book";
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
    return `
        <div class="your-plan-scroll is-dimmed">
            <img class="your-plan-art" src="/Your%20Plan.svg?v=20260517-card-book" alt="${escapeAttr(step.title)}">
            ${planOverlay(planForDisplay())}
            <span class="your-plan-scroll-spacer" aria-hidden="true"></span>
        </div>
        <button id="back" class="your-plan-back-hit-area" type="button" aria-label="Назад"></button>
        <div class="plan-correction-backdrop" aria-hidden="true"></div>
        <section class="plan-correction-modal" aria-label="Корректировка плана">
            <button id="plan-correction-close" class="plan-correction-close-hit-area" type="button" aria-label="Закрыть корректировку плана"></button>
            <h2>Что хотите поменять?</h2>
            <label class="plan-correction-input-layer ${filled ? "has-value" : ""}">
                <textarea id="plan-correction-input" maxlength="220" enterkeyhint="done" aria-label="Что хотите поменять?" placeholder="Хочу сделать план короче и интенсивнее">${escapeHtml(draft)}</textarea>
            </label>
            ${textSuggestions("plan-correction", planCorrectionHints(), "plan-correction-input")}
            <button id="plan-correction-save" class="plan-correction-save-hit-area" type="button" ${filled ? "" : "disabled"}>Скорректировать план</button>
        </section>
    `;
}

function goalStep(step) {
    const value = state.onboarding.goal || "";
    return `
        <img class="screen-art" src="/goal.svg?v=20260517-card-book" alt="Что будем достигать?">
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
    const baseOptions = choiceOptions(step).map((option, index) => ({
        ...option,
        value: choiceOptionValue(step, index),
        custom: false
    }));
    const visibleOptions = selectedIsCustom && selected !== CUSTOM_VALUE
        ? [
            {
                title: "Свой вариант",
                description: selected,
                value: selected,
                custom: true
            },
            ...baseOptions.slice(1)
        ]
        : baseOptions;

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
                <button id="custom-drawer-close" class="native-custom-close-hit-area" type="button" aria-label="Закрыть свой вариант"></button>
                <span>${escapeHtml(customDrawerTitle(step))}</span>
                <textarea id="custom-choice-input" maxlength="220" enterkeyhint="done" placeholder="${escapeAttr(customPlaceholder(step))}">${escapeHtml(draft)}</textarea>
                ${textSuggestions("native-custom", choiceTextHints(step), "custom-choice-input")}
            </section>
        ` : `
            <section class="native-choice-list" aria-label="${escapeAttr(step.title)}">
                ${visibleOptions.map((option) => {
                    const isSelected = selected === option.value;
                    return `
                        <button
                            class="native-choice-card ${isSelected ? "is-selected" : ""} ${option.custom ? "is-custom-selected" : ""}"
                            type="button"
                            data-value="${escapeAttr(option.value)}"
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
            ${step.custom && !selectedIsCustom ? `
                <button id="custom" class="native-custom-button" type="button" aria-pressed="false">
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

function chooseGoalArt(index) {
    return [
        "/Choose%20the%20Goal.svg?v=20260517-card-book",
        "/Choose%20the%20Goal-2.svg?v=20260517-card-book",
        "/Choose%20the%20Goal-3.svg?v=20260517-card-book"
    ][index] || "/Choose%20the%20Goal.svg?v=20260517-card-book";
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
    const milestones = planMilestonesForDisplay(plan).slice(0, 8);
    return `
        <section class="your-plan-live-content">
            <p>${escapeHtml(plan.summary || "План собран под твою цель и текущие условия.")}</p>
            <div class="your-plan-live-timeline">
                ${milestones.map((milestone, index) => `
                    <article class="your-plan-live-point ${index === 0 ? "is-current" : ""}">
                        <span class="your-plan-live-dot" aria-hidden="true"></span>
                        <div>
                            <h2>${escapeHtml(milestone.title || "Этап")}</h2>
                            <p>${escapeHtml(milestone.description || "Понятный следующий шаг")}</p>
                            ${milestone.current ? "" : `
                                <ul class="your-plan-live-details">
                                    ${milestoneDetails(milestone, index).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                                </ul>
                            `}
                        </div>
                    </article>
                `).join("")}
            </div>
        </section>
    `;
}

function planMilestonesForDisplay(plan) {
    const source = Array.isArray(plan.milestones) ? plan.milestones.filter(Boolean) : [];
    const firstTitle = String((source[0] && source[0].title) || "").toLowerCase();
    const hasCurrentPoint = firstTitle.includes("вы здесь") || firstTitle.includes("сегодня");
    const currentPoint = {
        title: "Вы здесь",
        description: "Сегодня начинаем",
        current: true
    };
    return hasCurrentPoint
        ? [{...source[0], current: true}, ...source.slice(1)]
        : [currentPoint, ...source];
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
            {title: "Неделя 2", description: "Добавь повторяемость: выбери дни, время и простой способ не пропускать важные действия."},
            {title: "Первый месяц", description: "Убери то, что мешает чаще всего, и закрепи действия в обычном графике."},
            {title: "Проверка прогресса", description: "Раз в неделю смотри, что сработало, и корректируй план без чувства вины."},
            {title: "Поддержка", description: "Подключи людей, напоминания или среду, чтобы не тащить цель только на мотивации."},
            {title: "Закрепление", description: "Усиль результат и подготовь следующий уровень, когда базовый ритм станет устойчивым."}
        ]
    };
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
            "Уточнить срок, измеримый результат и главный критерий успеха.",
            "Добавить текущий уровень, ограничения и сколько времени готов уделять в неделю.",
            "Сделать цель конкретнее: что именно должно измениться через 3 месяца."
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

function customDrawerTitle(step) {
    if (step.id === "experience") {
        return "Напишите свой опыт";
    }
    if (step.id === "conditions") {
        return "Напишите свои условия";
    }
    return "Напишите свой вариант";
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

function milestoneDetails(milestone, index) {
    const title = (milestone.title || "").toLowerCase();
    if (index === 0 || title.includes("старт") || title.includes("здесь")) {
        return [
            "Запиши исходное состояние и главный критерий успеха.",
            "Выбери действие на сегодня, которое можно сделать за 10-15 минут."
        ];
    }
    if (title.includes("недел") || title.includes("перв")) {
        return [
            "Поставь 3-4 коротких действия в календарь.",
            "Отмечай выполнение каждый день, даже если сделал минимум."
        ];
    }
    if (title.includes("поддерж")) {
        return [
            "Предупреди близких или коллег, что тебе важен новый ритм.",
            "Подготовь среду заранее: убери лишние препятствия и добавь напоминания."
        ];
    }
    if (title.includes("провер") || title.includes("контрол") || title.includes("прогресс")) {
        return [
            "Раз в неделю сравни план и реальность без самокритики.",
            "Оставь то, что работает, а сложные действия упрости."
        ];
    }
    if (title.includes("закреп")) {
        return [
            "Сохрани привычки, которые дали лучший результат.",
            "Выбери следующий уровень только после стабильной недели."
        ];
    }
    return [
        "Сделай шаг маленьким, измеримым и понятным.",
        "Если день сорвался, вернись к минимальному варианту завтра."
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
