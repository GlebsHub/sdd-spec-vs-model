import type { QueryClient } from "@tanstack/react-query";
import { ClientsSearchSchema, clientQueries, toListParams } from "@/entities/client";
import type { ClientListParams, ClientsSearch } from "@/entities/client";

/**
 * Опции маршрута `/clients`: параметры URL проверяются схемой (некорректные → по умолчанию),
 * первая порция предзагружается без ожидания, чтобы страница сразу показала скелетон.
 */
export const clientsRouteOptions = {
  validateSearch: (search: Record<string, unknown>): ClientsSearch => ClientsSearchSchema.parse(search),
  loaderDeps: ({ search }: { search: ClientsSearch }): ClientListParams => toListParams(search),
  loader: ({ context, deps }: { context: { queryClient: QueryClient }; deps: ClientListParams }): void => {
    // Ошибку покажет таблица через useClientList; здесь только ранний старт запроса.
    context.queryClient.infiniteQuery(clientQueries.list(deps)).catch(() => undefined);
  },
};
