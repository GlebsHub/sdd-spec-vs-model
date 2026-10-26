import { describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_SORT, formatSort, hasFilters, nextSort, normalizeSearchQuery, toListParams } from "./params";

describe("toListParams", () => {
  it("без параметров — сортировка по умолчанию и без фильтров", () => {
    expect(toListParams({})).toEqual({
      q: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      sort: DEFAULT_CLIENT_SORT,
    });
  });

  it("переводит параметры URL в параметры API", () => {
    expect(
      toListParams({ q: "  Иванов ", status: "FUNDED,LEAD", from: "2026-01-01", to: "2026-03-31", sort: "commissionKopecks:asc" }),
    ).toEqual({
      q: "Иванов",
      status: ["LEAD", "FUNDED"],
      dateFrom: "2026-01-01",
      dateTo: "2026-03-31",
      sort: { field: "commissionKopecks", direction: "asc" },
    });
  });

  it("не передаёт поиск короче 2 символов после trim", () => {
    expect(normalizeSearchQuery(" И ")).toBeUndefined();
    expect(normalizeSearchQuery("")).toBeUndefined();
    expect(normalizeSearchQuery("Ив")).toBe("Ив");
  });

  it("фильтр задан, только если уходит в запрос", () => {
    expect(hasFilters(toListParams({ q: "И", sort: "fullName:asc" }))).toBe(false);
    expect(hasFilters(toListParams({ to: "2026-01-01" }))).toBe(true);
  });
});

describe("сортировка", () => {
  it("цикл клика по заголовку: не отсортирована → desc → asc → desc", () => {
    const first = nextSort(DEFAULT_CLIENT_SORT, "commissionKopecks");
    expect(first).toEqual({ field: "commissionKopecks", direction: "desc" });
    const second = nextSort(first, "commissionKopecks");
    expect(second).toEqual({ field: "commissionKopecks", direction: "asc" });
    expect(nextSort(second, "commissionKopecks")).toEqual({ field: "commissionKopecks", direction: "desc" });
  });

  it("сортировка по умолчанию в URL не пишется", () => {
    expect(formatSort(DEFAULT_CLIENT_SORT)).toBeUndefined();
    expect(formatSort({ field: "registeredAt", direction: "asc" })).toBe("registeredAt:asc");
  });
});
