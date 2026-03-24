import type { PeriodType } from "../types/database";

export const periodLabels: Record<PeriodType, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
};

export const copy = {
  defaults: {
    anonymous: "Аноним",
  },
  errors: {
    missingEnv: "Не заданы VITE_SUPABASE_URL или VITE_SUPABASE_ANON_KEY.",
    profileNotFound:
      "Профиль не найден. Создайте соответствующую запись в таблице `profiles` в Supabase.",
  },
  session: {
    loading: "Загрузка сессии...",
  },
  auth: {
    eyebrow: "TaskDuet MVP",
    title: "Общее планирование для двоих.",
    description:
      "Войдите по email и паролю. Для нового аккаунта автоматически создаётся профиль с инвайт-кодом для пары.",
    modes: {
      "sign-in": "Войти",
      "sign-up": "Создать аккаунт",
    },
    fields: {
      email: "Email",
      password: "Пароль",
      displayName: "Имя",
    },
  },
  app: {
    eyebrow: "TaskDuet",
    sharedTasksTitle: "Общие задачи",
    sharedTasksWithName: (name: string) => `Общие задачи: ${name}`,
    syncing: "Синхронизация",
    live: "Актуально",
    signOut: "Выйти",
  },
  invite: {
    yourCode: "Ваш код",
    description:
      "Отправьте этот код партнёру, чтобы он мог присоединиться и создать общую пару.",
    joinTitle: "Присоединиться к паре",
    codeLabel: "Инвайт-код партнёра",
    codePlaceholder: "ABC123",
    joinButton: "Присоединиться",
  },
  periods: {
    previous: "Назад",
    next: "Вперёд",
  },
  tasks: {
    newTask: "Новая задача",
    fields: {
      title: "Название",
      titlePlaceholder: "Вынести мусор",
    },
    addButton: "Добавить задачу",
    cancelButton: "Отмена",
    openCompactForm: "Добавить задачу",
    column: "Колонка",
    emptyState: "На этот период задач нет.",
  },
} as const;
