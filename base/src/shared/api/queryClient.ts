import { QueryCache, QueryClient } from "@tanstack/react-query";
import { isHttpError } from "./errors";

type CreateQueryClientOptions = {
  /** Глобальный обработчик 401: сессия истекла. */
  onUnauthorized?: () => void;
};

/**
 * Значения по умолчанию заданы явно и нейтрально. Свежесть данных конкретного запроса
 * задаётся в его queryOptions. Автоповтора нет: повтор запускает пользователь.
 */
export const createQueryClient = ({ onUnauthorized }: CreateQueryClientOptions = {}): QueryClient =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isHttpError(error, 401)) {
          onUnauthorized?.();
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 10 * 60 * 1000,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
