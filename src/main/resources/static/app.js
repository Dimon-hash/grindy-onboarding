import {CUSTOM_VALUE} from "./js/config.js";
import {steps} from "./js/steps.js";
import {nodes, state} from "./js/state.js";
import {authenticate, loadCurrentUser, loadOnboardingSuggestions, saveOnboarding} from "./js/api.js";
import {initTelegram, syncTheme, telegram} from "./js/telegram.js";
import {renderStep} from "./js/screens.js";
import {canContinue, choiceOptionValue, isCustomStepValue} from "./js/validators.js";
import {wait} from "./js/utils.js";

initTelegram();
bindViewport();
setAppHeight();
nodes.app.hidden = false;
render();
boot();

async function boot() {
    try {
        if (telegram && telegram.initData) {
            await authenticate({initData: telegram.initData});
        } else if (state.token) {
            await loadCurrentUser();
        } else {
            await authenticate({username: "local_user"});
        }
        loadFromUser();
        state.isReady = true;
        refreshSuggestions({renderAfter: false});
        if (state.pendingSplashTap) {
            finishSplash();
        }
    } catch (error) {
        console.error(error);
        state.isSplash = false;
        nodes.app.hidden = false;
        nodes.onboardingWizard.innerHTML = `<section class="fatal">Не удалось открыть онбординг</section>`;
    }
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
        if (step && isCustomStepValue(step, value) && value !== CUSTOM_VALUE) {
            state.customDrafts[key] = value;
        }
    });
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
    bindChoiceButtons(step);
    bindChooseGoalActions(step);
    bindPlanActions();
    bindCustomOpen(step);
}

function bindNavigation() {
    const next = document.getElementById("next");
    if (next) {
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
        state.onboarding.goal = input.value.slice(0, step.limit);
        if (field) {
            field.classList.toggle("has-value", Boolean(state.onboarding.goal.trim()));
        }
        document.getElementById("counter").textContent = `${state.onboarding.goal.length} / ${step.limit}`;
        next.disabled = !canContinue(step);
        autosave();
        queueSuggestionsRefresh();
    });
}

function bindCustomInput(step) {
    const input = document.getElementById("custom-choice-input");
    if (!input) {
        return;
    }
    const next = document.getElementById("next");
    const layer = input.closest(".native-custom-panel, .native-custom-drawer, .experience-drawer-input-layer");
    input.addEventListener("focus", () => setKeyboardOpen(true));
    input.addEventListener("blur", () => setKeyboardOpen(false));
    input.addEventListener("input", () => {
        const draft = input.value.slice(0, input.maxLength || 220);
        state.customDrafts[step.id] = draft;
        state.onboarding[step.id] = draft.trim() ? draft : CUSTOM_VALUE;
        if (layer) {
            layer.classList.toggle("has-value", Boolean(draft.trim()));
        }
        if (next) {
            next.disabled = !canContinue(step);
        }
        autosave();
    });

    const close = document.getElementById("custom-drawer-close");
    if (close) {
        close.addEventListener("click", () => {
            blurActiveControl();
            closeCustomDrawer(step);
        });
    }
}

function bindChoiceButtons(step) {
    document.querySelectorAll(".choice, .native-choice-card").forEach((button) => {
        button.addEventListener("click", () => {
            blurActiveControl();
            state.customDrawerStepId = "";
            state.onboarding[step.id] = button.dataset.value;
            autosave();
            render();
        });
    });
}

