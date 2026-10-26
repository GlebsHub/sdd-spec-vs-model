import { expect, test } from "@playwright/test";
import { STATUS_LABEL, apiRequests, clearRequests, clickHeader, loadPages, oracle, openClients, rowByName, scrollToOffset, scrollTop, selectStatuses, waitForRows } from "../support/app";

const SCROLLED = 2400;

test("AC-06 смена фильтра и смена сортировки загружают первую порцию и прокручивают таблицу к началу", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await loadPages(page, 3);
  await scrollToOffset(page, SCROLLED);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(SCROLLED / 2);

  // Фильтр.
  await clearRequests(page);
  await selectStatuses(page, [STATUS_LABEL.ACCOUNT_OPENED]);
  await expect
    .poll(async () => (await apiRequests(page)).some((request) => request.params["status"] === "ACCOUNT_OPENED" && !("cursor" in request.params)))
    .toBe(true);
  await expect.poll(() => scrollTop(page)).toBeLessThanOrEqual(1);
  const byStatus = await oracle(page, { status: "ACCOUNT_OPENED" });
  await expect(rowByName(page, byStatus.items[0]?.fullName ?? "?")).toBeInViewport();

  // Сортировка.
  await loadPages(page, 3);
  await scrollToOffset(page, SCROLLED);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(SCROLLED / 2);
  await clearRequests(page);
  await clickHeader(page, "Комиссия");
  await expect
    .poll(async () => (await apiRequests(page)).some((request) => request.params["sort"] === "commissionKopecks:desc" && !("cursor" in request.params)))
    .toBe(true);
  await expect.poll(() => scrollTop(page)).toBeLessThanOrEqual(1);
  const bySort = await oracle(page, { status: "ACCOUNT_OPENED", sort: "commissionKopecks:desc" });
  await expect(rowByName(page, bySort.items[0]?.fullName ?? "?")).toBeInViewport();
});
