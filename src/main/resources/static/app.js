const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
const CUSTOM_VALUE = "__custom__";
const APP_VERSION = "20260513-current-state-screen";

if (localStorage.getItem("grindy.uiVersion") !== APP_VERSION) {
    localStorage.removeItem("grindy.token");
    localStorage.removeItem("grindy.step");
    localStorage.removeItem("grindy.onboardingComplete");
    localStorage.setItem("grindy.uiVersion", APP_VERSION);
}

const state = {
    token: localStorage.getItem("grindy.token"),
    user: null,
    isSplash: true,
    isReady: false,
    savingStepId: "",
    pendingSplashTap: false,
    customDrawerStepId: "",
    customDrafts: {
        experience: "",
        conditions: ""
    },
    onboardingStep: normalizeStep(Number(localStorage.getItem("grindy.step") || 1)),
    onboarding: {
        goal: "",
        experience: "",
        conditions: "",
        selectedGoal: "",
        selectedPlan: ""
    }
};

const nodes = {
    app: document.getElementById("app"),
    onboardingWizard: document.getElementById("onboarding-wizard")
};

const steps = [
    {id: "loader", type: "loader"},
    {id: "welcome", type: "welcome"},
    {
        id: "goal",
        type: "textarea",
        title: "Что будем достигать?",
        subtitle: "Подробно опиши цель — мы сделаем\nеё конкретной. Не менее 80 символов.",
        placeholder: "Я хочу...",
        button: "Следующий шаг",
        progress: 26,
        minLength: 80,
        limit: 250
    },
    {
        id: "experience",
        type: "experience",
        title: "Какой у вас опыт?",
        subtitle: "Опиши прошлые попытки:\nчто делал и как долго?",
        button: "Продолжить",
        progress: 59,
        options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
        custom: true
    },
    {
        id: "conditions",
        type: "currentState",
        title: "Внешние условия?",
        subtitle: "Расскажи, в каких условиях\nты находишься сейчас и то, что важно учесть.",
        button: "Продолжить",
        progress: 94,
        options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
        custom: true
    },
    {
        id: "selectedGoal",
        type: "grid",
        title: "Выбери цель",
        subtitle: "Выбери цель, которая выглядит для тебя наиболее подходящей сейчас.",
        button: "Продолжить",
        progress: 139,
        options: ["Вариант 1", "Вариант 2", "Вариант 1", "Вариант 2"]
    },
    {
        id: "selectedPlan",
        type: "grid",
        title: "Твой план к цели",
        subtitle: "Выбери цель, которая выглядит для тебя наиболее подходящей сейчас.",
        button: "Продолжить",
        progress: 139,
        options: ["Вариант 1", "Вариант 2", "Вариант 1", "Вариант 2"]
    }
];

if (telegram) {
    telegram.ready();
    telegram.expand();
    requestTelegramFullscreen();
    window.setTimeout(requestTelegramFullscreen, 300);
    window.addEventListener("pointerdown", requestTelegramFullscreen, {once: true});
    callTelegram("disableVerticalSwipes");
    telegram.setHeaderColor("#0056f9");
    telegram.setBackgroundColor("#0056f9");
}

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

setAppHeight();
nodes.app.hidden = false;
render();
boot();

