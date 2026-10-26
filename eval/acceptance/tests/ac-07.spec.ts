import { expect, test } from "@playwright/test";
import { apiRequests, clickHeader, columnHeader, oracle, openClients, urlParams, visibleRowTexts, waitForRows } from "../support/app";

const lastSort = async (page: import("@playwright/test").Page) => (await apiRequests(page)).at(-1)?.params["sort"];

test("AC-07 сортировка по умолчанию отражена в aria-sort заголовка «Дата регистрации»", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await expect(columnHeader(page, "Дата регистрации")).toHaveAttribute("aria-sort", "descending");
  for (const name of ["ФИО", "Комиссия"]) {
    await expect(columnHeader(page, name)).not.toHaveAttribute("aria-sort", /ascending|descending/);
  }
});

test("AC-07 клик по заголовку: desc → asc → desc, в запросе и в aria-sort", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);

  await clickHeader(page, "Комиссия");
  await expect.poll(() => lastSort(page)).toBe("commissionKopecks:desc");
  await expect(columnHeader(page, "Комиссия")).toHaveAttribute("aria-sort", "descending");
  await expect(columnHeader(page, "Дата регистрации")).not.toHaveAttribute("aria-sort", /ascending|descending/);

  await clickHeader(page, "Комиссия");
  await expect.poll(() => lastSort(page)).toBe("commissionKopecks:asc");
  await expect(columnHeader(page, "Комиссия")).toHaveAttribute("aria-sort", "ascending");

  // Возврат к уже загруженной сортировке может прийти из кэша без запроса — проверяем адрес и порядок строк.
  await clickHeader(page, "Комиссия");
  await expect(columnHeader(page, "Комиссия")).toHaveAttribute("aria-sort", "descending");
  await expect.poll(() => urlParams(page).get("sort")).toBe("commissionKopecks:desc");
  const expected = await oracle(page, { sort: "commissionKopecks:desc" });
  await expect.poll(async () => (await visibleRowTexts(page, 1))[0]?.[0]).toBe(expected.items[0]?.fullName);

  await clickHeader(page, "ФИО");
  await expect.poll(() => lastSort(page)).toBe("fullName:desc");
  await expect(columnHeader(page, "ФИО")).toHaveAttribute("aria-sort", "descending");
});

test("AC-07 несортируемая колонка не меняет сортировку", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  const firstPageRequests = async () => (await apiRequests(page)).filter((request) => !("cursor" in request.params)).length;
  const before = await firstPageRequests();
  await clickHeader(page, "Телефон");
  await page.waitForTimeout(500);
  expect(await firstPageRequests()).toBe(before);
  await expect(columnHeader(page, "Дата регистрации")).toHaveAttribute("aria-sort", "descending");
});
