/**
 * Сценарии мок-бэкенда.
 *
 * | Сценарий           | Поведение                                                      |
 * |--------------------|----------------------------------------------------------------|
 * | `default`          | обычная работа                                                 |
 * | `error-first-page` | 500 на запросы без `cursor`                                    |
 * | `error-next-page`  | 500 на запросы с `cursor`                                      |
 * | `empty`            | у агента нет клиентов: `total: 0` при любых фильтрах           |
 * | `forbidden`        | 403 на любой запрос                                            |
 * | `network-error`    | сетевой сбой на любой запрос                                   |
 * | `malformed`        | 200 с ответом не по схеме                                      |
 *
 * `delayMs` — задержка каждого ответа, сочетается с любым сценарием.
 * `failTimes` — для сценариев ошибок: сколько раз ошибиться, затем отвечать нормально. `null` — всегда.
 *
 * В браузере (dev): флаги адреса `?mock=<сценарий>&mockDelay=<мс>&mockFailTimes=<n>` при загрузке страницы.
 * Значения запоминаются в sessionStorage; `?mock=default` возвращает обычный режим.
 * Во время работы: `window.__mocks.setMockScenario({...})`.
 * В тестах: `setMockScenario({...})` и `resetMocks()` из `@/mocks`.
 */
export const MOCK_SCENARIO = {
  default: "default",
  errorFirstPage: "error-first-page",
  errorNextPage: "error-next-page",
  empty: "empty",
  forbidden: "forbidden",
  networkError: "network-error",
  malformed: "malformed",
} as const;

export type MockScenario = (typeof MOCK_SCENARIO)[keyof typeof MOCK_SCENARIO];

export type MockSettings = {
  scenario: MockScenario;
  delayMs: number;
  failTimes: number | null;
};

const DEFAULT_SETTINGS: MockSettings = { scenario: MOCK_SCENARIO.default, delayMs: 0, failTimes: null };

let settings: MockSettings = { ...DEFAULT_SETTINGS };
let failuresServed = 0;

export const isMockScenario = (value: string): value is MockScenario =>
  (Object.values(MOCK_SCENARIO) as string[]).includes(value);

export const getMockSettings = (): MockSettings => ({ ...settings });

/** Меняет сценарий. Не переданные поля сохраняют текущие значения. Счётчик ошибок сбрасывается. */
export const setMockScenario = (next: Partial<MockSettings>): void => {
  settings = { ...settings, ...next };
  failuresServed = 0;
};

/**
 * Решает, должен ли текущий запрос завершиться ошибкой сценария, и учитывает её в `failTimes`.
 */
export const shouldFail = (applies: boolean): boolean => {
  if (!applies) {
    return false;
  }
  if (settings.failTimes !== null && failuresServed >= settings.failTimes) {
    return false;
  }
  failuresServed += 1;
  return true;
};

export const resetMockScenario = (): void => {
  settings = { ...DEFAULT_SETTINGS };
  failuresServed = 0;
};
