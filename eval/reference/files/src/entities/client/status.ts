import { CLIENT_STATUS } from "@/shared/api";
import type { ClientStatus } from "@/shared/api";
import type { StatusTokens } from "@/shared/ui";

/** Тексты статусов (п. 4.2). Статус всегда передаётся текстом. */
export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  [CLIENT_STATUS.LEAD]: "Зарегистрирован",
  [CLIENT_STATUS.ACCOUNT_OPENED]: "Открыл счёт",
  [CLIENT_STATUS.FUNDED]: "Пополнил счёт",
  [CLIENT_STATUS.INACTIVE]: "Неактивен",
};

/** Цвет тега — дополнительный признак, токены темы (п. 4.2). */
export const CLIENT_STATUS_COLOR_TOKEN: Record<ClientStatus, keyof StatusTokens> = {
  [CLIENT_STATUS.LEAD]: "colorStatusNeutral",
  [CLIENT_STATUS.ACCOUNT_OPENED]: "colorStatusInfo",
  [CLIENT_STATUS.FUNDED]: "colorStatusSuccess",
  [CLIENT_STATUS.INACTIVE]: "colorStatusMuted",
};

export const CLIENT_STATUS_OPTIONS = Object.values(CLIENT_STATUS).map((value) => ({
  value,
  label: CLIENT_STATUS_LABEL[value],
}));
