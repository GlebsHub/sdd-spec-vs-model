import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";
import { clearRequestLog, getRequestLog } from "./requestLog";
import { getMockSettings, isMockScenario, resetMockScenario, setMockScenario } from "./scenarios";
import type { MockSettings } from "./scenarios";

const STORAGE_KEY = "demo:mockSettings";

const readSettingsFromUrl = (): Partial<MockSettings> | undefined => {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("mock") && !params.has("mockDelay") && !params.has("mockFailTimes")) {
    return undefined;
  }
  const next: Partial<MockSettings> = {};
  const scenario = params.get("mock");
  if (scenario !== null && isMockScenario(scenario)) {
    next.scenario = scenario;
  }
  const delayMs = Number(params.get("mockDelay"));
  next.delayMs = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const failTimes = params.get("mockFailTimes");
  next.failTimes = failTimes !== null && /^\d+$/.test(failTimes) ? Number(failTimes) : null;
  return next;
};

const loadSettings = (): Partial<MockSettings> => {
  try {
    const fromUrl = readSettingsFromUrl();
    if (fromUrl) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromUrl));
      return fromUrl;
    }
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    // Значение пишет только этот модуль; при порче сценарий проверяется ниже.
    const parsed = stored ? (JSON.parse(stored) as Partial<MockSettings>) : {};
    return parsed.scenario === undefined || isMockScenario(parsed.scenario) ? parsed : {};
  } catch {
    return {};
  }
};

declare global {
  interface Window {
    __mocks?: {
      setMockScenario: typeof setMockScenario;
      resetMockScenario: typeof resetMockScenario;
      getMockSettings: typeof getMockSettings;
      getRequestLog: typeof getRequestLog;
      clearRequestLog: typeof clearRequestLog;
    };
  }
}

/** Запуск мок-бэкенда в браузере (только dev). */
export const startMockWorker = async (): Promise<void> => {
  setMockScenario(loadSettings());
  window.__mocks = { setMockScenario, resetMockScenario, getMockSettings, getRequestLog, clearRequestLog };
  await setupWorker(...handlers).start({ onUnhandledRequest: "bypass", quiet: false });
};
