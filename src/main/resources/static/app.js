import {CUSTOM_VALUE} from "./js/config.js";
import {steps} from "./js/steps.js";
import {currentSuggestionsKey, nodes, state} from "./js/state.js";
import {ApiError, authenticate, loadCurrentUser, loadOnboardingSuggestions, saveOnboarding} from "./js/api.js";
import {initTelegram, syncTheme, telegram} from "./js/telegram.js";
import {goalTextHints, renderStep} from "./js/screens.js";
import {canContinue, choiceOptionValue, effectiveOptions, isCustomStepValue, isSavedChoiceValue} from "./js/validators.js";
import {wait} from "./js/utils.js";

// Main frontend controller: boots Telegram, renders steps, binds UI events and syncs answers with the backend.
initTelegram();
bindViewport();
setAppHeight();
nodes.app.hidden = false;
render();
boot();

async function boot() {
    try {
        await authenticateSession();
        loadFromUser();
        repairOnboardingStep();
        state.isReady = true;
        refreshSuggestions({renderAfter: false});
        if (state.pendingSplashTap) {
            finishSplash();
        }
    } catch (error) {
        console.error(error);
        state.isSplash = false;
        state.bootError = userFacingBootError(error);
        nodes.app.hidden = false;
        nodes.onboardingWizard.innerHTML = `<section class="fatal">${state.bootError}</section>`;
    }
}

async function authenticateSession() {
    if (telegram && telegram.initData) {
        await authenticate({initData: telegram.initData});
        return;
    }
    if (!state.token) {
        await authenticate({username: "local_user"});
        return;
    }
    try {
        await loadCurrentUser();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            clearStoredSession();
            await authenticate({username: "local_user"});
            return;
        }
        throw error;
    }
}

function userFacingBootError(error) {
    if (error instanceof ApiError && error.status === 401) {
        return "Открой приложение внутри Telegram, чтобы продолжить.";
    }
    return "Не удалось открыть онбординг. Проверь подключение и попробуй ещё раз.";
}

function loadFromUser() {
    nodes.app.hidden = false;
    const saved = state.user && state.user.onboarding ? state.user.onboarding : {};
    Object.keys(state.onboarding).forEach((key) => {
        state.onboarding[key] = saved[key] || state.onboarding[key] || "";
    });
    ["experience", "conditions"].forEach((key) => {
        const step = steps.find((item) => item.id === key);
        const value = state.onboarding[key];
        state.choiceHistory[key] = splitHistory(state.onboarding[`${key}History`]);
        state.choiceDepth[key] = state.choiceHistory[key].length;
        if (step && value && value !== CUSTOM_VALUE) {
            state.choiceTouched[key] = true;
            state.choiceSnapshots[key] = effectiveOptions(step);
        }
        if (step && isCustomStepValue(step, value) && !isSavedChoiceValue(value) && value !== CUSTOM_VALUE) {
            state.customDrafts[key] = value;
        }
    });
}

function repairOnboardingStep() {
    const maxStep = firstIncompleteStep();
    if (state.onboardingStep > maxStep) {
        state.onboardingStep = maxStep;
        localStorage.setItem("grindy.step", String(maxStep));
    }
}

function firstIncompleteStep() {
    if ((state.onboarding.goal || "").trim().length < steps[2].minLength) {
        return 2;
    }
    if (!isCompletedChoice("experience")) {
        return 3;
    }
    if (!isCompletedChoice("conditions")) {
        return 4;
    }
    if (!(state.onboarding.selectedGoal || "").trim()) {
        return 5;
    }
    return 6;
}

function isCompletedChoice(id) {
    const value = (state.onboarding[id] || "").trim();
    return Boolean(value) && value !== CUSTOM_VALUE;
}

function finishSplash() {
    state.isSplash = false;
    state.pendingSplashTap = false;
    render();
}

function render() {
    const step = state.isSplash ? steps[0] : (steps[state.onboardingStep] || steps[1]);
    syncTheme(step);
    if (!state.isSplash && step.type !== "loader") {
        localStorage.setItem("grindy.step", String(state.onboardingStep));
    }
    nodes.onboardingWizard.innerHTML = `
        <section class="${screenClassFor(step)}">
            ${renderStep(step)}
        </section>
    `;

    if (step.type === "loader") {
        bindSplash();
        return;
    }
    bindStep(step);
}

