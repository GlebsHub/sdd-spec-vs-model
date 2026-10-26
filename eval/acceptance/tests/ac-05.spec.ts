import { expect, test } from "@playwright/test";
import {
  STATUS_LABEL,
  apiRequests,
  formatDate,
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

test("AC-05 фильтр по статусу передаётся в запрос", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);

  await selectStatuses(page, [STATUS_LABEL.FUNDED, STATUS_LABEL.INACTIVE]);

  await expect
    .poll(async () => splitList((await apiRequests(page)).at(-1)?.params["status"]))
    .toEqual(["FUNDED", "INACTIVE"]);
  const expected = await oracle(page, { status: "FUNDED,INACTIVE" });
  await expect.poll(async () => (await visibleRowTexts(page, 1))[0]?.[0]).toBe(expected.items[0]?.fullName);
});

test("AC-05 период регистрации передаётся в запрос как dateFrom и dateTo", async ({ page }) => {
  await openClients(page, "from=2025-01-01&to=2025-03-31");
  await waitForRows(page);

  const [first] = await apiRequests(page);
  expect(first?.params["dateFrom"]).toBe("2025-01-01");
  expect(first?.params["dateTo"]).toBe("2025-03-31");

  const expected = await oracle(page, { dateFrom: "2025-01-01", dateTo: "2025-03-31" });
  expect((await visibleRowTexts(page, 1))[0]?.[3]).toBe(formatDate(expected.items[0]?.registeredAt ?? ""));

  const values = await page.getByLabel("Период регистрации").evaluateAll((elements) =>
    elements.flatMap((element) => [
      element instanceof HTMLInputElement ? element.value : "",
      ...[...element.querySelectorAll("input")].map((input) => input.value),
    ]),
  );
  expect(values.join(" ")).toContain("2025");
});

test("AC-05 «Сбросить фильтры» видна только при заданных фильтрах и не сбрасывает сортировку", async ({ page }) => {
  await openClients(page, "sort=commissionKopecks:asc");
  await waitForRows(page);
  await expect(resetButton(page)).toHaveCount(0);

  await selectStatuses(page, [STATUS_LABEL.LEAD]);
  await expect(resetButton(page).first()).toBeVisible();
  await searchInput(page).fill("Ив");
  await expect.poll(() => urlParams(page).get("q")).toBe("Ив");

  await resetButton(page).first().click();

  await expect.poll(() => urlParams(page).get("status")).toBeNull();
  expect(urlParams(page).get("q")).toBeNull();
  expect(urlParams(page).get("from")).toBeNull();
  expect(urlParams(page).get("to")).toBeNull();
  expect(urlParams(page).get("sort")).toBe("commissionKopecks:asc");
  await expect(searchInput(page)).toHaveValue("");
  await expect(resetButton(page)).toHaveCount(0);

  const expected = await oracle(page, { sort: "commissionKopecks:asc" });
  await expect.poll(async () => (await visibleRowTexts(page, 1))[0]?.[0]).toBe(expected.items[0]?.fullName);
});
