import { act, fireEvent, getDefaultNormalizer, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_SCENARIO, getClientsDb, getRequestLog, parseClientsQuery, selectClients, setMockScenario } from "@/mocks";
import { renderApp } from "@/test";

const NBSP = "\u00A0";
/** Не схлопывать неразрывные пробелы: формат денег и чисел проверяется точно. */
const exact = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

/** Ожидаемые клиенты по тем же правилам, что у мок-бэкенда. */
const expectedClients = (query = "") =>
  selectClients(getClientsDb(), parseClientsQuery(new URLSearchParams(`limit=50&${query}`)));

const listRequests = () => getRequestLog().filter((request) => request.path === "/api/agent/clients");

const dataRows = () => screen.getAllByRole("row").filter((row) => within(row).queryAllByRole("cell").length > 0 && row.textContent !== "");

const headerNames = () => screen.getAllByRole("columnheader").map((header) => header.textContent);

beforeEach(() => {
  // В jsdom нет раскладки: задаём размер скролл-контейнера, иначе виртуализатор не покажет строк.
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1200);
});

describe("«Мои клиенты»: загрузка и отображение", () => {
  it("показывает скелетон, затем первых клиентов по дате регистрации и общее количество", async () => {
    setMockScenario({ delayMs: 50 });
    await renderApp();
    expect(screen.getAllByRole("row").filter((row) => within(row).queryAllByRole("cell").length > 0)).toHaveLength(10);
    expect(screen.getByLabelText("Поиск по ФИО")).toBeEnabled();

    const [first] = expectedClients();
    expect(await screen.findByRole("cell", { name: first?.fullName })).toBeInTheDocument();
    expect(screen.getByText(`10${NBSP}000`, exact)).toBeInTheDocument();
    expect(listRequests()[0]?.params).toEqual({ limit: "50", sort: "registeredAt:desc" });
  });

  it("колонки, порядок, форматы и видимость по умолчанию", async () => {
    await renderApp();
    await screen.findAllByRole("row");
    await waitFor(() => {
      expect(dataRows().length).toBeGreaterThan(3);
    });
    expect(headerNames()).toEqual(["ФИО", "Телефон", "Статус", "Дата регистрации", "Комиссия"]);

    const [first, second, third] = expectedClients();
    const rows = dataRows();
    expect(rows[0]).toHaveTextContent(first?.phoneMasked ?? "");
    expect(within(rows[0] as HTMLElement).getByText("Пополнил счёт")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText(`12${NBSP}345,67${NBSP}₽`, exact)).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText(`0,05${NBSP}₽`, exact)).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText(`0,00${NBSP}₽`, exact)).toBeInTheDocument();
    expect(second && third).toBeTruthy();
    const date = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(first?.registeredAt ?? ""),
    );
    expect(rows[0]).toHaveTextContent(date);
  });
});

describe("«Мои клиенты»: фильтры и сортировка", () => {
  it("поиск уходит одним запросом через 300 мс после ввода и не уходит короче 2 символов", async () => {
    const { user } = await renderApp();
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    await user.type(screen.getByLabelText("Поиск по ФИО"), "Иванов");
    await waitFor(() => {
      expect(listRequests().some((request) => request.params["q"] === "Иванов")).toBe(true);
    });
    expect(listRequests().filter((request) => "q" in request.params).map((request) => request.params["q"])).toEqual(["Иванов"]);

    await user.clear(screen.getByLabelText("Поиск по ФИО"));
    await user.type(screen.getByLabelText("Поиск по ФИО"), " И ");
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(listRequests().filter((request) => "q" in request.params).map((request) => request.params["q"])).toEqual(["Иванов"]);
  });

  it("статус уходит в запрос, «Сбросить фильтры» видна только с фильтрами и не сбрасывает сортировку", async () => {
    const { user, router } = await renderApp({ url: "/clients?sort=fullName:asc" });
    await screen.findByRole("cell", { name: expectedClients("sort=fullName:asc")[0]?.fullName });
    expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Статус" }));
    await user.click(await screen.findByTitle("Пополнил счёт"));
    await waitFor(() => {
      expect(listRequests().at(-1)?.params).toMatchObject({ status: "FUNDED", sort: "fullName:asc" });
    });

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    // Параметры совпали с исходными: список приходит из кэша, сортировка осталась.
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ sort: "fullName:asc" });
    });
    expect(screen.queryByRole("button", { name: "Сбросить фильтры" })).not.toBeInTheDocument();
  });

  it("сортировка по клику: desc → asc → desc, видна в aria-sort", async () => {
    const { user } = await renderApp();
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    expect(screen.getByRole("columnheader", { name: "Дата регистрации" })).toHaveAttribute("aria-sort", "descending");

    const commission = () => screen.getByRole("columnheader", { name: "Комиссия" });
    await user.click(within(commission()).getByRole("button"));
    await waitFor(() => {
      expect(listRequests().at(-1)?.params["sort"]).toBe("commissionKopecks:desc");
    });
    expect(commission()).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: "Дата регистрации" })).not.toHaveAttribute("aria-sort");

    await user.click(within(commission()).getByRole("button"));
    await waitFor(() => {
      expect(listRequests().at(-1)?.params["sort"]).toBe("commissionKopecks:asc");
    });
    expect(commission()).toHaveAttribute("aria-sort", "ascending");
  });

  it("ссылка с параметрами применяется, некорректные значения игнорируются", async () => {
    await renderApp({ url: "/clients?status=LEAD,FOO&from=2025-01-01&to=2025-13-40&sort=bad:value&q=%D0%98" });
    await waitFor(() => {
      expect(listRequests()[0]?.params).toEqual({ limit: "50", status: "LEAD", dateFrom: "2025-01-01", sort: "registeredAt:desc" });
    });
  });
});