function screenClassFor(step) {
    return [
        "phone-screen",
        step.type === "loader" ? "is-loader" : "",
        step.type === "welcome" ? "is-welcome" : "",
        step.id === "goal" ? "is-goal" : "",
        step.id === "experience" ? "is-experience" : "",
        step.id === "conditions" ? "is-current-state" : "",
        step.id === "selectedGoal" ? "is-choose-goal" : "",
        step.id === "selectedPlan" ? "is-your-plan" : "",
        step.id === state.customDrawerStepId ? "has-custom-drawer" : "",
        state.planCorrectionOpen ? "has-plan-correction" : "",
        state.savingStepId === step.id ? "is-saving" : ""
    ].filter(Boolean).join(" ");
}

function bindSplash() {
    const screen = document.querySelector(".phone-screen.is-loader");
    if (!screen) {
        return;
    }
    screen.addEventListener("pointerup", () => {
        state.pendingSplashTap = true;
        if (state.isReady) {
            finishSplash();
        }
    }, {once: true});
}

function bindStep(step) {
    bindNavigation();
    bindGoalInput(step);
    bindCustomInput(step);
    bindPlanCorrectionInput();
    bindTextSuggestions();
    bindChoiceButtons(step);
    bindChooseGoalActions(step);
    bindPlanActions();
    bindCustomOpen(step);
    bindKeyboardDismiss();
}

function bindNavigation() {
    const next = document.getElementById("next");
    if (next) {
        next.disabled = next.disabled || state.isAdvancing;
        next.addEventListener("click", nextStep);
    }

    const back = document.getElementById("back");
    if (back) {
        back.addEventListener("click", previousStep);
    }
}

function bindGoalInput(step) {
    const input = document.getElementById("goal-input");
    if (!input) {
        return;
    }
    const next = document.getElementById("next");
    const field = input.closest(".goal-input-layer");
    input.addEventListener("focus", () => {
        if (field) {
            field.classList.add("is-focused");
        }
        setKeyboardOpen(true);
    });
    input.addEventListener("blur", () => {
        if (field) {
            field.classList.remove("is-focused");
        }
        setKeyboardOpen(false);
    });
    input.addEventListener("input", () => {
        const previousGoal = state.onboarding.goal;
        state.onboarding.goal = input.value.slice(0, step.limit);
        if (previousGoal !== state.onboarding.goal) {
            resetChoiceLocksForNewGoal();
        }
        if (field) {
            field.classList.toggle("has-value", Boolean(state.onboarding.goal.trim()));
        }
        document.getElementById("counter").textContent = `${state.onboarding.goal.length} / ${step.limit}`;
        next.disabled = !canContinue(step);
        updateGoalTextSuggestions(state.onboarding.goal);
        autosave();
        queueSuggestionsRefresh();
    });
    input.addEventListener("keydown", handleDoneKey);
}

function resetChoiceLocksForNewGoal() {
    ["experience", "conditions"].forEach((id) => {
        state.choiceTouched[id] = false;
        state.choiceSnapshots[id] = [];
        state.choiceDepth[id] = 0;
        state.choiceHistory[id] = [];
        state.onboarding[id] = "";
        state.onboarding[`${id}History`] = "";
    });
    state.onboarding.selectedGoal = "";
    state.onboarding.selectedPlan = "";
}

function bindCustomInput(step) {
    const input = document.getElementById("custom-choice-input");
    if (!input) {
        return;
    }
    const save = document.getElementById("custom-drawer-save");
    const layer = input.closest(".native-custom-panel, .native-custom-drawer, .experience-drawer-input-layer");
    input.addEventListener("focus", () => setKeyboardOpen(true));
    input.addEventListener("blur", () => setKeyboardOpen(false));
    input.addEventListener("input", () => {
        const draft = input.value.slice(0, input.maxLength || 220);
        state.customDrafts[step.id] = draft;
        if (layer) {
            layer.classList.toggle("has-value", Boolean(draft.trim()));
        }
        if (save) {
            save.disabled = !draft.trim();
        }
    });
    input.addEventListener("keydown", handleDoneKey);

    const close = document.getElementById("custom-drawer-close");
    if (close) {
        close.addEventListener("click", () => {
            blurActiveControl();
            closeCustomDrawer(step);
        });
    }

    if (save) {
        save.addEventListener("click", () => commitCustomDrawer(step));
    }
}