function bindChooseGoalActions(step) {
    const selectGoal = (value) => {
        if (!value || state.onboarding.selectedGoal === value) {
            return;
        }
        blurActiveControl();
        state.goalCardFlip = true;
        state.onboarding.selectedGoal = value;
        autosave();
        render();
        window.setTimeout(() => {
            state.goalCardFlip = false;
        }, 360);
    };

    document.querySelectorAll(".choose-goal-dot").forEach((button) => {
        button.addEventListener("click", () => {
            selectGoal(button.dataset.value);
        });
    });

    document.querySelectorAll(".choose-goal-card-hit-area").forEach((button) => {
        button.addEventListener("click", () => {
            const values = [...document.querySelectorAll(".choose-goal-dot")].map((dot) => dot.dataset.value);
            const currentIndex = Math.max(0, values.indexOf(state.onboarding.selectedGoal));
            const nextIndex = (currentIndex + 1) % values.length;
            selectGoal(values[nextIndex]);
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
        save.addEventListener("click", () => {
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
    const art = document.querySelector(".your-plan-edit-art");
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
        if (art) {
            art.src = filled
                ? "/Your%20Plan,%20Change%20the%20plan,%20Filled.svg?v=20260514-your-plan"
                : "/Your%20Plan,%20Change%20the%20plan.svg?v=20260514-your-plan";
        }
    });
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
        if (!isCustomStepValue(step, current)) {
            state.customPreviousValues[step.id] = current;
        }
        state.customDrafts[step.id] = isCustomStepValue(step, current) && current !== CUSTOM_VALUE
            ? current
            : state.customDrafts[step.id] || "";
        state.onboarding[step.id] = state.customDrafts[step.id] || CUSTOM_VALUE;
        autosave();
        render();
        window.requestAnimationFrame(() => {
            const input = document.getElementById("custom-choice-input");
            if (input) {
                input.focus({preventScroll: true});
            }
        });
    });
}

async function nextStep() {
    const step = steps[state.onboardingStep];
    if (!canContinue(step)) {
        return;
    }
    blurActiveControl();
    if (["goal", "experience", "conditions"].includes(step.id)) {
        await refreshSuggestions({renderAfter: false});
    }
    const showSaving = step.id === "experience" && state.customDrawerStepId !== step.id;
    if (showSaving) {
        state.savingStepId = step.id;
        render();
        await wait(120);
    } else {
        await wait(80);
    }
    try {
        await saveOnboarding();
    } finally {
        state.savingStepId = "";
    }
    if (state.onboardingStep < steps.length - 1) {
        goTo(state.onboardingStep + 1);
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
    const draft = (state.customDrafts[step.id] || "").trim();
    if (!draft && state.onboarding[step.id] === CUSTOM_VALUE) {
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

function autosave() {
    window.clearTimeout(autosave.timer);
    autosave.timer = window.setTimeout(saveOnboarding, 500);
}

function queueSuggestionsRefresh() {
    window.clearTimeout(queueSuggestionsRefresh.timer);
    queueSuggestionsRefresh.timer = window.setTimeout(() => {
        refreshSuggestions({renderAfter: false});
    }, 800);
}

async function refreshSuggestions({renderAfter = true} = {}) {
    if ((state.onboarding.goal || "").trim().length < 80) {
        return;
    }
    if (state.suggestionsRequest) {
        await state.suggestionsRequest;
        if (renderAfter) {
            render();
        }
        return;
    }
    state.suggestionsLoading = true;
    state.suggestionsRequest = (async () => {
        const suggestions = await loadOnboardingSuggestions();
        state.suggestions = {
            experience: Array.isArray(suggestions.experience) ? suggestions.experience : [],
            conditions: Array.isArray(suggestions.conditions) ? suggestions.conditions : [],
            goals: Array.isArray(suggestions.goals) ? suggestions.goals : [],
            plan: suggestions.plan || null
        };
        applySuggestionDefaults();
    })();
    try {
        await state.suggestionsRequest;
    } catch (error) {
        console.warn("AI suggestions unavailable", error);
    } finally {
        state.suggestionsLoading = false;
        state.suggestionsRequest = null;
    }
    if (renderAfter) {
        render();
    }
}

function applySuggestionDefaults() {
    ["experience", "conditions"].forEach((id) => {
        const step = steps.find((item) => item.id === id);
        const current = state.onboarding[id] || "";
        if (step && shouldReplaceGeneratedChoice(current)) {
            state.onboarding[id] = choiceOptionValue(step, 0);
        }
    });
    if ((!state.onboarding.selectedGoal || /^goal-(blue|orange|green)$/.test(state.onboarding.selectedGoal)) && state.suggestions.goals.length) {
        state.onboarding.selectedGoal = `${state.suggestions.goals[0].title || "goal"}-0`;
    }
}

function shouldReplaceGeneratedChoice(value) {
    return !value || /^Вариант\s+\d-\d$/.test(value);
}

function blurActiveControl() {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") {
        active.blur();
    }
    setKeyboardOpen(false);
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
    updateKeyboardInset(open);
    if (open) {
        setKeyboardOpen.timer = window.setTimeout(() => updateKeyboardInset(true), 320);
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
