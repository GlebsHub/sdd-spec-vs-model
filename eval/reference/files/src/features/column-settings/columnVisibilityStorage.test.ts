import { afterEach, describe, expect, it, vi } from "vitest";
import { columnVisibilityStorageKey, readColumnVisibility, writeColumnVisibility } from "./columnVisibilityStorage";
import type { ColumnVisibilityConfig } from "./columnVisibilityStorage";

const config: ColumnVisibilityConfig = {
  scope: "test-table",
  defaults: { name: true, phone: true, extra: false },
  alwaysVisible: ["name"],
};

describe("видимость колонок в localStorage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("без сохранённых настроек — значения по умолчанию", () => {
    expect(readColumnVisibility("agent-1", config)).toEqual({ name: true, phone: true, extra: false });
  });

  it("настройки хранятся отдельно для каждого агента", () => {
    writeColumnVisibility("agent-1", config, { name: true, phone: false, extra: true });
    expect(readColumnVisibility("agent-1", config)).toEqual({ name: true, phone: false, extra: true });
    expect(readColumnVisibility("agent-2", config)).toEqual({ name: true, phone: true, extra: false });
  });

  it("ключ хранилища содержит версию", () => {
    expect(columnVisibilityStorageKey("test-table", "agent-1")).toBe("test-table:columns:v1:agent-1");
  });

  it("невалидные данные и неизвестные колонки — по умолчанию; обязательную колонку скрыть нельзя", () => {
    const key = columnVisibilityStorageKey(config.scope, "agent-1");
    window.localStorage.setItem(key, "{not json");
    expect(readColumnVisibility("agent-1", config)).toEqual(config.defaults);
    window.localStorage.setItem(key, JSON.stringify({ phone: "no" }));
    expect(readColumnVisibility("agent-1", config)).toEqual(config.defaults);
    window.localStorage.setItem(key, JSON.stringify({ name: false, unknown: true, phone: false }));
    expect(readColumnVisibility("agent-1", config)).toEqual({ name: true, phone: false, extra: false });
  });

  it("ошибка доступа к хранилищу не ломает чтение и запись", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(readColumnVisibility("agent-1", config)).toEqual(config.defaults);
    expect(() => {
      writeColumnVisibility("agent-1", config, config.defaults);
    }).not.toThrow();
  });
});