function bindChoiceButtons(step) {
    document.querySelectorAll(".choice, .native-choice-card").forEach((button) => {
        button.addEventListener("click", () => {
            blurActiveControl();
            state.customDrawerStepId = "";
            state.choiceTouched[step.id] = true;
            state.choiceSnapshots[step.id] = effectiveOptions(step);
            state.onboarding[step.id] = button.dataset.value;
            autosave();
            render();
        });
    });
}

function bindChooseGoalActions(step) {
    const values = [...document.querySelectorAll(".choose-goal-dot")].map((dot) => dot.dataset.value);
    const selectGoal = (value, direction = "next") => {
        if (!value || state.onboarding.selectedGoal === value) {
            return;
        }
        blurActiveControl();
        state.goalCardFlipFromIndex = Math.max(0, values.indexOf(state.onboarding.selectedGoal));
        state.goalCardFlipDirection = direction;
        state.goalCardFlip = true;
        state.onboarding.selectedGoal = value;
        autosave();
        render();
        window.setTimeout(() => {
            state.goalCardFlip = false;
            state.goalCardFlipFromIndex = Math.max(0, values.indexOf(state.onboarding.selectedGoal));
        }, 360);
    };

    document.querySelectorAll(".choose-goal-dot").forEach((button) => {
        button.addEventListener("click", () => {
            const currentIndex = Math.max(0, values.indexOf(state.onboarding.selectedGoal));
            const targetIndex = Math.max(0, values.indexOf(button.dataset.value));
            selectGoal(button.dataset.value, targetIndex >= currentIndex ? "next" : "prev");
        });
    });

    document.querySelectorAll(".choose-goal-card-hit-area").forEach((button) => {
        let startX = 0;
        let startY = 0;
        let didSwipe = false;
        const goRelative = (delta) => {
            if (!values.length) {
                return;
            }
            const currentIndex = Math.max(0, values.indexOf(state.onboarding.selectedGoal));
            const targetIndex = (currentIndex + delta + values.length) % values.length;
            selectGoal(values[targetIndex], delta > 0 ? "next" : "prev");
        };
        button.addEventListener("pointerdown", (event) => {
            startX = event.clientX;
            startY = event.clientY;
            didSwipe = false;
            button.setPointerCapture?.(event.pointerId);
        });
        button.addEventListener("pointerup", (event) => {
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;
            if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
                didSwipe = true;
                goRelative(deltaX < 0 ? 1 : -1);
            }
        });
        button.addEventListener("click", () => {
            if (didSwipe) {
                didSwipe = false;
                return;
            }
            goRelative(1);
        });
    });
}

function bindPlanActions() {
    const changePlan = document.getElementById("change-plan");
    if (changePlan) {
        changePlan.addEventListener("click", () => {
            blurActiveControl();
            state.planCorrectionOpen = true;
            state.planDraft = state.onboarding.selectedPlan && state.onboarding.selectedPlan !== "default-plan"
                ? state.onboarding.selectedPlan
                : state.planDraft;
            render();
            window.requestAnimationFrame(() => {
                const input = document.getElementById("plan-correction-input");
                if (input) {
                    input.focus({preventScroll: true});
                }
            });
        });
    }

    const close = document.getElementById("plan-correction-close");
    if (close) {
        close.addEventListener("click", () => {
            blurActiveControl();
            closePlanCorrection();
        });
    }

    const save = document.getElementById("plan-correction-save");
    if (save) {
        save.addEventListener("click", async () => {
            const draft = state.planDraft.trim();
            if (!draft) {
                return;
            }
            blurActiveControl();
            state.onboarding.selectedPlan = draft;
            state.planChanged = true;
            state.planCorrectionOpen = false;
            autosave();
            render();
            await refreshSuggestions({renderAfter: false, force: true});
            render();
        });
    }
}

