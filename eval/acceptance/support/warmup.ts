import { chromium } from "@playwright/test";
import type { FullConfig } from "@playwright/test";

/**
 * Прогрев dev-сервера: при первом открытии Vite находит новые зависимости, пересобирает их
 * и перезагружает страницу. Делаем это до тестов, иначе перезагрузка попадёт в середину теста.
 */
export default async function warmup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    return;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const path of ["/clients?mock=default&mockDelay=0", "/clients/warmup", "/clients?mock=default&mockDelay=0"]) {
      await page.goto(`${baseURL}${path}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
    }
  } finally {
    await browser.close();
  }
}
