import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { columnToggle } from "./app";

export { DEFAULT_COLUMNS, columnToggle, headerTexts, openClients, waitForRows } from "./app";

/** Открывает настройки колонок и ждёт, пока появится хотя бы один переключатель. */
export const openClientSettingsReady = async (page: Page) => {
  await page.getByRole("button", { name: "Настроить колонки" }).click();
  await expect(columnToggle(page, "Телефон")).toBeVisible();
};