function bindPlanCorrectionInput() {
    const input = document.getElementById("plan-correction-input");
    if (!input) {
        return;
    }
    const save = document.getElementById("plan-correction-save");
    const layer = input.closest(".plan-correction-input-layer");
    input.addEventListener("focus", () => setKeyboardOpen(true));
    input.addEventListener("blur", () => setKeyboardOpen(false));
    input.addEventListener("input", () => {
        state.planDraft = input.value.slice(0, input.maxLength || 220);
        const filled = Boolean(state.planDraft.trim());
        if (layer) {
            layer.classList.toggle("has-value", filled);
        }
        if (save) {
            save.disabled = !filled;
        }
    });
    input.addEventListener("keydown", handleDoneKey);
}

function bindTextSuggestions() {
    document.querySelectorAll(".ai-text-suggestion").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.target);
            if (!input) {
                return;
            }
            appendSuggestionToInput(input, button.dataset.value || "");
        });
    });
}

function updateGoalTextSuggestions(value) {
    const container = document.querySelector(".ai-text-suggestions-goal");
    if (!container) {
        return;
    }
    const loading = state.suggestionsLoading && (state.onboarding.goal || "").trim().length >= 24;
    container.classList.toggle("is-loading", loading);
    const children = [];
    if (loading) {
        const loader = document.createElement("span");
        loader.className = "ai-suggestions-loader";
        loader.setAttribute("aria-live", "polite");
        loader.innerHTML = `<span class="ai-suggestions-spinner" aria-hidden="true"></span>Генерируем варианты`;
        children.push(loader);
    }
    children.push(...goalTextHints(value).slice(0, 3).map((hint) => {
        const button = document.createElement("button");
        button.className = "ai-text-suggestion";
        button.type = "button";
        button.dataset.target = "goal-input";
        button.dataset.value = hint;
        button.textContent = hint;
        button.addEventListener("click", () => {
            const input = document.getElementById("goal-input");
            if (!input) {
                return;
            }
            appendSuggestionToInput(input, hint);
        });
        return button;
    }));
    container.replaceChildren(...children);
}

function appendSuggestionToInput(input, suggestion) {
    const addition = String(suggestion || "").trim();
    if (!addition) {
        return;
    }
    const maxLength = Number(input.getAttribute("maxlength")) || 1000;
    const current = input.value.trimEnd();
    const separator = current ? (/[.!?…:;]$/.test(current) ? " " : ". ") : "";
    input.value = `${current}${separator}${addition}`.slice(0, maxLength);
    input.dispatchEvent(new Event("input", {bubbles: true}));
    input.focus({preventScroll: true});
}

function bindCustomOpen(step) {
    const custom = document.getElementById("custom");
    if (!custom) {
        return;
    }
    custom.addEventListener("click", () => {
        blurActiveControl();
        state.customDrawerStepId = step.id;
        const current = state.onboarding[step.id];
        if (!isCustomStepValue(step, current) || isSavedChoiceValue(current)) {
            state.customPreviousValues[step.id] = current;
        }
        state.customDrafts[step.id] = isCustomStepValue(step, current) && !isSavedChoiceValue(current) && current !== CUSTOM_VALUE
            ? current
            : state.customDrafts[step.id] || "";
        state.onboarding[step.id] = CUSTOM_VALUE;
        render();
        window.requestAnimationFrame(() => {
            const input = document.getElementById("custom-choice-input");
            if (input) {
                input.focus({preventScroll: true});
            }
        });
    });
}

function commitCustomDrawer(step) {
    const draft = (state.customDrafts[step.id] || "").trim();
    if (!draft) {
        return;
    }
    blurActiveControl();
    state.choiceTouched[step.id] = true;
    state.choiceSnapshots[step.id] = effectiveOptions(step);
    state.onboarding[step.id] = draft;
    state.customDrafts[step.id] = "";
    state.customDrawerStepId = "";
    autosave();
    render();
}

