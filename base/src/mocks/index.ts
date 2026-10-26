import { clearRequestLog } from "./requestLog";
import { resetMockScenario } from "./scenarios";

export { handlers } from "./handlers";
export { CLIENTS_ENDPOINT } from "./clientsHandler";
export { MOCK_CLIENTS_COUNT, MOCK_REFERENCE_DATE, MOCK_SEED, createClientsDb, getClientsDb } from "./db";
export { DEFAULT_SORT, parseClientsQuery, selectClients } from "./clientsQuery";
export { MOCK_SCENARIO, getMockSettings, resetMockScenario, setMockScenario } from "./scenarios";
export type { MockScenario, MockSettings } from "./scenarios";
export { clearRequestLog, getRequestLog } from "./requestLog";
export type { LoggedRequest } from "./requestLog";

/** Сбрасывает сценарий и журнал запросов. Вызывается после каждого теста. */
export const resetMocks = (): void => {
  resetMockScenario();
  clearRequestLog();
};
