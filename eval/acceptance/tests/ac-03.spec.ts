import { expect, test } from "@playwright/test";
import { NBSP, oracle, openClients, visibleRowTexts, waitForRows } from "../support/app";

test("AC-03 денежный формат: 1234567, 5 и 0 копеек", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);

  // Три самых новых клиента мок-бэкенда имеют контрольные суммы.
  const expected = (await oracle(page)).items.slice(0, 3).map((client) => client.commissionKopecks);
  expect(expected).toEqual([1_234_567, 5, 0]);

  const shown = (await visibleRowTexts(page, 3)).map((row) => row[4]);
  expect(shown).toEqual([`12${NBSP}345,67${NBSP}₽`, `0,05${NBSP}₽`, `0,00${NBSP}₽`]);
});
