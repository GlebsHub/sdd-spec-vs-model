import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type LoggedRequest = { path: string; params: Record<string, string>; status: number };

const requests = (page: Page) =>
  page.evaluate(() => (window.__mocks?.getRequestLog() ?? []) as unknown as LoggedRequest[]);

const table = (page: Page) => page.getByRole("table", { name: "Клиенты" });
const dataRows = (page: Page) => table(page).getByRole("row").filter({ has: page.getByRole("cell") });
const scroller = (page: Page) => page.locator("[data-scroll-restoration-id='clients-table']");

const scrollBy = async (page: Page, delta: number) => {
  await table(page).hover();
  await page.mouse.wheel(0, delta);
};

const scrollTop = (page: Page) => scroller(page).evaluate((element) => element.scrollTop);

test.beforeEach(async ({ page }) => {
  await page.goto("/clients?mock=default");
  await expect(dataRows(page).first()).toBeVisible();
});

test("прокрутка догружает следующие порции", async ({ page }) => {
  for (let i = 0; i < 6; i += 1) {
    await scrollBy(page, 2000);
    await page.waitForTimeout(100);
  }
  await expect.poll(async () => (await requests(page)).filter((request) => "cursor" in request.params).length).toBeGreaterThan(1);
  expect(await dataRows(page).count()).toBeLessThanOrEqual(60);
});

test("переход в карточку и «назад»: фильтры, строки и прокрутка восстанавливаются без запроса", async ({ page }) => {
  await page.goto("/clients?sort=fullName:asc&status=FUNDED");
  await expect(dataRows(page).first()).toBeVisible();
  for (let i = 0; i < 4; i += 1) {
    await scrollBy(page, 1500);
    await page.waitForTimeout(150);
  }
  const row = dataRows(page).nth(12);
  await row.scrollIntoViewIfNeeded();
  const name = (await row.getByRole("cell").first().textContent()) ?? "";
  const offset = await scrollTop(page);
  const before = (await requests(page)).length;

  await row.click();
  await expect(page.getByRole("heading", { name: "Карточка клиента" })).toBeVisible();
  await page.goBack();

  await expect(page.getByRole("cell", { name, exact: true })).toBeInViewport();
  expect(await scrollTop(page)).toBe(offset);
  expect(new URL(page.url()).searchParams.get("status")).toBe("FUNDED");
  expect((await requests(page)).length).toBe(before);

  await page.getByRole("cell", { name, exact: true }).click();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("cell", { name, exact: true })).toBeInViewport();
});

test("после перезагрузки фильтры восстанавливаются, а прокрутка — нет", async ({ page }) => {
  await page.goto("/clients?status=LEAD&sort=commissionKopecks:asc");
  await expect(dataRows(page).first()).toBeVisible();
  await scrollBy(page, 3000);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);

  await page.reload();
  await expect(dataRows(page).first()).toBeInViewport();
  expect(await scrollTop(page)).toBe(0);
  await expect(page.getByRole("columnheader", { name: "Комиссия" })).toHaveAttribute("aria-sort", "ascending");
  await expect(page.getByRole("button", { name: "Сбросить фильтры" })).toBeVisible();
});

test("смена фильтра возвращает прокрутку к началу", async ({ page }) => {
  await scrollBy(page, 2000);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(0);
  await page.getByRole("columnheader", { name: "ФИО" }).getByRole("button").click();
  await expect.poll(() => scrollTop(page)).toBe(0);
});
