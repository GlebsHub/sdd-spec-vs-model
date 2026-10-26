import { notification } from "antd";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, createAppRouter } from "@/app";
import { createQueryClient } from "@/shared/api";
import { resolveInitialAgentId, setCurrentAgentId } from "@/shared/lib/session";

const bootstrap = async (): Promise<void> => {
  if (import.meta.env.DEV) {
    const { startMockWorker } = await import("./mocks/browser");
    await startMockWorker();
  }

  setCurrentAgentId(resolveInitialAgentId());

  const queryClient = createQueryClient({
    onUnauthorized: () => {
      notification.error({ title: "Сессия истекла", description: "Войдите в кабинет снова" });
    },
  });
  const router = createAppRouter({ queryClient });

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element #root not found");
  }
  createRoot(container).render(
    <StrictMode>
      <App queryClient={queryClient} router={router} />
    </StrictMode>,
  );
};

void bootstrap();
