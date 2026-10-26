import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { apiRequests, loadPages, middleVisibleRowName, openClients, rowByName, splitList, urlParams, waitForRows } from "../support/app";

const SEARCH = "status=FUNDED,LEAD&sort=fullName:asc";

/** Фильтры, прокрутка на несколько порций, переход в карточку по строке посередине экрана. */
const goToCardFromScrolledList = async (page: Page) => {
  await openClients(page, SEARCH);
  await waitForRows(page);
  await loadPages(page, 3);
  const name = await middleVisibleRowName(page);
  expect(name).not.toBe("");
  const requestsBefore = (await apiRequests(page)).length;
  await rowByName(page, name).first().click();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/clients\/[^/]+$/);
  return { name, requestsBefore };
};

const expectRestored = async (page: Page, name: string) => {
  await expect.poll(() => new URL(page.url()).pathname).toBe("/clients");
  expect(splitList(urlParams(page).get("status"))).toEqual(["FUNDED", "LEAD"]);
  expect(urlParams(page).get("sort")).toBe("fullName:asc");
  await expect(rowByName(page, name).first()).toBeInViewport();
};

test("AC-11 «Назад» браузера: фильтры, сортировка, строки без повторного запроса, строка перехода видна", async ({ page }) => {
  const { name, requestsBefore } = await goToCardFromScrolledList(page);
  await page.goBack();
  await expectRestored(page, name);
  await page.waitForTimeout(500);
  expect((await apiRequests(page)).length).toBe(requestsBefore);
});

test("AC-11 кнопка «Назад» приложения: то же восстановление", async ({ page }) => {
  const { name, requestsBefore } = await goToCardFromScrolledList(page);
  await page.getByRole("button", { name: "Назад" }).click();
  await expectRestored(page, name);
  await page.waitForTimeout(500);
  expect((await apiRequests(page)).length).toBe(requestsBefore);
});

test("AC-11 возврат позже 60 секунд: строки видны сразу и обновляются в фоне", async ({ page }) => {
  await page.clock.install();
  const { name, requestsBefore } = await goToCardFromScrolledList(page);
  await page.clock.fastForward("01:05");
  await page.goBack();
  await expectRestored(page, name);
  await expect.poll(async () => (await apiRequests(page)).length).toBeGreaterThan(requestsBefore);
});
