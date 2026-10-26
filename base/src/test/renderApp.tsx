import { createMemoryHistory } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App, createAppRouter } from "@/app";
import { createQueryClient } from "@/shared/api";
import { DEFAULT_AGENT_ID, setCurrentAgentId } from "@/shared/lib/session";

type RenderAppOptions = {
  /** Начальный адрес, например `/clients?status=LEAD`. */
  url?: string;
  /** Текущий агент сессии. */
  agentId?: string;
};

/** Рендерит приложение целиком: маршрут по адресу, свежий QueryClient, MSW-бэкенд из `src/mocks`. */
export const renderApp = async ({ url = "/clients", agentId = DEFAULT_AGENT_ID }: RenderAppOptions = {}) => {
  setCurrentAgentId(agentId);
  const queryClient = createQueryClient();
  const router = createAppRouter({ queryClient, history: createMemoryHistory({ initialEntries: [url] }) });
  await router.load();
  const user = userEvent.setup();
  const view = render(<App queryClient={queryClient} router={router} />);
  return { ...view, user, router, queryClient };
};
