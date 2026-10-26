import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { useCallback } from "react";
import { isHttpError } from "@/shared/api";
import type { Client, ClientListResponse } from "@/shared/api";
import { clientQueries } from "./queries";
import type { ClientListParams } from "./types";

const selectList = (data: InfiniteData<ClientListResponse>) => ({
  clients: data.pages.flatMap((page) => page.items),
  total: data.pages[0]?.total ?? 0,
});

export type ClientList = {
  clients: Client[];
  total: number | undefined;
  /** Нет данных, идёт запрос первой порции. */
  isInitialLoading: boolean;
  /** Показаны данные прежних параметров, идёт запрос новых. */
  isPlaceholderData: boolean;
  isError: boolean;
  isForbidden: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  /** Повтор после ошибки первой порции. */
  retry: () => void;
  /** Повтор только догрузки. */
  retryNextPage: () => void;
};

export const useClientList = (params: ClientListParams): ClientList => {
  const {
    data,
    error,
    isPending,
    isError,
    isPlaceholderData,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage: fetchNext,
    refetch,
  } = useInfiniteQuery({ ...clientQueries.list(params), select: selectList });

  const fetchNextPage = useCallback(() => {
    void fetchNext({ cancelRefetch: false });
  }, [fetchNext]);
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);
  const retryNextPage = useCallback(() => {
    void fetchNext();
  }, [fetchNext]);

  return {
    clients: data?.clients ?? [],
    total: data?.total,
    isInitialLoading: isPending && !isError,
    isPlaceholderData,
    isError: isError && !isFetchNextPageError,
    isForbidden: isHttpError(error, 403),
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    retry,
    retryNextPage,
  };
};
