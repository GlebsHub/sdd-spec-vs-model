import { expect } from "@playwright/test";
import type { ElementHandle, Locator, Page } from "@playwright/test";

/**
 * Хелперы приёмки. Опираются только на то, что задано в спецификации (тексты, подписи, роли, aria-атрибуты),
 * и на контракт стенда: мок-бэкенд, его флаги `?mock=…` и журнал запросов `window.__mocks`.
 */

export const NBSP = " ";
export const PAGE_SIZE = 50;

export type Client = {
  id: string;
  fullName: string;
  phoneMasked: string;
  status: "LEAD" | "ACCOUNT_OPENED" | "FUNDED" | "INACTIVE";
  registeredAt: string;
  commissionKopecks: number;
  productsCount: number;
};

export type ClientPage = { items: Client[]; nextCursor: string | null; total: number };

export type LoggedRequest = { method: string; path: string; params: Record<string, string | string[]>; status: number };

declare global {
  interface Window {
    __mocks?: {
      getRequestLog: () => readonly LoggedRequest[];
      clearRequestLog: () => void;
      setMockScenario: (settings: { scenario?: string; delayMs?: number; failTimes?: number | null }) => void;
    };
  }
}

export const STATUS_LABEL: Record<Client["status"], string> = {
  LEAD: "Зарегистрирован",
  ACCOUNT_OPENED: "Открыл счёт",
  FUNDED: "Пополнил счёт",
  INACTIVE: "Неактивен",
};

export const DEFAULT_COLUMNS = ["ФИО", "Телефон", "Статус", "Дата регистрации", "Комиссия"];

/** Денежный формат п. 4.3, независимая реализация для сверки. */
export const formatMoney = (kopecks: number): string => {
  const rubles = String(Math.trunc(kopecks / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rubles},${String(kopecks % 100).padStart(2, "0")}${NBSP}₽`;
};

/** `ДД.ММ.ГГГГ` в часовом поясе пользователя (браузер приёмки — Europe/Moscow). */
export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );

export const digitsOf = (text: string): string => text.replace(/\D/g, "");

type OpenOptions = {
  /** Сценарий мок-бэкенда. */
  mock?: string;
  delay?: number;
  failTimes?: number;
  agent?: string;
};

/** Открывает раздел с параметрами адреса и явно заданным сценарием мока. */
export const openClients = async (page: Page, search = "", { mock = "default", delay = 0, failTimes, agent }: OpenOptions = {}) => {
  const params = new URLSearchParams(search);
  params.set("mock", mock);
  params.set("mockDelay", String(delay));
  if (failTimes !== undefined) {
    params.set("mockFailTimes", String(failTimes));
  }
  if (agent !== undefined) {
    params.set("agent", agent);
  }
  await page.goto(`/clients?${params.toString()}`);
};

/** Параметры адресной строки раздела. */
export const urlParams = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

export const splitList = (value: string | string[] | null | undefined): string[] =>
  (Array.isArray(value) ? value.join(",") : (value ?? "")).split(",").filter(Boolean).sort();

const ORACLE_MARK = "__acceptance_oracle";

/** Запросы приложения к списку клиентов, без запросов самой приёмки. */
export const apiRequests = async (page: Page): Promise<LoggedRequest[]> => {
  const log = await page.evaluate(() => [...(window.__mocks?.getRequestLog() ?? [])]);
  return log.filter((request) => request.path === "/api/agent/clients" && !(ORACLE_MARK in request.params));
};

export const clearRequests = (page: Page) => page.evaluate(() => window.__mocks?.clearRequestLog());

/**
 * Уникальные запросы. В dev-режиме React StrictMode монтирует компоненты дважды, и первый запрос
 * может быть отменён и отправлен повторно с теми же параметрами — это не ошибка реализации.
 */
export const uniqueRequests = (requests: LoggedRequest[]): LoggedRequest[] => {
  const seen = new Set<string>();
  return requests.filter((request) => {
    const key = JSON.stringify(Object.entries(request.params).sort());
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/** Переключает сценарий мок-бэкенда во время работы страницы. */
export const setMockScenario = (page: Page, scenario: string) =>
  page.evaluate((value) => window.__mocks?.setMockScenario({ scenario: value, failTimes: null }), scenario);

/** Ожидаемый ответ: тот же мок-бэкенд, запрос делает сама приёмка. */
export const oracle = (page: Page, query: Record<string, string> = {}): Promise<ClientPage> =>
  page.evaluate(
    async ({ query, mark }) => {
      const params = new URLSearchParams({ limit: "50", ...query, [mark]: "1" });
      const response = await fetch(`/api/agent/clients?${params.toString()}`);
      return (await response.json()) as ClientPage;
    },
    { query, mark: ORACLE_MARK },
  );

/** Все записи по запросу: проходит курсоры до конца. */
export const oracleAll = async (page: Page, query: Record<string, string> = {}): Promise<Client[]> => {
  const items: Client[] = [];
  let cursor: string | null = null;
  do {
    const result: ClientPage = await oracle(page, { ...query, limit: "100", ...(cursor ? { cursor } : {}) });
    items.push(...result.items);
    cursor = result.nextCursor;
  } while (cursor);
  return items;
};

export const table = (page: Page): Locator => page.getByRole("table").or(page.getByRole("grid")).first();

const cellRole = (scope: Page | Locator) => scope.getByRole("cell").or(scope.getByRole("gridcell"));

/** Строки таблицы с ячейками (без строки заголовков). */
export const bodyRows = (page: Page): Locator => table(page).getByRole("row").filter({ has: cellRole(page) });

/**
 * Строки таблицы, кроме строк заголовка. Для скелетона первичной загрузки (AC-01): спека требует
 * «скелетон таблицы на 10 строк», но не ячейки внутри строк-заглушек.
 */
export const nonHeaderRows = (page: Page): Locator => table(page).getByRole("row").filter({ hasNot: page.getByRole("columnheader") });

/**
 * Строки с данными: непустой текст и не меньше двух ячеек. Служебные строки внутри таблицы
 * (индикатор догрузки, ошибка догрузки на всю ширину) имеют одну ячейку и строками данных не считаются.
 */
export const dataRows = (page: Page): Locator =>
  bodyRows(page)
    .filter({ hasText: /\S/ })
    .filter({ has: page.getByRole("cell").or(page.getByRole("gridcell")).nth(1) });

export const rowByName = (page: Page, name: string): Locator =>
  dataRows(page).filter({ has: cellRole(page).filter({ hasText: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`) }) });

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const cells = (row: Locator): Locator => row.getByRole("cell").or(row.getByRole("gridcell"));

