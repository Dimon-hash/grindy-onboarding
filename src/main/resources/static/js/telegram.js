// Telegram Mini App adapter; every Telegram-specific call is isolated here.
export const telegram = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

export function initTelegram() {
    if (!telegram) {
        return;
    }
    telegram.ready();
    telegram.expand();
    requestTelegramFullscreen();
    window.setTimeout(requestTelegramFullscreen, 300);
    window.addEventListener("pointerdown", requestTelegramFullscreen, {once: true});
    callTelegram("disableVerticalSwipes");
    telegram.setHeaderColor("#0056f9");
    telegram.setBackgroundColor("#0056f9");
}

export function syncTheme(step) {
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

export function callTelegram(method) {
    try {
        if (telegram && typeof telegram[method] === "function") {
            telegram[method]();
        }
    } catch (error) {
        console.warn(`Telegram ${method} is unavailable`, error);
    }
}

export function requestTelegramFullscreen() {
    callTelegram("requestFullscreen");
}
