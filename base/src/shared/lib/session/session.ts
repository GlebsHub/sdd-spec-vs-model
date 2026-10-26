import { create } from "zustand";

export type CurrentAgent = {
  id: string;
  name: string;
};

export const DEFAULT_AGENT_ID = "agent-1";
const AGENT_PARAM = "agent";
const STORAGE_KEY = "demo:agentId";

const toAgent = (id: string): CurrentAgent => ({ id, name: `Агент ${id}` });

/**
 * Идентификатор агента при старте: флаг `?agent=<id>` в адресе, затем sessionStorage, затем значение по умолчанию.
 * Флаг запоминается в sessionStorage и переживает навигацию и перезагрузку.
 */
export const resolveInitialAgentId = (): string => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get(AGENT_PARAM);
    if (fromUrl) {
      window.sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return window.sessionStorage.getItem(STORAGE_KEY) ?? DEFAULT_AGENT_ID;
  } catch {
    return DEFAULT_AGENT_ID;
  }
};

type SessionState = {
  agent: CurrentAgent;
  setAgentId: (id: string) => void;
};

const useSessionStore = create<SessionState>()((set) => ({
  agent: toAgent(DEFAULT_AGENT_ID),
  setAgentId: (id) => {
    set({ agent: toAgent(id) });
  },
}));

/** Задаёт текущего агента. Вызывается при старте приложения и в тестах. */
export const setCurrentAgentId = (id: string): void => {
  useSessionStore.getState().setAgentId(id);
};

/** Текущий агент из сессии приложения. */
export const useCurrentAgent = (): CurrentAgent => useSessionStore((state) => state.agent);
