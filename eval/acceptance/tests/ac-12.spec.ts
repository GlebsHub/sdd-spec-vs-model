import { expect, test } from "@playwright/test";
import {
  STATUS_LABEL,
  apiRequests,
  clickHeader,
  columnHeader,
  oracle,
  openClients,
  resetButton,
  rowByName,
  scrollTop,
  scrollToOffset,
  searchInput,
  selectStatuses,
  splitList,
  urlParams,
  waitForRows,
} from "../support/app";

test("AC-12 после перезагрузки восстанавливаются фильтры и сортировка", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  await selectStatuses(page, [STATUS_LABEL.ACCOUNT_OPENED]);
  await clickHeader(page, "Комиссия");
  await clickHeader(page, "Комиссия");
  await searchInput(page).fill("ов");
  await expect.poll(() => urlParams(page).get("q")).toBe("ов");
  await expect.poll(() => urlParams(page).get("sort")).toBe("commissionKopecks:asc");

  await page.reload();
  await waitForRows(page);

  const [first] = await apiRequests(page);
  expect(first?.params["q"]).toBe("ов");
  expect(splitList(first?.params["status"])).toEqual(["ACCOUNT_OPENED"]);
  expect(first?.params["sort"]).toBe("commissionKopecks:asc");
  await expect(searchInput(page)).toHaveValue("ов");
  await expect(columnHeader(page, "Комиссия")).toHaveAttribute("aria-sort", "ascending");
  await expect(resetButton(page).first()).toBeVisible();
});

test("AC-12 после перезагрузки позиция прокрутки не восстанавливается (п. 9.2)", async ({ page }) => {
  // Задержка ответа как в реальной сети: после перезагрузки данные приходят не сразу.
  await openClients(page, "status=LEAD", { delay: 400 });
  await waitForRows(page);
  await scrollToOffset(page, 2200);
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(1500);

  await page.reload();
  await waitForRows(page);
  await page.waitForTimeout(1000);
  expect(await scrollTop(page)).toBeLessThanOrEqual(1);
  const expected = await oracle(page, { status: "LEAD" });
  await expect(rowByName(page, expected.items[0]?.fullName ?? "?")).toBeInViewport();
});