describe("«Мои клиенты»: состояния", () => {
  it("пусто без фильтров", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.empty });
    await renderApp();
    expect(await screen.findByText("У вас пока нет клиентов. Поделитесь реферальной ссылкой, чтобы пригласить первого")).toBeInTheDocument();
  });

  it("пусто с фильтрами: «Ничего не найдено» и сброс", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.empty });
    const { user } = await renderApp({ url: "/clients?status=LEAD" });
    expect(await screen.findByText("Ничего не найдено")).toBeInTheDocument();
    const [, resetInState] = screen.getAllByRole("button", { name: "Сбросить фильтры" });
    await user.click(resetInState as HTMLElement);
    expect(await screen.findByText(/У вас пока нет клиентов/)).toBeInTheDocument();
  });

  it("ошибка первой порции и повтор", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.errorFirstPage, failTimes: 1 });
    const { user } = await renderApp();
    expect(await screen.findByText("Не удалось загрузить клиентов")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("cell", { name: expectedClients()[0]?.fullName })).toBeInTheDocument();
  });

  it("ответ не по схеме — состояние ошибки", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.malformed });
    await renderApp();
    expect(await screen.findByText("Не удалось загрузить клиентов")).toBeInTheDocument();
  });

  it("403 — «Раздел недоступен»", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.forbidden });
    await renderApp();
    expect(await screen.findByText("Раздел недоступен. Обратитесь к персональному менеджеру")).toBeInTheDocument();
  });

  it("догрузка и ошибка догрузки: строки остаются, «Повторить» повторяет только догрузку", async () => {
    setMockScenario({ scenario: MOCK_SCENARIO.errorNextPage, failTimes: 1, delayMs: 30 });
    const { user, container } = await renderApp();
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    const scroller = container.querySelector("[data-scroll-restoration-id]");
    if (!(scroller instanceof HTMLElement)) throw new Error("scroll container not found");
    scroller.scrollTop = 2000;
    fireEvent.scroll(scroller);
    expect(await screen.findByRole("status")).toHaveTextContent("Загружаем ещё…");
    expect(await screen.findByText("Не удалось загрузить клиентов")).toBeInTheDocument();
    expect(dataRows().length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(listRequests().filter((request) => request.status === 200 && "cursor" in request.params)).toHaveLength(1);
    });
    expect(listRequests().filter((request) => !("cursor" in request.params))).toHaveLength(1);
  });
});

describe("«Мои клиенты»: колонки и клавиатура", () => {
  it("скрытие колонки сохраняется для агента, «ФИО» скрыть нельзя, «По умолчанию» сбрасывает", async () => {
    const first = await renderApp({ agentId: "agent-a" });
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    await first.user.click(screen.getByRole("button", { name: "Настроить колонки" }));
    expect(screen.queryByRole("checkbox", { name: "ФИО" })).not.toBeInTheDocument();
    await first.user.click(screen.getByRole("checkbox", { name: "Телефон" }));
    await first.user.click(screen.getByRole("checkbox", { name: "Продуктов" }));
    expect(headerNames()).toEqual(["ФИО", "Статус", "Дата регистрации", "Комиссия", "Продуктов"]);
    first.unmount();

    const again = await renderApp({ agentId: "agent-a" });
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    expect(headerNames()).toEqual(["ФИО", "Статус", "Дата регистрации", "Комиссия", "Продуктов"]);
    await again.user.click(screen.getByRole("button", { name: "Настроить колонки" }));
    await again.user.click(screen.getByRole("button", { name: "По умолчанию" }));
    expect(headerNames()).toEqual(["ФИО", "Телефон", "Статус", "Дата регистрации", "Комиссия"]);
    again.unmount();

    window.localStorage.setItem("clients-table:columns:v1:agent-a", JSON.stringify({ phoneMasked: false }));
    await renderApp({ agentId: "agent-b" });
    await screen.findByRole("cell", { name: expectedClients()[0]?.fullName });
    expect(headerNames()).toContain("Телефон");
  });

  it("строка открывает карточку по клику и по Enter", async () => {
    const { user, router } = await renderApp();
    const [first] = expectedClients();
    const cell = await screen.findByRole("cell", { name: first?.fullName });
    const row = cell.closest("tr");
    if (!row) throw new Error("row not found");
    row.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/clients/${first?.id ?? ""}`);
    });
  });
});
