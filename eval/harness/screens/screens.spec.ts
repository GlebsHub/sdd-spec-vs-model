import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { loadPages, middleVisibleRowName, openClients, rowByName, scrollToEnd, waitForRows } from "./support/app";

const OUT = process.env["SCREENS_OUT"] ?? "./out";

/** Выполняет шаги и снимает экран в любом случае; ошибка шага пишется в screens.jsonl. */
const shot = async (page: Page, name: string, steps: () => Promise<void>) => {
  let error: string | null = null;
  try {
    await steps();
    await page.waitForTimeout(500);
  } catch (caught) {
    error = String(caught instanceof Error ? caught.message : caught).split("\n")[0]?.slice(0, 300) ?? "error";
  }
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  appendFileSync(join(OUT, "screens.jsonl"), `${JSON.stringify({ name, ok: error === null, error })}\n`);
};

test("01-default", async ({ page }) => {
  await shot(page, "01-default", async () => {
    await openClients(page);
    await waitForRows(page);
  });
});

test("02-filtered", async ({ page }) => {
  await shot(page, "02-filtered", async () => {
    await openClients(page, "status=FUNDED&sort=commissionKopecks:desc");
    await waitForRows(page);
  });
});

test("03-after-back", async ({ page }) => {
  await shot(page, "03-after-back", async () => {
    await openClients(page, "status=FUNDED,LEAD&sort=fullName:asc");
    await waitForRows(page);
    await loadPages(page, 3);
    const name = await middleVisibleRowName(page);
    await rowByName(page, name).first().click();
    await page.waitForTimeout(800);
    await page.goBack();
    await waitForRows(page);
  });
});

test("04-nothing-found", async ({ page }) => {
  await shot(page, "04-nothing-found", async () => {
    await openClients(page, "status=LEAD", { mock: "empty" });
    await page.getByText("Ничего не найдено", { exact: true }).waitFor();
  });
});

test("05-next-page-error", async ({ page }) => {
  await shot(page, "05-next-page-error", async () => {
    await openClients(page, "", { mock: "error-next-page" });
    await waitForRows(page);
    await scrollToEnd(page);
    await page.getByText("Не удалось загрузить клиентов", { exact: true }).waitFor();
  });
});
