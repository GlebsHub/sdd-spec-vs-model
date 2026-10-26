import { expect, test } from "@playwright/test";
import { apiRequests, clearRequests, oracle, openClients, rowByName, searchInput, waitForRows } from "../support/app";

/** Значения q в запросах первой порции (догрузка следующих порций к поиску не относится). */
const searchQueries = async (page: import("@playwright/test").Page) =>
  (await apiRequests(page))
    .filter((request) => "q" in request.params && !("cursor" in request.params))
    .map((request) => request.params["q"]);

test("AC-04 посимвольный ввод «Иванов» — ровно один запрос с q=Иванов после паузы 300 мс", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await clearRequests(page);

  await searchInput(page).click();
  await page.keyboard.type("Иванов", { delay: 80 });
  const typedAt = Date.now();
  const immediately = await searchQueries(page);
  if (Date.now() - typedAt < 200) {
    // Сразу после последнего символа запроса ещё быть не должно: он уходит через 300 мс.
    expect(immediately).toEqual([]);
  }

  await page.waitForTimeout(1200);
  expect(await searchQueries(page)).toEqual(["Иванов"]);

  const expected = await oracle(page, { q: "Иванов" });
  await expect(rowByName(page, expected.items[0]?.fullName ?? "?")).toBeVisible();
});

test("AC-04 строка короче 2 символов после удаления пробелов не отправляется", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await clearRequests(page);

  await searchInput(page).fill(" И ");
  await page.waitForTimeout(1000);
  expect(await searchQueries(page)).toEqual([]);
});
