import { infiniteQueryOptions, keepPreviousData } from "@tanstack/react-query";
import { clientKeys } from "@/shared/api";
import { fetchClientsPage } from "./api";
import type { ClientListParams } from "./types";

/** Данные списка свежие 60 секунд: при возврате в этот срок повторного запроса нет (п. 9.2). */
export const CLIENT_LIST_STALE_TIME = 60 * 1000;

export const clientQueries = {
  list: (params: ClientListParams) =>
    infiniteQueryOptions({
      queryKey: clientKeys.list(params),
      queryFn: ({ pageParam, signal }) => fetchClientsPage(params, pageParam, signal),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: CLIENT_LIST_STALE_TIME,
      placeholderData: keepPreviousData,
    }),
};
