import { ClientListResponseSchema, http } from "@/shared/api";
import type { ClientListResponse } from "@/shared/api";
import { CLIENT_LIST_PAGE_SIZE } from "./params";
import type { ClientListParams } from "./types";

export const CLIENTS_PATH = "/agent/clients";

export const fetchClientsPage = (
  params: ClientListParams,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<ClientListResponse> =>
  http.get(CLIENTS_PATH, {
    schema: ClientListResponseSchema,
    signal,
    params: {
      limit: CLIENT_LIST_PAGE_SIZE,
      cursor,
      q: params.q,
      status: params.status?.join(","),
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      sort: `${params.sort.field}:${params.sort.direction}`,
    },
  });
