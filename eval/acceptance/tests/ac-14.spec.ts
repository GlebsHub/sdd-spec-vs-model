import { expect, test } from "@playwright/test";
import { STATUS_LABEL, bodyRows, cells, oracle, openClients, searchInput, table, waitForRows } from "../support/app";

test("AC-14 у полей фильтров есть доступные подписи", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await expect(searchInput(page)).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Статус" }).or(page.getByRole("group", { name: "Статус" })).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Период регистрации").first()).toBeVisible();
});

test("AC-14 таблица: семантика таблицы, статус передаётся текстом", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await expect(table(page)).toBeVisible();
  const headers = await table(page).getByRole("columnheader").count();
  expect(headers).toBeGreaterThanOrEqual(5);
  const firstRow = bodyRows(page).first();
  await expect(cells(firstRow)).toHaveCount(headers);
  const [first] = (await oracle(page)).items;
  await expect(firstRow).toContainText(STATUS_LABEL[first?.status ?? "LEAD"]);
});

test("AC-14 строка доступна по Tab, Enter открывает карточку этого клиента", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  const expected = (await oracle(page)).items;

  await searchInput(page).focus();
  let focusedName = "";
  for (let step = 0; step < 60 && focusedName === ""; step += 1) {
    await page.keyboard.press("Tab");
    focusedName = await page.evaluate(() => {
      const row = document.activeElement?.closest('[role="row"], tr');
      const cell = row?.querySelector('[role="cell"], [role="gridcell"], td');
      return (cell as HTMLElement | null | undefined)?.innerText.trim() ?? "";
    });
  }
  expect(focusedName).not.toBe("");

  await page.keyboard.press("Enter");
  const client = expected.find((item) => item.fullName === focusedName);
  expect(client).toBeDefined();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/clients/${client?.id ?? ""}`);
});