export const columnHeader = (page: Page, name: string): Locator => table(page).getByRole("columnheader", { name, exact: true });

/** Видимые заголовки колонок по порядку. */
export const headerTexts = async (page: Page): Promise<string[]> =>
  (await table(page).getByRole("columnheader").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim());

/** Тексты ячеек строк в порядке на экране (виртуализированные строки в DOM могут идти не по порядку). */
export const visibleRowTexts = async (page: Page, count: number): Promise<string[][]> => {
  const rows = await dataRows(page).evaluateAll((elements) =>
    elements
      .map((row) => ({
        top: row.getBoundingClientRect().top,
        cells: [...row.querySelectorAll('[role="cell"], [role="gridcell"], td')].map((cell) =>
          (cell as HTMLElement).innerText.replace(/[ \t\n]+/g, " ").trim(),
        ),
      }))
      .sort((a, b) => a.top - b.top),
  );
  return rows.slice(0, count).map((row) => row.cells);
};

/** Ждёт, пока на экране появятся строки с данными. */
export const waitForRows = async (page: Page) => {
  await expect(dataRows(page).first()).toBeVisible();
};

/** Прокручиваемая область таблицы: ближайший прокручиваемый предок строки, иначе документ. */
export const scroller = (page: Page): Promise<ElementHandle<Element>> =>
  dataRows(page)
    .first()
    .evaluateHandle((row) => {
      let element: Element | null = row.parentElement;
      while (element) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) {
          return element;
        }
        element = element.parentElement;
      }
      return document.scrollingElement ?? document.documentElement;
    });

export const scrollTop = async (page: Page): Promise<number> => (await scroller(page)).evaluate((element) => element.scrollTop);

export const scrollToOffset = async (page: Page, offset: number): Promise<void> => {
  await (await scroller(page)).evaluate((element, value) => {
    element.scrollTop = value;
  }, offset);
};

export const scrollToEnd = async (page: Page): Promise<void> => {
  await (await scroller(page)).evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
};

/** Прокрутка колесом мыши над таблицей — как пользователь. */
export const wheel = async (page: Page, deltaY: number) => {
  await dataRows(page).first().hover();
  await page.mouse.wheel(0, deltaY);
};

/** Прокручивает к концу, пока не будет загружено не меньше `pages` порций. */
export const loadPages = async (page: Page, pages: number) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const loaded = (await apiRequests(page)).filter((request) => request.status === 200).length;
    if (loaded >= pages) {
      return;
    }
    await scrollToEnd(page);
    await page.waitForTimeout(150);
  }
  throw new Error(`Не удалось загрузить ${String(pages)} порций прокруткой`);
};

/** Сколько строк с данными видно в области таблицы (не под заголовком и не за краем). */
export const visibleRowCount = async (page: Page): Promise<number> =>
  (await scroller(page)).evaluate((element) => {
    const box =
      element === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : element.getBoundingClientRect();
    const header = element.querySelector('[role="columnheader"], th');
    const top = Math.max(box.top, header ? header.getBoundingClientRect().bottom : box.top);
    return [...element.querySelectorAll('[role="row"], tr')].filter((row) => {
      const rect = row.getBoundingClientRect();
      const cell = row.querySelector('[role="cell"], [role="gridcell"], td');
      const cellCount = row.querySelectorAll('[role="cell"], [role="gridcell"], td').length;
      return cell !== null && cellCount >= 2 && (row as HTMLElement).innerText.trim() !== "" && rect.bottom > top && rect.top < box.bottom;
    }).length;
  });

