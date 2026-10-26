import { expect, test } from "@playwright/test";

test("приложение открывается с мок-бэкендом", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole("heading", { name: "Мои клиенты" })).toBeVisible();

  const response = await page.evaluate(async () => {
    const result = await fetch("/api/agent/clients?limit=50");
    return (await result.json()) as { items: unknown[]; total: number };
  });
  expect(response.items).toHaveLength(50);
  expect(response.total).toBe(10_000);
});

test("карточка клиента: «Назад» возвращает к списку", async ({ page }) => {
  await page.goto("/clients");
  await page.goto("/clients/42");
  await expect(page.getByRole("heading", { name: "Карточка клиента" })).toBeVisible();
  await page.getByRole("button", { name: "Назад" }).click();
  await expect(page).toHaveURL(/\/clients$/);
});
