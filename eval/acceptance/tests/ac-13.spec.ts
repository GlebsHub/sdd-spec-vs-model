import { expect, test } from "@playwright/test";
import { DEFAULT_COLUMNS, columnToggle, headerTexts, openClientSettingsReady, openClients, waitForRows } from "../support/columns";

test("AC-13 скрытая колонка сохраняется между сессиями, не попадает в адрес, у другого агента своя настройка", async ({ page, context }) => {
  await openClients(page, "", { agent: "agent-1" });
  await waitForRows(page);
  const urlBefore = page.url();

  await openClientSettingsReady(page);
  await columnToggle(page, "Телефон").click();
  await page.keyboard.press("Escape");
  await expect.poll(() => headerTexts(page)).toEqual(DEFAULT_COLUMNS.filter((name) => name !== "Телефон"));
  expect(page.url()).toBe(urlBefore);

  await page.reload();
  await waitForRows(page);
  expect(await headerTexts(page)).not.toContain("Телефон");

  // Новая вкладка того же устройства.
  const second = await context.newPage();
  await openClients(second, "", { agent: "agent-1" });
  await waitForRows(second);
  expect(await headerTexts(second)).not.toContain("Телефон");

  // Другой агент на том же устройстве.
  const other = await context.newPage();
  await openClients(other, "", { agent: "agent-2" });
  await waitForRows(other);
  expect(await headerTexts(other)).toEqual(DEFAULT_COLUMNS);
});

test("AC-13 «ФИО» скрыть нельзя, «По умолчанию» возвращает исходный набор", async ({ page }) => {
  await openClients(page, "", { agent: "agent-3" });
  await waitForRows(page);
  await openClientSettingsReady(page);

  const fullNameToggles = columnToggle(page, "ФИО");
  for (let index = 0; index < (await fullNameToggles.count()); index += 1) {
    await expect(fullNameToggles.nth(index)).toBeDisabled();
  }

  await columnToggle(page, "Продуктов").click();
  await columnToggle(page, "Статус").click();
  await expect.poll(() => headerTexts(page)).toEqual(["ФИО", "Телефон", "Дата регистрации", "Комиссия", "Продуктов"]);

  await page.getByRole("button", { name: "По умолчанию" }).click();
  await expect.poll(() => headerTexts(page)).toEqual(DEFAULT_COLUMNS);
});
