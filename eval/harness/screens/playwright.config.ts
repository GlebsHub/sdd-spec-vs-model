import { defineConfig, devices } from "@playwright/test";

/** Скриншоты состояний для отчёта. Харнесс копирует папку в <копия>/.screens/ вместе с хелперами приёмки. */
const PORT = Number(process.env["SCREENS_PORT"] ?? "5181");

export default defineConfig({
  testDir: ".",
  testMatch: "screens.spec.ts",
  outputDir: "./test-results",
  globalSetup: "./support/warmup.ts",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${String(PORT)}` },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, locale: "ru-RU", timezoneId: "Europe/Moscow" },
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
