import type { ZodType } from "zod";
import { API_BASE_URL } from "../config";
import { ContractError, HttpError, NetworkError } from "./errors";

export type QueryParams = Record<string, string | number | undefined>;

export type GetOptions<T> = {
  schema: ZodType<T>;
  params?: QueryParams;
  signal?: AbortSignal;
};

const buildUrl = (path: string, params: QueryParams = {}): string => {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

/**
 * GET-запрос к API. Ответ всегда проверяется схемой.
 * Ошибки: HttpError (не 2xx), NetworkError (сбой сети или не JSON), ContractError (ответ не по схеме).
 * Параметры со значением undefined не передаются. Массивы вызывающий код сериализует сам.
 */
export const get = async <T>(path: string, { schema, params, signal }: GetOptions<T>): Promise<T> => {
  const url = buildUrl(path, params);

  let response: Response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new NetworkError(url, { cause: error });
  }

  if (!response.ok) {
    throw new HttpError(response.status, url);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new NetworkError(url, { cause: error });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ContractError(url, result.error);
  }
  return result.data;
};

export const http = { get };
