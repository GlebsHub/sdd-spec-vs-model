import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** MSW-сервер для Vitest. Запускается в `src/test/setup.ts`. */
export const server = setupServer(...handlers);