async function nextStep() {
    if (state.isAdvancing) {
        return;
    }
    const currentStepIndex = state.onboardingStep;
    const step = steps[currentStepIndex];
    if (!canContinue(step)) {
        return;
    }
    state.isAdvancing = true;
    blurActiveControl();
    if (shouldDeepenChoice(step)) {
        await deepenChoiceStep(step);
        state.isAdvancing = false;
        return;
    }
    if (["experience", "conditions"].includes(step.id)) {
        finalizeChoiceStep(step);
    }
    if (["goal", "experience", "conditions"].includes(step.id)) {
        queueImmediateSuggestionsRefresh();
    }
    if (step.id === "selectedGoal") {
        await refreshSuggestions({renderAfter: false});
    }
    const showSaving = step.id === "experience" && state.customDrawerStepId !== step.id;
    if (showSaving) {
        state.savingStepId = step.id;
        render();
        await wait(120);
    } else {
        const next = document.getElementById("next");
        if (next) {
            next.disabled = true;
        }
        await wait(80);
    }
    try {
        await saveOnboardingWithTimeout();
    } catch (error) {
        handleBackgroundSaveError(error);
        if (error instanceof ApiError && error.status === 401) {
            nodes.onboardingWizard.innerHTML = `<section class="fatal">${userFacingBootError(error)}</section>`;
            return;
        }
    } finally {
        state.savingStepId = "";
        state.isAdvancing = false;
    }
    if (state.onboardingStep !== currentStepIndex) {
        return;
    }
    if (currentStepIndex < steps.length - 1) {
        goTo(currentStepIndex + 1);
        return;
    }
    localStorage.setItem("grindy.onboardingComplete", "true");
    if (telegram) {
        telegram.sendData(JSON.stringify(state.onboarding));
        telegram.close();
    }
}

function previousStep() {
    blurActiveControl();
    const step = steps[state.onboardingStep];
    if (state.planCorrectionOpen) {
        closePlanCorrection();
        return;
    }
    if (step && state.customDrawerStepId === step.id) {
        closeCustomDrawer(step);
        return;
    }
    if (state.onboardingStep <= 2) {
        goTo(1);
        return;
    }
    goTo(state.onboardingStep - 1);
}

function closeCustomDrawer(step) {
    if (state.onboarding[step.id] === CUSTOM_VALUE) {
        state.onboarding[step.id] = state.customPreviousValues[step.id] || choiceOptionValue(step, 0);
    }
    state.customDrawerStepId = "";
    render();
}

function closePlanCorrection() {
    state.planCorrectionOpen = false;
    render();
}

function goTo(index) {
    state.isSplash = false;
    state.onboardingStep = Math.max(0, Math.min(index, steps.length - 1));
    if ((steps[state.onboardingStep] || {}).id !== state.customDrawerStepId) {
        state.customDrawerStepId = "";
    }
    if ((steps[state.onboardingStep] || {}).id !== "selectedPlan") {
        state.planCorrectionOpen = false;
    }
    render();
}

async function deepenChoiceStep(step) {
    const selected = choiceTitleFromValue(state.onboarding[step.id]);
    if (!selected) {
        return;
    }
    // Пользователь остаётся на том же вопросе, но выбранный ответ уходит в историю для следующего AI-раунда.
    const history = state.choiceHistory[step.id] || [];
    if (!history.includes(selected)) {
        history.push(selected);
    }
    state.choiceHistory[step.id] = history.slice(0, 3);
    state.choiceDepth[step.id] = state.choiceHistory[step.id].length;
    state.onboarding[`${step.id}History`] = state.choiceHistory[step.id].join(" | ");
    state.onboarding[step.id] = "";
    state.choiceTouched[step.id] = false;
    state.choiceSnapshots[step.id] = [];
    state.customDrawerStepId = "";
    state.savingStepId = step.id;
    render();
    try {
        await saveOnboardingWithTimeout();
    } catch (error) {
        handleBackgroundSaveError(error);
    }
    state.savingStepId = "";
    await refreshSuggestions({renderAfter: true, force: true});
}

