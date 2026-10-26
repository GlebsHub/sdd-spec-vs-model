import { z } from "zod";

/** Версия формата хранения. Меняется при несовместимом изменении — старые данные игнорируются. */
const STORAGE_VERSION = 1;

export type ColumnVisibility = Record<string, boolean>;

export type ColumnVisibilityConfig = {
  /** Префикс ключа хранилища, например `clients-table`. */
  scope: string;
  /** Видимость по умолчанию для каждой известной колонки. */
  defaults: ColumnVisibility;
  /** Колонки, которые нельзя скрыть. */
  alwaysVisible: readonly string[];
};

const StoredVisibilitySchema = z.record(z.string(), z.boolean());

export const columnVisibilityStorageKey = (scope: string, agentId: string): string =>
  `${scope}:columns:v${String(STORAGE_VERSION)}:${agentId}`;

/** Применяет ограничения: только известные колонки, обязательные всегда видимы. */
export const normalizeVisibility = (
  value: ColumnVisibility,
  { defaults, alwaysVisible }: ColumnVisibilityConfig,
): ColumnVisibility =>
  Object.fromEntries(
    Object.keys(defaults).map((id) => [id, alwaysVisible.includes(id) ? true : (value[id] ?? defaults[id] ?? true)]),
  );

export const readColumnVisibility = (agentId: string, config: ColumnVisibilityConfig): ColumnVisibility => {
  try {
    const raw = window.localStorage.getItem(columnVisibilityStorageKey(config.scope, agentId));
    if (raw === null) {
      return normalizeVisibility({}, config);
    }
    const parsed = StoredVisibilitySchema.safeParse(JSON.parse(raw));
    return normalizeVisibility(parsed.success ? parsed.data : {}, config);
  } catch {
    return normalizeVisibility({}, config);
  }
};

export const writeColumnVisibility = (agentId: string, config: ColumnVisibilityConfig, value: ColumnVisibility): void => {
  try {
    window.localStorage.setItem(columnVisibilityStorageKey(config.scope, agentId), JSON.stringify(value));
  } catch {
    // Хранилище недоступно (приватный режим, квота): настройка живёт до перезагрузки.
  }
};

export const clearColumnVisibility = (agentId: string, config: ColumnVisibilityConfig): void => {
  try {
    window.localStorage.removeItem(columnVisibilityStorageKey(config.scope, agentId));
  } catch {
    // См. writeColumnVisibility.
  }
};
