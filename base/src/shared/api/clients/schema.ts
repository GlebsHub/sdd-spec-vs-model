import { z } from "zod";

/** Статусы клиента. Тексты и цвета — в спецификации, п. 4.2. */
export const CLIENT_STATUS = {
  LEAD: "LEAD",
  ACCOUNT_OPENED: "ACCOUNT_OPENED",
  FUNDED: "FUNDED",
  INACTIVE: "INACTIVE",
} as const;

/** Поля, по которым сервер умеет сортировать. */
export const CLIENT_SORT_FIELD = {
  registeredAt: "registeredAt",
  fullName: "fullName",
  commissionKopecks: "commissionKopecks",
} as const;

export const SORT_DIRECTION = {
  asc: "asc",
  desc: "desc",
} as const;

export const ClientStatusSchema = z.enum(CLIENT_STATUS);

export const ClientSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  phoneMasked: z.string(),
  status: ClientStatusSchema,
  registeredAt: z.iso.datetime({ offset: true }),
  commissionKopecks: z.int().nonnegative(),
  productsCount: z.int().nonnegative(),
});

/** Ответ GET /api/agent/clients. */
export const ClientListResponseSchema = z.object({
  items: z.array(ClientSchema),
  nextCursor: z.string().nullable(),
  total: z.int().nonnegative(),
});