function finalizeChoiceStep(step) {
    const selected = choiceTitleFromValue(state.onboarding[step.id]);
    if (!selected) {
        return;
    }
    // Последний выбранный ответ тоже добавляем в историю, чтобы финальный план видел весь путь уточнений.
    const history = state.choiceHistory[step.id] || [];
    if (!history.includes(selected)) {
        history.push(selected);
    }
    state.choiceHistory[step.id] = history.slice(-3);
    state.choiceDepth[step.id] = Math.max(state.choiceDepth[step.id] || 0, state.choiceHistory[step.id].length);
    state.onboarding[`${step.id}History`] = state.choiceHistory[step.id].join(" | ");
}

function shouldDeepenChoice(step) {
    if (!step || !["experience", "conditions"].includes(step.id)) {
        return false;
    }
    // Свой текст считается достаточно точным ответом: его не гоняем через дополнительные карточки.
    if (state.customDrawerStepId === step.id || isCustomStepValue(step, state.onboarding[step.id]) && !isSavedChoiceValue(state.onboarding[step.id])) {
        return false;
    }
    const depth = state.choiceDepth[step.id] || 0;
    return depth < desiredChoiceDepth(step.id);
}

function desiredChoiceDepth(stepId) {
    const goal = (state.onboarding.goal || "").trim();
    const preciseGoal = goal.length >= 150 && /\d|месяц|недел|день|кг|раз|час|минут/i.test(goal);
    if (stepId === "experience") {
        return preciseGoal ? 1 : 2;
    }
    return preciseGoal ? 1 : 2;
}

function splitHistory(value) {
    return String(value || "")
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3);
}

function autosave() {
    window.clearTimeout(autosave.timer);
    autosave.timer = window.setTimeout(() => {
        saveOnboarding().catch(handleBackgroundSaveError);
    }, 500);
}

function queueSuggestionsRefresh() {
    window.clearTimeout(queueSuggestionsRefresh.timer);
    queueSuggestionsRefresh.timer = window.setTimeout(() => {
        refreshSuggestions({renderAfter: false});
    }, 800);
}

function queueImmediateSuggestionsRefresh() {
    window.clearTimeout(queueSuggestionsRefresh.timer);
    refreshSuggestions({renderAfter: true}).catch((error) => {
        console.warn("AI suggestions unavailable", error);
    });
}

function saveOnboardingWithTimeout() {
    return Promise.race([
        saveOnboarding(),
        wait(3500).then(() => {
            throw new Error("Onboarding save timeout");
        })
    ]);
}

async function refreshSuggestions({renderAfter = true, force = false} = {}) {
    if ((state.onboarding.goal || "").trim().length < 24) {
        return;
    }
    const requestKey = currentSuggestionsKey();
    // Кешируем AI-ответы по контексту, чтобы не менять варианты без реального нового ввода.
    if (!force && state.suggestionsKey === requestKey && state.suggestions.goals.length) {
        return;
    }
    if (state.suggestionsRequest) {
        try {
            await state.suggestionsRequest;
        } catch (error) {
            console.warn("AI suggestions unavailable", error);
        }
        if (state.suggestionsKey === requestKey && state.suggestions.goals.length) {
            if (renderAfter) {
                render();
            }
            return;
        }
    }
    state.suggestionsLoading = true;
    if ((steps[state.onboardingStep] || {}).id === "goal") {
        updateGoalTextSuggestions(state.onboarding.goal);
    }
    state.suggestionsRequest = (async () => {
        const suggestions = await loadOnboardingSuggestions();
        if (requestKey !== suggestionsKey()) {
            return;
        }
        state.suggestions = {
            experience: Array.isArray(suggestions.experience) ? suggestions.experience : [],
            conditions: Array.isArray(suggestions.conditions) ? suggestions.conditions : [],
            goals: Array.isArray(suggestions.goals) ? suggestions.goals : [],
            plan: suggestions.plan || null
        };
        state.suggestionsKey = requestKey;
        applySuggestionDefaults();
        const currentStep = steps[state.onboardingStep];
        if (currentStep && currentStep.id === "goal") {
            updateGoalTextSuggestions(state.onboarding.goal);
        }
    })();
    try {
        await state.suggestionsRequest;
    } catch (error) {
        console.warn("AI suggestions unavailable", error);
    } finally {
        state.suggestionsLoading = false;
        state.suggestionsRequest = null;
        if ((steps[state.onboardingStep] || {}).id === "goal") {
            updateGoalTextSuggestions(state.onboarding.goal);
        }
    }
    if (renderAfter) {
        render();
    }
}

