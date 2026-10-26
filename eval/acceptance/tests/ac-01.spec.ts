import { expect, test } from "@playwright/test";
import { PAGE_SIZE, apiRequests, digitsOf, headingAreaText, nonHeaderRows, oracle, openClients, searchInput, visibleRowTexts, waitForRows } from "../support/app";

test("AC-01 скелетон на 10 строк при доступной панели фильтров, затем первые клиенты по дате регистрации и total в заголовке", async ({ page }) => {
  await openClients(page, "", { delay: 2000 });

  // Первичная загрузка: 10 строк без данных, фильтры доступны.
  await expect(nonHeaderRows(page)).toHaveCount(10);
  for (const text of await nonHeaderRows(page).allInnerTexts()) {
    expect(text.trim()).toBe("");
  }
  await expect(searchInput(page)).toBeEditable();

  await waitForRows(page);
  const expected = await oracle(page);
  const shown = await visibleRowTexts(page, 8);
  expect(shown.map((row) => row[0])).toEqual(expected.items.slice(0, 8).map((client) => client.fullName));

  const [first] = await apiRequests(page);
  expect(first?.params["limit"]).toBe(String(PAGE_SIZE));
  expect(first?.params["cursor"]).toBeUndefined();
  expect([undefined, "registeredAt:desc"]).toContain(first?.params["sort"]);

  expect(digitsOf(await headingAreaText(page))).toContain(String(expected.total));
});
