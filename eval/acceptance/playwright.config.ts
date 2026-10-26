import { defineConfig, devices } from "@playwright/test";

/**
 * Конфиг скрытой приёмки. Раннер копирует eval/acceptance в <копия>/.acceptance/ и запускает Playwright
 * с этим конфигом: dev-сервер копии поднимается на отдельном порту, конфиг копии не используется.
 */
const PORT = Number(process.env["ACCEPTANCE_PORT"] ?? "5180");

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  globalSetup: "./support/warmup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: Number(process.env["ACCEPTANCE_WORKERS"] ?? "4"),
  retries: 0,
  reporter: [["json", { outputFile: process.env["ACCEPTANCE_REPORT"] ?? "./report.json" }], ["list"]],
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        locale: "ru-RU",
        timezoneId: "Europe/Moscow",
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${String(PORT)} --strictPort`,
    cwd: "..",
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
