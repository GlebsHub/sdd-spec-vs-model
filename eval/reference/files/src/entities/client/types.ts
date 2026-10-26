import type { z } from "zod";
import type { ClientListParamsSchema, ClientSortSchema, ClientsSearchSchema } from "./schema";

export type ClientsSearch = z.infer<typeof ClientsSearchSchema>;
export type ClientListParams = z.infer<typeof ClientListParamsSchema>;
export type ClientSort = z.infer<typeof ClientSortSchema>;