/** ФИО строки посередине видимой области таблицы (строка видна целиком, не под заголовком). */
export const middleVisibleRowName = async (page: Page): Promise<string> =>
  (await scroller(page)).evaluate((element) => {
    const box =
      element === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : element.getBoundingClientRect();
    const header = element.querySelector('[role="columnheader"], th');
    const top = Math.max(box.top, header ? header.getBoundingClientRect().bottom : box.top);
    const rows = [...element.querySelectorAll('[role="row"], tr')]
      .map((row) => ({
        rect: row.getBoundingClientRect(),
        cell: row.querySelector('[role="cell"], [role="gridcell"], td'),
        cellCount: row.querySelectorAll('[role="cell"], [role="gridcell"], td').length,
      }))
      .filter(({ rect, cell, cellCount }) => cell !== null && cellCount >= 2 && rect.top >= top && rect.bottom <= box.bottom)
      .sort((a, b) => a.rect.top - b.rect.top);
    const middle = rows[Math.floor(rows.length / 2)];
    return (middle?.cell as HTMLElement | null | undefined)?.innerText.trim() ?? "";
  });

/** Клик по заголовку колонки: по кнопке внутри, если она есть, иначе по самому заголовку. */
export const clickHeader = async (page: Page, name: string) => {
  const header = columnHeader(page, name);
  const button = header.getByRole("button");
  await ((await button.count()) > 0 ? button.first() : header).click();
};

/**
 * Выбор пункта в открытом выпадающем списке так, как это сделал бы пользователь мышью:
 * видимый `option` с этим именем; иначе видимый элемент с точным текстом пункта вне таблицы и вне самого поля
 * (AntD Select не даёт видимым пунктам роль option); иначе ввод текста и Enter.
 */
const OPTION_WAIT_MS = 5000;

/** Видимый пункт списка: `option` с этим именем, иначе элемент с точным текстом вне таблицы и вне поля. */
const findVisibleOption = async (page: Page, label: string): Promise<Locator | null> => {
  const option = page.getByRole("option", { name: label, exact: true }).filter({ visible: true });
  if ((await option.count()) > 0) {
    return option.first();
  }
  const candidates = page.getByText(label, { exact: true }).filter({ visible: true });
  for (let index = 0; index < (await candidates.count()); index += 1) {
    const candidate = candidates.nth(index);
    const outside = await candidate.evaluate(
      (element) => element.closest('table, [role="table"], [role="grid"], [role="combobox"]') === null,
    );
    if (outside) {
      return candidate;
    }
  }
  return null;
};

/**
 * Кликает пункт, дождавшись, пока выпадающий список отрисуется: сразу после клика по полю пункта ещё нет,
 * а `count()` не ждёт. Ввод текста — только если пункт так и не появился.
 */
const clickVisibleOption = async (page: Page, label: string) => {
  const deadline = Date.now() + OPTION_WAIT_MS;
  for (;;) {
    const option = await findVisibleOption(page, label);
    if (option) {
      await option.click();
      return;
    }
    if (Date.now() > deadline) {
      break;
    }
    await page.waitForTimeout(50);
  }
  await page.keyboard.type(label);
  await page.keyboard.press("Enter");
};

/**
 * Множественный выбор статусов с подписью «Статус» (п. 5). Спека требует множественный выбор, а не контрол:
 * combobox — открыть и кликнуть пункты (см. clickVisibleOption);
 * иначе — группа чекбоксов с той же подписью.
 */
export const selectStatuses = async (page: Page, labels: string[]) => {
  const combobox = page.getByRole("combobox", { name: "Статус" });
  if ((await combobox.count()) > 0) {
    await combobox.first().click();
    for (const label of labels) {
      await clickVisibleOption(page, label);
    }
    await page.keyboard.press("Escape");
    return;
  }
  const group = page.getByRole("group", { name: "Статус" });
  for (const label of labels) {
    await group.getByRole("checkbox", { name: label, exact: true }).check();
  }
};

/** Поле поиска по ФИО. */
export const searchInput = (page: Page): Locator => page.getByLabel("Поиск по ФИО", { exact: true });

/** Кнопка «Сбросить фильтры» (их может быть две: в панели и в пустом состоянии). */
export const resetButton = (page: Page): Locator => page.getByRole("button", { name: "Сбросить фильтры" });

/** Переключатель видимости колонки в настройках. */
export const columnToggle = (page: Page, name: string): Locator =>
  page
    .getByRole("checkbox", { name, exact: true })
    .or(page.getByRole("switch", { name, exact: true }))
    .or(page.getByRole("menuitemcheckbox", { name, exact: true }));

export const openColumnSettings = async (page: Page) => {
  await page.getByRole("button", { name: "Настроить колонки" }).click();
};

/** Текст возле заголовка «Мои клиенты»: сам заголовок и его ближайший контейнер. */
export const headingAreaText = async (page: Page): Promise<string> => {
  const heading = page.getByRole("heading", { name: /Мои клиенты/ }).first();
  await expect(heading).toBeVisible();
  return heading.evaluate((element) => `${element.textContent ?? ""} ${element.parentElement?.textContent ?? ""}`);
};
