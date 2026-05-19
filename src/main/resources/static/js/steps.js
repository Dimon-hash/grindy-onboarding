// Ordered onboarding route definition. Numeric indexes are stored in localStorage as grindy.step.
export const steps = [
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
        subtitle: "Опиши прошлые попытки именно с этой целью:\nчто делал и как долго?",
        button: "Продолжить",
        progress: 59,
        options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
        custom: true
    },
    {
        id: "conditions",
        type: "currentState",
        title: "Внешние условия?",
        subtitle: "Расскажи, что в твоей жизни\nважно учесть для этой цели.",
        button: "Продолжить",
        progress: 94,
        options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
        custom: true
    },
    {
        id: "selectedGoal",
        type: "chooseGoal",
        title: "Выбери цель",
        subtitle: "Выбери цель, которая выглядит для тебя наиболее подходящей сейчас.",
        button: "Продолжить",
        progress: 139,
        options: ["goal-blue", "goal-orange", "goal-green"]
    },
    {
        id: "selectedPlan",
        type: "yourPlan",
        title: "Твой план к цели",
        button: "Сохранить и начать"
    }
];
