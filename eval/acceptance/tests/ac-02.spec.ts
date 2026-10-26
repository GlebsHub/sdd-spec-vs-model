import { expect, test } from "@playwright/test";
import { DEFAULT_COLUMNS, STATUS_LABEL, cells, dataRows, formatDate, formatMoney, headerTexts, oracle, openClients, visibleRowTexts, waitForRows } from "../support/app";

test("AC-02 колонки по умолчанию: порядок, видимость, форматы", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);

  expect(await headerTexts(page)).toEqual(DEFAULT_COLUMNS);

  const expected = (await oracle(page)).items.slice(0, 6);
  const shown = await visibleRowTexts(page, 6);
  expect(shown).toEqual(
    expected.map((client) => [
      client.fullName,
      client.phoneMasked,
      STATUS_LABEL[client.status],
      formatDate(client.registeredAt),
      formatMoney(client.commissionKopecks),
    ]),
  );
});

test("AC-02 комиссия выровнена по правому краю колонки", async ({ page }) => {
  await openClients(page);
  await waitForRows(page);
  const commission = cells(dataRows(page).first()).nth(4);
  const gaps = await commission.evaluate((cell) => {
    const range = document.createRange();
    range.selectNodeContents(cell);
    const text = range.getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    return { left: text.left - box.left, right: box.right - text.right };
  });
  expect(gaps.right).toBeLessThan(gaps.left);
});