function applySuggestionDefaults() {
    ["experience", "conditions"].forEach((id) => {
        const step = steps.find((item) => item.id === id);
        const current = state.onboarding[id] || "";
        if (step && shouldReplaceGeneratedChoice(step, current, id)) {
            state.onboarding[id] = choiceOptionValue(step, 0);
            state.choiceSnapshots[id] = effectiveOptions(step);
        }
    });
    if ((!state.onboarding.selectedGoal || /^goal-(blue|orange|green)$/.test(state.onboarding.selectedGoal)) && state.suggestions.goals.length) {
        state.onboarding.selectedGoal = `${state.suggestions.goals[0].title || "goal"}-0`;
    }
}

function shouldReplaceGeneratedChoice(step, value, id) {
    if (state.choiceTouched[id]) {
        return false;
    }
    if (!value || /^Вариант\s+\d-\d$/.test(value)) {
        return true;
    }
    if ((state.customDrafts[id] || "").trim()) {
        return false;
    }
    return isSavedChoiceValue(value) && isCustomStepValue(step, value);
}

function suggestionsKey() {
    return currentSuggestionsKey();
}

function handleBackgroundSaveError(error) {
    if (error instanceof ApiError && error.status === 401) {
        clearStoredSession();
    }
    console.warn("Unable to save onboarding", error);
}

function clearStoredSession() {
    state.token = "";
    localStorage.removeItem("grindy.token");
}

function blurActiveControl() {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") {
        active.blur();
    }
    setKeyboardOpen(false);
}

function bindKeyboardDismiss() {
    const screen = document.querySelector(".phone-screen");
    if (!screen) {
        return;
    }
    screen.addEventListener("pointerdown", (event) => {
        if (!document.body.classList.contains("keyboard-open")) {
            return;
        }
        if (event.target.closest("textarea, button, .ai-text-suggestions")) {
            return;
        }
        blurActiveControl();
    }, {capture: true});
}

function handleDoneKey(event) {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
        return;
    }
    event.preventDefault();
    blurActiveControl();
}

function keepViewportPinned() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
}

function bindViewport() {
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
            if (!document.body.classList.contains("keyboard-open")) {
                setAppHeight();
            }
            updateKeyboardInset();
        });
        window.visualViewport.addEventListener("scroll", () => updateKeyboardInset());
    }

    window.addEventListener("resize", () => {
        if (!document.body.classList.contains("keyboard-open")) {
            setAppHeight();
        }
        updateKeyboardInset();
    });
}

function setAppHeight() {
    document.documentElement.style.setProperty("--app-height", `${Math.round(window.innerHeight)}px`);
}

function setKeyboardOpen(open) {
    document.body.classList.toggle("keyboard-open", open);
    window.clearTimeout(setKeyboardOpen.timer);
    if (!open) {
        document.documentElement.style.setProperty("--keyboard-inset", "0px");
        keepViewportPinned();
        setKeyboardOpen.timer = window.setTimeout(() => {
            setAppHeight();
            document.documentElement.style.setProperty("--keyboard-inset", "0px");
            keepViewportPinned();
        }, 80);
        return;
    }
    updateKeyboardInset(true);
    if (open) {
        keepViewportPinned();
        setKeyboardOpen.timer = window.setTimeout(() => {
            updateKeyboardInset(true);
            keepViewportPinned();
        }, 320);
    }
}

function updateKeyboardInset(forceOpen = document.body.classList.contains("keyboard-open")) {
    let inset = 0;
    const appHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-height")) || window.innerHeight;
    if (window.visualViewport) {
        inset = Math.max(0, appHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    }
    if (forceOpen && inset < 80) {
        inset = Math.round(appHeight * 0.34);
    }
    document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
}
