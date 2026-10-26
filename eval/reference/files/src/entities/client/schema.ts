import { z } from "zod";
import { CLIENT_SORT_FIELD, CLIENT_STATUS, ClientStatusSchema, SORT_DIRECTION } from "@/shared/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isCalendarDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const SORT_FIELDS = Object.values(CLIENT_SORT_FIELD);
const SORT_DIRECTIONS = Object.values(SORT_DIRECTION);
const STATUSES = Object.values(CLIENT_STATUS);

/** Роутер разбирает значения как JSON: `q=123` приходит числом. Приводим скаляры к строке. */
const scalarAsString = z.union([z.string(), z.number(), z.boolean()]).transform(String);

const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

/** Сортировка в формате `поле:направление`. */
export const ClientSortSchema = z.object({
  field: z.enum(SORT_FIELDS),
  direction: z.enum(SORT_DIRECTIONS),
});

/**
 * Параметры адресной строки раздела (п. 9.1). Некорректное значение любого параметра
 * превращается в «не задан», страница не падает. В `status` неизвестные значения отбрасываются.
 */
export const ClientsSearchSchema = z.object({
  q: optional(scalarAsString),
  status: optional(
    scalarAsString.transform((value) => {
      const known = new Set(value.split(",").filter((item) => (STATUSES as string[]).includes(item)));
      const normalized = STATUSES.filter((status) => known.has(status));
      return normalized.length > 0 ? normalized.join(",") : undefined;
    }),
  ),
  from: optional(scalarAsString.refine(isCalendarDate)),
  to: optional(scalarAsString.refine(isCalendarDate)),
  sort: optional(
    scalarAsString.refine((value) => {
      const [field = "", direction = "", ...rest] = value.split(":");
      return rest.length === 0 && (SORT_FIELDS as string[]).includes(field) && (SORT_DIRECTIONS as string[]).includes(direction);
    }),
  ),
});

/** Параметры запроса списка (п. 3.1) без `cursor` и `limit`. От них зависит ответ — они входят в query-ключ. */
export const ClientListParamsSchema = z.object({
  q: z.string().min(2).optional(),
  status: z.array(ClientStatusSchema).min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sort: ClientSortSchema,
});
