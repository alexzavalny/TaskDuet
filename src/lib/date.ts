import type { PeriodType } from "../types/database";

const locale = "ru-RU";

const asDate = (value: Date | string) =>
  typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);

const pad = (value: number) => value.toString().padStart(2, "0");

export const formatDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const startOfPeriod = (value: Date | string, periodType: PeriodType) => {
  const date = asDate(value);

  if (periodType === "day") {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  if (periodType === "week") {
    const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = copy.getDay();
    const delta = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + delta);
    return copy;
  }

  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const normalizePeriodAnchor = (
  value: Date | string,
  periodType: PeriodType,
) => formatDateInput(startOfPeriod(value, periodType));

export const shiftPeriod = (
  anchor: string,
  periodType: PeriodType,
  direction: -1 | 1,
) => {
  const date = startOfPeriod(anchor, periodType);

  if (periodType === "day") {
    date.setDate(date.getDate() + direction);
  } else if (periodType === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
  }

  return normalizePeriodAnchor(date, periodType);
};

export const formatPeriodLabel = (anchor: string, periodType: PeriodType) => {
  const date = startOfPeriod(anchor, periodType);

  if (periodType === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date);
  }

  if (periodType === "week") {
    const end = new Date(date);
    end.setDate(end.getDate() + 6);

    return `${new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(date)} - ${new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(end)}`;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
};

export const isTaskVisibleForPeriod = (
  taskAnchor: string,
  taskCompleted: boolean,
  taskCompletedAt: string | null,
  selectedAnchor: string,
  periodType: PeriodType,
) => {
  if (taskCompleted) {
    if (!taskCompletedAt) {
      return false;
    }

    return normalizePeriodAnchor(taskCompletedAt, periodType) === selectedAnchor;
  }

  return taskAnchor <= selectedAnchor;
};
