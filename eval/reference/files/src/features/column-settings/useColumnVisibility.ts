import { useCallback, useState } from "react";
import {
  clearColumnVisibility,
  normalizeVisibility,
  readColumnVisibility,
  writeColumnVisibility,
} from "./columnVisibilityStorage";
import type { ColumnVisibility, ColumnVisibilityConfig } from "./columnVisibilityStorage";

/** Видимость колонок конкретного агента, синхронизированная с `localStorage`. */
export const useColumnVisibility = (agentId: string, config: ColumnVisibilityConfig) => {
  const [state, setState] = useState(() => ({ agentId, visibility: readColumnVisibility(agentId, config) }));

  // Сменился агент — перечитываем его настройки.
  let current = state;
  if (state.agentId !== agentId) {
    current = { agentId, visibility: readColumnVisibility(agentId, config) };
    setState(current);
  }

  const setVisibility = useCallback(
    (next: ColumnVisibility) => {
      const normalized = normalizeVisibility(next, config);
      writeColumnVisibility(agentId, config, normalized);
      setState({ agentId, visibility: normalized });
    },
    [agentId, config],
  );

  const reset = useCallback(() => {
    clearColumnVisibility(agentId, config);
    setState({ agentId, visibility: normalizeVisibility({}, config) });
  }, [agentId, config]);

  return { visibility: current.visibility, setVisibility, reset };
};
