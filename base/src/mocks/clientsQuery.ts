import { CLIENT_SORT_FIELD, CLIENT_STATUS, SORT_DIRECTION } from "@/shared/api";
import type { Client, ClientSortField, ClientStatus, SortDirection } from "@/shared/api";

export const MAX_LIMIT = 100;
export const MIN_QUERY_LENGTH = 2;
export const DEFAULT_SORT = { field: CLIENT_SORT_FIELD.registeredAt, direction: SORT_DIRECTION.desc } as const;

export type ClientsQuery = {
  limit: number;
  cursor: string | undefined;
  q: string | undefined;
  status: ClientStatus[] | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
  sort: { field: ClientSortField; direction: SortDirection };
};

export class BadRequestError extends Error {
  override readonly name = "BadRequestError";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isCalendarDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const single = (params: URLSearchParams, name: string): string | undefined => {
  const values = params.getAll(name);
  if (values.length > 1) {
    throw new BadRequestError(`Parameter "${name}" must be passed once`);
  }
  return values[0];
};

const isStatus = (value: string): value is ClientStatus => Object.hasOwn(CLIENT_STATUS, value);
const isSortField = (value: string): value is ClientSortField => Object.hasOwn(CLIENT_SORT_FIELD, value);
const isDirection = (value: string): value is SortDirection => Object.hasOwn(SORT_DIRECTION, value);

/** Разбирает параметры строго по контракту. Нарушение → BadRequestError (400). */
export const parseClientsQuery = (params: URLSearchParams): ClientsQuery => {
  const rawLimit = single(params, "limit");
  if (rawLimit === undefined || !/^\d+$/.test(rawLimit)) {
    throw new BadRequestError(`"limit" is required and must be an integer 1..${String(MAX_LIMIT)}`);
  }
  const limit = Number(rawLimit);
  if (limit < 1 || limit > MAX_LIMIT) {
    throw new BadRequestError(`"limit" must be within 1..${String(MAX_LIMIT)}`);
  }

  const cursor = single(params, "cursor");
  if (cursor === "") {
    throw new BadRequestError(`"cursor" must not be empty; omit it for the first page`);
  }

  const rawQ = single(params, "q");
  let q: string | undefined;
  if (rawQ !== undefined) {
    q = rawQ.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      throw new BadRequestError(`"q" must contain at least ${String(MIN_QUERY_LENGTH)} characters after trim`);
    }
  }

  const rawStatus = single(params, "status");
  let status: ClientStatus[] | undefined;
  if (rawStatus !== undefined) {
    const parts = rawStatus.split(",");
    status = parts.map((part) => {
      if (!isStatus(part)) {
        throw new BadRequestError(`Unknown status "${part}"`);
      }
      return part;
    });
  }

  const dateFrom = single(params, "dateFrom");
  const dateTo = single(params, "dateTo");
  for (const [name, value] of [
    ["dateFrom", dateFrom],
    ["dateTo", dateTo],
  ] as const) {
    if (value !== undefined && !isCalendarDate(value)) {
      throw new BadRequestError(`"${name}" must be a date in YYYY-MM-DD format`);
    }
  }

  const rawSort = single(params, "sort");
  let sort: ClientsQuery["sort"] = DEFAULT_SORT;
  if (rawSort !== undefined) {
    const [field = "", direction = "", ...extra] = rawSort.split(":");
    if (!isSortField(field) || !isDirection(direction) || extra.length > 0) {
      throw new BadRequestError(`"sort" must be <field>:<asc|desc>, fields: ${Object.keys(CLIENT_SORT_FIELD).join(", ")}`);
    }
    sort = { field, direction };
  }

  return { limit, cursor, q, status, dateFrom, dateTo, sort };
};

/** Отпечаток фильтров и сортировки: курсор действителен только для того же набора. */
export const queryFingerprint = ({ q, status, dateFrom, dateTo, sort }: ClientsQuery): string =>
  JSON.stringify([q?.toLocaleLowerCase("ru") ?? null, status ? [...status].sort() : null, dateFrom ?? null, dateTo ?? null, sort.field, sort.direction]);

const collator = new Intl.Collator("ru");

const compareBy = (field: ClientSortField) => (a: Client, b: Client): number => {
  switch (field) {
    case CLIENT_SORT_FIELD.fullName:
      return collator.compare(a.fullName, b.fullName);
    case CLIENT_SORT_FIELD.registeredAt:
      return a.registeredAt.localeCompare(b.registeredAt);
    case CLIENT_SORT_FIELD.commissionKopecks:
      return a.commissionKopecks - b.commissionKopecks;
  }
};

/** Фильтрация и сортировка, как на бэкенде. Порядок стабилен: при равенстве — по id. */
export const selectClients = (clients: readonly Client[], query: ClientsQuery): Client[] => {
  const needle = query.q?.toLocaleLowerCase("ru");
  const statuses = query.status ? new Set(query.status) : undefined;
  const filtered = clients.filter((client) => {
    const date = client.registeredAt.slice(0, 10);
    return (
      (needle === undefined || client.fullName.toLocaleLowerCase("ru").includes(needle)) &&
      (statuses === undefined || statuses.has(client.status)) &&
      (query.dateFrom === undefined || date >= query.dateFrom) &&
      (query.dateTo === undefined || date <= query.dateTo)
    );
  });
  const compare = compareBy(query.sort.field);
  const sign = query.sort.direction === SORT_DIRECTION.asc ? 1 : -1;
  return filtered.sort((a, b) => sign * compare(a, b) || a.id.localeCompare(b.id));
};
