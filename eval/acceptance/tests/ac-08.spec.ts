import { expect, test } from "@playwright/test";
import { PAGE_SIZE, apiRequests, oracleAll, openClients, rowByName, scrollToEnd, uniqueRequests, waitForRows } from "../support/app";

const pageRequests = async (page: import("@playwright/test").Page) => uniqueRequests(await apiRequests(page));

const FILTER = { status: "INACTIVE", dateFrom: "2024-01-01", dateTo: "2024-12-31" };

test("AC-08 прокрутка к концу подгружает порции, загрузка прекращается при nextCursor = null", async ({ page }) => {
  await openClients(page, "status=INACTIVE&from=2024-01-01&to=2024-12-31");
  await waitForRows(page);
  const all = await oracleAll(page, FILTER);
  const pages = Math.ceil(all.length / PAGE_SIZE);
  expect(pages).toBeGreaterThan(3);

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await scrollToEnd(page);
    await page.waitForTimeout(150);
    if ((await pageRequests(page)).length >= pages) {
      break;
    }
  }
  await expect.poll(async () => (await pageRequests(page)).length).toBe(pages);
  const requests = await pageRequests(page);
  expect(requests.filter((request) => "cursor" in request.params)).toHaveLength(pages - 1);

  await scrollToEnd(page);
  await expect(rowByName(page, all.at(-1)?.fullName ?? "?")).toBeInViewport();

  // Конец списка: новые запросы не уходят.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await scrollToEnd(page);
    await page.waitForTimeout(150);
  }
  expect(await pageRequests(page)).toHaveLength(pages);
});
