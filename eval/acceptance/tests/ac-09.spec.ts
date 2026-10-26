import { expect, test } from "@playwright/test";
import { apiRequests, dataRows, oracle, openClients, resetButton, rowByName, scrollToEnd, setMockScenario, visibleRowCount, waitForRows } from "../support/app";

const ERROR_TEXT = "Не удалось загрузить клиентов";

test("AC-09 пусто без фильтров", async ({ page }) => {
  await openClients(page, "", { mock: "empty" });
  await expect(page.getByText("У вас пока нет клиентов. Поделитесь реферальной ссылкой, чтобы пригласить первого")).toBeVisible();
});

test("AC-09 пусто с фильтрами: «Ничего не найдено» и «Сбросить фильтры»", async ({ page }) => {
  await openClients(page, "status=LEAD", { mock: "empty" });
  await expect(page.getByText("Ничего не найдено", { exact: true })).toBeVisible();
  await resetButton(page).last().click();
  await expect(page.getByText(/У вас пока нет клиентов/)).toBeVisible();
});

for (const mock of ["error-first-page", "network-error", "malformed"]) {
  test(`AC-09 ошибка первой порции (${mock}) и «Повторить»`, async ({ page }) => {
    await openClients(page, "", { mock });
    await expect(page.getByText(ERROR_TEXT, { exact: true })).toBeVisible();
    await setMockScenario(page, "default");
    await page.getByRole("button", { name: "Повторить" }).click();
    await waitForRows(page);
    await expect(page.getByText(ERROR_TEXT, { exact: true })).toHaveCount(0);
  });
}

test("AC-09 загрузка следующей порции: индикатор «Загружаем ещё…» с ролью status, строки остаются", async ({ page }) => {
  await openClients(page, "", { delay: 1500 });
  await waitForRows(page);
  await scrollToEnd(page);
  const indicator = page.getByRole("status").filter({ hasText: "Загружаем ещё…" });
  await expect(indicator).toBeVisible();
  // Пока идёт догрузка, загруженные строки остаются на экране.
  expect(await visibleRowCount(page)).toBeGreaterThan(0);
  const indicatorTop = (await indicator.boundingBox())?.y ?? 0;
  const lastRowBottom = await dataRows(page).evaluateAll((rows) => Math.max(...rows.map((row) => row.getBoundingClientRect().bottom)));
  expect(indicatorTop).toBeGreaterThanOrEqual(lastRowBottom - 1);
});

test("AC-09 ошибка следующей порции: строки остаются, «Повторить» повторяет только догрузку", async ({ page }) => {
  await openClients(page, "", { mock: "error-next-page" });
  await waitForRows(page);
  const lastLoaded = (await oracle(page)).items.at(-1)?.fullName ?? "?";
  await scrollToEnd(page);
  await expect(page.getByText(ERROR_TEXT, { exact: true })).toBeVisible();
  expect(await dataRows(page).count()).toBeGreaterThan(0);
  await expect(rowByName(page, lastLoaded).first()).toBeVisible();

  await setMockScenario(page, "default");
  const before = await apiRequests(page);
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect.poll(async () => (await apiRequests(page)).length).toBeGreaterThan(before.length);
  const retried = (await apiRequests(page)).slice(before.length);
  expect(retried[0]?.params["cursor"]).toBeDefined();
  expect(retried.every((request) => "cursor" in request.params)).toBe(true);
  await expect(page.getByText(ERROR_TEXT, { exact: true })).toHaveCount(0);
});

test("AC-09 нет доступа (403)", async ({ page }) => {
  await openClients(page, "", { mock: "forbidden" });
  await expect(page.getByText("Раздел недоступен. Обратитесь к персональному менеджеру")).toBeVisible();
});