async function boot() {
    try {
        if (telegram && telegram.initData) {
            await authenticate({initData: telegram.initData});
        } else if (state.token) {
            state.user = await api("/api/me");
            loadFromUser();
        } else {
            await authenticate({username: "local_user"});
        }
        state.isReady = true;
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

async function authenticate(payload) {
    const auth = await api("/api/auth/telegram", {method: "POST", body: payload, auth: false});
    state.token = auth.token;
    state.user = auth.user;
    localStorage.setItem("grindy.token", state.token);
    loadFromUser();
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
    const screenClass = [
        "phone-screen",
        step.type === "loader" ? "is-loader" : "",
        step.type === "welcome" ? "is-welcome" : "",
        step.id === "goal" ? "is-goal" : "",
        step.id === "experience" ? "is-experience" : "",
        step.id === "conditions" ? "is-current-state" : "",
        step.id === state.customDrawerStepId ? "has-custom-drawer" : "",
        state.savingStepId === step.id ? "is-saving" : ""
    ].filter(Boolean).join(" ");
    nodes.onboardingWizard.innerHTML = `
        <section class="${screenClass}">
            ${renderStep(step)}
        </section>
    `;

    if (step.type === "loader") {
        bindSplash();
        return;
    }

    bindStep(step);
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

function renderStep(step) {
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

    return `
        <div class="telegram-chrome" aria-hidden="true">
            <span class="telegram-time">12.27</span>
            <span class="telegram-island"></span>
            <span class="telegram-signal"></span>
            <span class="telegram-wifi"></span>
            <span class="telegram-battery"></span>
            <span class="telegram-close"><span></span>Close</span>
            <span class="telegram-menu"><span></span><i></i></span>
        </div>
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

function bindStep(step) {
    const next = document.getElementById("next");
    if (next) {
        next.addEventListener("click", nextStep);
    }

    const back = document.getElementById("back");
    if (back) {
        back.addEventListener("click", previousStep);
    }

    const input = document.getElementById("goal-input");
    if (input) {
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
        });
    }

    const customChoiceInput = document.getElementById("custom-choice-input");
    if (customChoiceInput) {
        const layer = customChoiceInput.closest(".native-custom-panel, .native-custom-drawer");
        customChoiceInput.addEventListener("focus", () => setKeyboardOpen(true));
        customChoiceInput.addEventListener("blur", () => setKeyboardOpen(false));
        customChoiceInput.addEventListener("input", () => {
            const draft = customChoiceInput.value.slice(0, customChoiceInput.maxLength || 220);
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
    }

    document.querySelectorAll(".choice").forEach((button) => {
        button.addEventListener("click", () => {
            blurActiveControl();
            state.onboarding[step.id] = button.dataset.value;
            autosave();
            render();
        });
    });

    document.querySelectorAll(".native-choice-card").forEach((button) => {
        button.addEventListener("click", () => {
            blurActiveControl();
            state.customDrawerStepId = "";
            state.onboarding[step.id] = button.dataset.value;
            autosave();
            render();
        });
    });

    const custom = document.getElementById("custom");
    if (custom) {
        custom.addEventListener("click", () => {
            blurActiveControl();
            state.customDrawerStepId = step.id;
            const current = state.onboarding[step.id];
            state.customDrafts[step.id] = isCustomStepValue(step, current) && current !== CUSTOM_VALUE
                ? current
                : state.customDrafts[step.id] || "";
            state.onboarding[step.id] = state.customDrafts[step.id] || CUSTOM_VALUE;
            autosave();
            render();
            window.requestAnimationFrame(() => {
                const customInput = document.getElementById("custom-choice-input");
                if (customInput) {
                    customInput.focus({preventScroll: true});
                }
            });
        });
    }
}

async function nextStep() {
    const step = steps[state.onboardingStep];
    if (!canContinue(step)) {
        return;
    }
    blurActiveControl();
    const showSaving = step.id === "experience" && state.customDrawerStepId !== step.id;
    if (showSaving) {
        state.savingStepId = step.id;
        render();
        await wait(120);
    } else {
        await wait(80);
    }
    try {
        await save();
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
    if (step && state.customDrawerStepId === step.id) {
        state.customDrawerStepId = "";
        render();
        return;
    }
    if (state.onboardingStep <= 2) {
        goTo(1);
        return;
    }
    goTo(state.onboardingStep - 1);
}

function goTo(index) {
    state.isSplash = false;
    state.onboardingStep = Math.max(0, Math.min(index, steps.length - 1));
    if ((steps[state.onboardingStep] || {}).id !== state.customDrawerStepId) {
        state.customDrawerStepId = "";
    }
    render();
}

function normalizeStep(step) {
    if (!Number.isFinite(step) || step < 1) {
        return 1;
    }
    return Math.trunc(step);
}

function canContinue(step) {
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
    return Boolean((state.onboarding[step.id] || "").trim());
}

function autosave() {
    window.clearTimeout(autosave.timer);
    autosave.timer = window.setTimeout(save, 500);
}

function blurActiveControl() {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") {
        active.blur();
    }
    setKeyboardOpen(false);
}

function wait(delay) {
    return new Promise((resolve) => window.setTimeout(resolve, delay));
}

async function save() {
    state.user = await api("/api/me/onboarding", {
        method: "PATCH",
        body: state.onboarding
    });
}

async function api(path, options = {}) {
    const headers = options.headers ? {...options.headers} : {};
    if (options.auth !== false && state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function callTelegram(method) {
    try {
        if (telegram && typeof telegram[method] === "function") {
            telegram[method]();
        }
    } catch (error) {
        console.warn(`Telegram ${method} is unavailable`, error);
    }
}

function requestTelegramFullscreen() {
    callTelegram("requestFullscreen");
}

function setAppHeight() {
    document.documentElement.style.setProperty("--app-height", `${Math.round(window.innerHeight)}px`);
}

function syncTheme(step) {
    const color = step && step.type === "loader" ? "#0056f9" : "#ffffff";
    const theme = document.querySelector("meta[name='theme-color']");
    if (theme) {
        theme.setAttribute("content", color);
    }
    if (telegram) {
        try {
            telegram.setHeaderColor(color);
            telegram.setBackgroundColor(color);
        } catch (error) {
            console.warn("Telegram colors are unavailable", error);
        }
    }
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

function experienceOptionValue(step, index) {
    return choiceOptionValue(step, index);
}

function choiceOptionValue(step, index) {
    return `${step.options[index]}-${index}`;
}

function isCustomStepValue(step, value) {
    if (!step || !value) {
        return false;
    }
    return !step.options.some((option, index) => value === choiceOptionValue(step, index));
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}
