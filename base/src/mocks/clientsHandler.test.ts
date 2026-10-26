import { describe, expect, it } from "vitest";
import { ClientListResponseSchema } from "@/shared/api";
import { MOCK_CLIENTS_COUNT, MOCK_SCENARIO, createClientsDb, getRequestLog, setMockScenario } from "@/mocks";

const request = async (query: string): Promise<{ status: number; body: unknown }> => {
  const response = await fetch(new URL(`/api/agent/clients?${query}`, window.location.origin));
  return { status: response.status, body: await response.json().catch(() => undefined) };
};

const page = async (query: string) => {
  const { status, body } = await request(query);
  expect(status).toBe(200);
  return ClientListResponseSchema.parse(body);
};

describe("мок GET /api/agent/clients", () => {
  it("детерминирован: одинаковый seed — одинаковые данные", () => {
    expect(createClientsDb()).toEqual(createClientsDb());
    expect(createClientsDb()).toHaveLength(MOCK_CLIENTS_COUNT);
  });

  it("дата регистрации совпадает в UTC и МСК", () => {
    for (const client of createClientsDb()) {
      const hour = new Date(client.registeredAt).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(6);
      expect(hour).toBeLessThan(21);
    }
  });

  it("по умолчанию отдаёт первую порцию по дате регистрации по убыванию", async () => {
    const { items, total, nextCursor } = await page("limit=50");
    expect(items).toHaveLength(50);
    expect(total).toBe(MOCK_CLIENTS_COUNT);
    expect(nextCursor).not.toBeNull();
    const dates = items.map((client) => client.registeredAt);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(items.slice(0, 3).map((client) => client.commissionKopecks)).toEqual([1_234_567, 5, 0]);
  });

  it("курсорная пагинация проходит весь список без пропусков и повторов", async () => {
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `limit=100&status=FUNDED&cursor=${cursor}` : "limit=100&status=FUNDED";
      const result = await page(query);
      result.items.forEach((client) => seen.add(client.id));
      cursor = result.nextCursor;
      pages += 1;
      expect(result.items.every((client) => client.status === "FUNDED")).toBe(true);
    } while (cursor);
    const expected = createClientsDb().filter((client) => client.status === "FUNDED").length;
    expect(seen.size).toBe(expected);
    expect(pages).toBe(Math.ceil(expected / 100));
  });

  it("фильтрует по поиску, статусам и периоду и считает total с учётом фильтров", async () => {
    const result = await page("limit=50&q=%D0%B8%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2&status=LEAD,FUNDED&dateFrom=2025-01-01&dateTo=2025-12-31");
    const expected = createClientsDb().filter(
      (client) =>
        client.fullName.toLowerCase().includes("иванов") &&
        ["LEAD", "FUNDED"].includes(client.status) &&
        client.registeredAt.slice(0, 10) >= "2025-01-01" &&
        client.registeredAt.slice(0, 10) <= "2025-12-31",
    );
    expect(result.total).toBe(expected.length);
    expect(result.items.map((client) => client.id).sort()).toEqual(expected.map((client) => client.id).sort());
  });

  it("сортирует по комиссии по возрастанию", async () => {
    const { items } = await page("limit=50&sort=commissionKopecks:asc");
    const values = items.map((client) => client.commissionKopecks);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  it.each([
    ["без limit", ""],
    ["limit вне диапазона", "limit=0"],
    ["q короче 2 символов", "limit=50&q=%20%D0%B0%20"],
    ["неизвестный статус", "limit=50&status=LEAD,UNKNOWN"],
    ["статус повторным параметром", "limit=50&status=LEAD&status=FUNDED"],
    ["некорректная дата", "limit=50&dateFrom=2026-02-30"],
    ["некорректная сортировка", "limit=50&sort=phoneMasked:asc"],
    ["битый курсор", "limit=50&cursor=garbage"],
  ])("400: %s", async (_, query) => {
    expect((await request(query)).status).toBe(400);
  });

  it("400 на курсор, выданный для других фильтров", async () => {
    const { nextCursor } = await page("limit=50");
    expect((await request(`limit=50&status=LEAD&cursor=${String(nextCursor)}`)).status).toBe(400);
  });

  it("сценарий error-next-page ломает только догрузку, failTimes ограничивает число ошибок", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.errorNextPage, failTimes: 1 });
    const { nextCursor } = await page("limit=50");
    expect((await request(`limit=50&cursor=${String(nextCursor)}`)).status).toBe(500);
    expect((await request(`limit=50&cursor=${String(nextCursor)}`)).status).toBe(200);
  });

  it.each([
    [MOCK_SCENARIO.errorFirstPage, 500],
    [MOCK_SCENARIO.forbidden, 403],
  ])("сценарий %s отвечает %i", async (scenario, status) => {
    setMockScenario({ scenario });
    expect((await request("limit=50")).status).toBe(status);
  });

  it("сценарий empty отдаёт пустой список", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.empty });
    expect(await page("limit=50")).toEqual({ items: [], nextCursor: null, total: 0 });
  });

  it("сценарий malformed отдаёт ответ не по схеме", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.malformed });
    const { body } = await request("limit=50");
    expect(ClientListResponseSchema.safeParse(body).success).toBe(false);
  });

  it("сценарий network-error даёт сетевой сбой", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.networkError });
    await expect(request("limit=50")).rejects.toThrow();
  });

  it("журнал запросов сохраняет параметры", async () => {
    await page("limit=50&status=LEAD");
    expect(getRequestLog()).toEqual([
      { method: "GET", path: "/api/agent/clients", params: { limit: "50", status: "LEAD" }, status: 200 },
    ]);
  });
});
