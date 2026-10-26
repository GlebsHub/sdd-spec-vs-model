import type { z } from "zod";
import type {
  CLIENT_SORT_FIELD,
  CLIENT_STATUS,
  ClientListResponseSchema,
  ClientSchema,
  SORT_DIRECTION,
} from "./schema";

export type Client = z.infer<typeof ClientSchema>;
export type ClientListResponse = z.infer<typeof ClientListResponseSchema>;
export type ClientStatus = (typeof CLIENT_STATUS)[keyof typeof CLIENT_STATUS];
export type ClientSortField = (typeof CLIENT_SORT_FIELD)[keyof typeof CLIENT_SORT_FIELD];
export type SortDirection = (typeof SORT_DIRECTION)[keyof typeof SORT_DIRECTION];
