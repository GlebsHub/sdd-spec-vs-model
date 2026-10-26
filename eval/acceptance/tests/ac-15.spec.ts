import { type Page, expect, test } from "@playwright/test";
import { apiRequests, bodyRows, openClients, scrollToEnd, scrollToOffset, uniqueRequests, waitForRows } from "../support/app";

const TOTAL_PAGES = 200;
const MAX_ROWS = 60;

/** Загруженные порции: уникальные успешные запросы (StrictMode в dev может повторить первый запрос). */
const loadedPages = async (page: Page) => uniqueRequests((await apiRequests(page)).filter((request) => request.status === 200)).length;

test("AC-15 при 10 000 загруженных строк в DOM не более 60 строк таблицы", async ({ page }) => {
  test.setTimeout(240_000);
  await openClients(page);
  await waitForRows(page);

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    if ((await loadedPages(page)) >= TOTAL_PAGES) {
      break;
    }
    await scrollToEnd(page);
    await page.waitForTimeout(40);
  }
  await expect.poll(() => loadedPages(page)).toBe(TOTAL_PAGES);

  await scrollToEnd(page);
  await page.waitForTimeout(300);
  expect(await bodyRows(page).count()).toBeGreaterThan(0);
  expect(await bodyRows(page).count()).toBeLessThanOrEqual(MAX_ROWS);

  await scrollToOffset(page, 200_000);
  await page.waitForTimeout(300);
  expect(await bodyRows(page).count()).toBeLessThanOrEqual(MAX_ROWS);

  await scrollToOffset(page, 0);
  await page.waitForTimeout(300);
  expect(await bodyRows(page).count()).toBeGreaterThan(0);
  expect(await bodyRows(page).count()).toBeLessThanOrEqual(MAX_ROWS);
});
