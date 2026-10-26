import { expect, test } from "@playwright/test";
import {
  STATUS_LABEL,
  apiRequests,
  clickHeader,
  columnHeader,
  oracle,
  openClients,
  resetButton,
  searchInput,
  selectStatuses,
  splitList,
  urlParams,
  visibleRowTexts,
  waitForRows,
} from "../support/app";

test("AC-10 фильтры и сортировка отражаются в адресной строке, сортировка по умолчанию не пишется", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  expect(urlParams(page).get("sort")).toBeNull();

  await selectStatuses(page, [STATUS_LABEL.LEAD, STATUS_LABEL.FUNDED]);
  await expect.poll(() => splitList(urlParams(page).get("status"))).toEqual(["FUNDED", "LEAD"]);

  await clickHeader(page, "Комиссия");
  await expect.poll(() => urlParams(page).get("sort")).toBe("commissionKopecks:desc");

  await searchInput(page).fill("Иванов");
  await expect.poll(() => urlParams(page).get("q")).toBe("Иванов");
});

test("AC-10 ссылка с параметрами открывает то же состояние", async ({ page }) => {
  await openClients(page, "q=Иванов&status=LEAD,FUNDED&from=2024-01-01&to=2025-12-31&sort=commissionKopecks:asc");
  await waitForRows(page);

  const [first] = await apiRequests(page);
  expect(first?.params["q"]).toBe("Иванов");
  expect(splitList(first?.params["status"])).toEqual(["FUNDED", "LEAD"]);
  expect(first?.params["dateFrom"]).toBe("2024-01-01");
  expect(first?.params["dateTo"]).toBe("2025-12-31");
  expect(first?.params["sort"]).toBe("commissionKopecks:asc");

  await expect(searchInput(page)).toHaveValue("Иванов");
  await expect(columnHeader(page, "Комиссия")).toHaveAttribute("aria-sort", "ascending");
  await expect(resetButton(page).first()).toBeVisible();
  const expected = await oracle(page, { q: "Иванов", status: "LEAD,FUNDED", dateFrom: "2024-01-01", dateTo: "2025-12-31", sort: "commissionKopecks:asc" });
  expect((await visibleRowTexts(page, 1))[0]?.[0]).toBe(expected.items[0]?.fullName);
});

test("AC-10 некорректные значения параметров игнорируются", async ({ page }) => {
  await openClients(page, "status=FOO&sort=phoneMasked:sideways&from=2025-13-45&to=вчера");
  await waitForRows(page);

  const [first] = await apiRequests(page);
  expect(first?.status).toBe(200);
  expect(first?.params["status"]).toBeUndefined();
  expect(first?.params["dateFrom"]).toBeUndefined();
  expect(first?.params["dateTo"]).toBeUndefined();
  expect([undefined, "registeredAt:desc"]).toContain(first?.params["sort"]);
  await expect(columnHeader(page, "Дата регистрации")).toHaveAttribute("aria-sort", "descending");
  const expected = await oracle(page);
  expect((await visibleRowTexts(page, 1))[0]?.[0]).toBe(expected.items[0]?.fullName);
});
