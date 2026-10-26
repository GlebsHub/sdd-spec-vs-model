import { CLIENT_SORT_FIELD, CLIENT_STATUS, SORT_DIRECTION } from "@/shared/api";
import type { ClientSortField, ClientStatus } from "@/shared/api";
import type { ClientListParams, ClientSort, ClientsSearch } from "./types";

export const CLIENT_LIST_PAGE_SIZE = 50;
export const MIN_SEARCH_LENGTH = 2;

export const DEFAULT_CLIENT_SORT: ClientSort = {
  field: CLIENT_SORT_FIELD.registeredAt,
  direction: SORT_DIRECTION.desc,
};

const STATUSES = Object.values(CLIENT_STATUS);

export const parseSort = (value: string | undefined): ClientSort => {
  const [field, direction] = value?.split(":") ?? [];
  const isField = (Object.values(CLIENT_SORT_FIELD) as (string | undefined)[]).includes(field);
  const isDirection = (Object.values(SORT_DIRECTION) as (string | undefined)[]).includes(direction);
  // Значения проверены выше по тем же константам, из которых выведены типы.
  return isField && isDirection ? ({ field, direction } as ClientSort) : DEFAULT_CLIENT_SORT;
};

/** `поле:направление`; для сортировки по умолчанию — `undefined`, чтобы не писать её в URL. */
export const formatSort = (sort: ClientSort): string | undefined =>
  sort.field === DEFAULT_CLIENT_SORT.field && sort.direction === DEFAULT_CLIENT_SORT.direction
    ? undefined
    : `${sort.field}:${sort.direction}`;

/** Клик по заголовку (п. 6): не отсортирована → desc, desc → asc, asc → desc. */
export const nextSort = (current: ClientSort, field: ClientSortField): ClientSort => {
  if (current.field !== field || current.direction === SORT_DIRECTION.asc) {
    return { field, direction: SORT_DIRECTION.desc };
  }
  return { field, direction: SORT_DIRECTION.asc };
};

export const parseStatuses = (value: string | undefined): ClientStatus[] =>
  value ? STATUSES.filter((status) => value.split(",").includes(status)) : [];

export const formatStatuses = (statuses: readonly ClientStatus[]): string | undefined => {
  const normalized = STATUSES.filter((status) => statuses.includes(status));
  return normalized.length > 0 ? normalized.join(",") : undefined;
};

/** Поисковая строка в том виде, в котором уходит в API: от 2 символов после trim, иначе не передаётся. */
export const normalizeSearchQuery = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : undefined;
};

/** URL → параметры запроса (п. 9.1): `from` → `dateFrom`, `to` → `dateTo`. */
export const toListParams = (search: ClientsSearch): ClientListParams => {
  const statuses = parseStatuses(search.status);
  return {
    q: normalizeSearchQuery(search.q),
    status: statuses.length > 0 ? statuses : undefined,
    dateFrom: search.from,
    dateTo: search.to,
    sort: parseSort(search.sort),
  };
};

/** Задан ли хотя бы один фильтр, влияющий на запрос. Сортировка фильтром не считается. */
export const hasFilters = (params: ClientListParams): boolean =>
  params.q !== undefined || params.status !== undefined || params.dateFrom !== undefined || params.dateTo !== undefined;
