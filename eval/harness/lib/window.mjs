import { RUNS_ROOT, WINDOW_GUARD } from "../config.mjs";
import { readUsageWindow } from "./agent.mjs";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Смещение часового пояса относительно UTC в минутах на момент `date`. */
const zoneOffsetMinutes = (date, timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  );
  return (Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - date.getTime()) / 60_000;
};

/**
 * Время сброса окна из строки `/usage`, например «Oct 23 at 3:40pm (Europe/Moscow)» или «4am (Europe/Moscow)».
 * Возвращает Date или null, если формат не распознан.
 */
export const parseResetTime = (text, now = new Date()) => {
  const match = /^(?:([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s+at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\(([^)]+)\))?$/i.exec(text?.trim() ?? "");
  if (!match) return null;
  const [, monthName, day, hourText, minuteText, meridiem, timeZone] = match;
  const hour = (Number(hourText) % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = zoneOffsetMinutes(now, zone);
  const local = new Date(now.getTime() + offset * 60_000);
  const month = monthName ? MONTHS.indexOf(monthName.toLowerCase()) : local.getUTCMonth();
  if (month < 0) return null;
  const dayOfMonth = day ? Number(day) : local.getUTCDate();
  let at = Date.UTC(local.getUTCFullYear(), month, dayOfMonth, hour, Number(minuteText ?? 0)) - offset * 60_000;
  // Без даты — ближайшее такое время впереди; с датой в прошлом году не уходим.
  if (!monthName && at < now.getTime()) at += 24 * 3_600_000;
  return new Date(at);
};

/** Одно и то же окно: `/usage` округляет время сброса и может показать его с разницей в минуту. */
export const sameSessionWindow = (before, after) => {
  const a = parseResetTime(before?.sessionResets ?? null);
  const b = parseResetTime(after?.sessionResets ?? null);
  return a !== null && b !== null && Math.abs(a.getTime() - b.getTime()) <= WINDOW_GUARD.sameWindowToleranceMs;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Хватит ли окна и недели на прогон модели; если окна не хватит — ждём сброса. Неделю не ждём: останавливаемся. */
export const waitForWindowRoom = async ({ model, log }) => {
  const expected = WINDOW_GUARD.expectedPercent[model];
  for (;;) {
    const usage = readUsageWindow({ cwd: RUNS_ROOT });
    if (usage.sessionPercent == null || usage.weekPercent == null) {
      log(`ограничитель: /usage не прочитан (${usage.error ?? "нет процентов"}), запуск без проверки окна`);
      return usage;
    }
    if (usage.weekPercent + expected.week > WINDOW_GUARD.maxPercent) {
      throw new Error(`Недельный лимит: ${String(usage.weekPercent)}% + ~${String(expected.week)}% на прогон > ${String(WINDOW_GUARD.maxPercent)}%. Остановлено до сброса недели`);
    }
    if (usage.sessionPercent + expected.session <= WINDOW_GUARD.maxPercent) {
      log(`ограничитель: окно ${String(usage.sessionPercent)}% + ~${String(expected.session)}% на прогон — запуск`);
      return usage;
    }
    const resetAt = parseResetTime(usage.sessionResets);
    const until = resetAt ? resetAt.getTime() + WINDOW_GUARD.afterResetMs : Date.now() + WINDOW_GUARD.pollMs;
    const waitMs = Math.max(until - Date.now(), 60_000);
    log(
      `ограничитель: окно ${String(usage.sessionPercent)}% + ~${String(expected.session)}% > ${String(WINDOW_GUARD.maxPercent)}%, ` +
        `жду до ${new Date(Date.now() + waitMs).toLocaleString("ru-RU")} (сброс: ${usage.sessionResets ?? "неизвестно"})`,
    );
    await sleep(waitMs);
  }
};
