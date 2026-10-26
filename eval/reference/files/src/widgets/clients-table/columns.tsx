import { createColumnHelper } from "@tanstack/react-table";
import { CLIENT_SORT_FIELD, ClientStatusTag } from "@/entities/client";
import type { Client, ClientSortField } from "@/entities/client";
import { formatMoney } from "@/shared/lib/money";

/** Стабильные id колонок: на них ссылаются URL и localStorage. */
export const CLIENTS_TABLE_COLUMN = {
  fullName: "fullName",
  phoneMasked: "phoneMasked",
  status: "status",
  registeredAt: "registeredAt",
  commissionKopecks: "commissionKopecks",
  productsCount: "productsCount",
} as const;

export type ClientsTableColumnId = (typeof CLIENTS_TABLE_COLUMN)[keyof typeof CLIENTS_TABLE_COLUMN];

type ColumnLayout = {
  label: string;
  align: "start" | "end";
  sortField?: ClientSortField;
  defaultVisible: boolean;
  required?: boolean;
};

/** Порядок колонок фиксированный (п. 4.1). */
export const CLIENTS_TABLE_COLUMNS: Record<ClientsTableColumnId, ColumnLayout> = {
  fullName: { label: "ФИО", align: "start", sortField: CLIENT_SORT_FIELD.fullName, defaultVisible: true, required: true },
  phoneMasked: { label: "Телефон", align: "start", defaultVisible: true },
  status: { label: "Статус", align: "start", defaultVisible: true },
  registeredAt: { label: "Дата регистрации", align: "start", sortField: CLIENT_SORT_FIELD.registeredAt, defaultVisible: true },
  commissionKopecks: {
    label: "Комиссия",
    align: "end",
    sortField: CLIENT_SORT_FIELD.commissionKopecks,
    defaultVisible: true,
  },
  productsCount: { label: "Продуктов", align: "end", defaultVisible: false },
};

export const CLIENTS_TABLE_COLUMN_IDS = Object.values(CLIENTS_TABLE_COLUMN);

export const CLIENTS_TABLE_DEFAULT_VISIBILITY: Record<ClientsTableColumnId, boolean> = Object.fromEntries(
  CLIENTS_TABLE_COLUMN_IDS.map((id) => [id, CLIENTS_TABLE_COLUMNS[id].defaultVisible]),
  // Ключи — ровно CLIENTS_TABLE_COLUMN_IDS.
) as Record<ClientsTableColumnId, boolean>;

/** `ДД.ММ.ГГГГ` в часовом поясе пользователя. */
const dateFormatter = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
const integerFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

const column = createColumnHelper<Client>();

export const clientsTableColumns = [
  column.accessor("fullName", { id: CLIENTS_TABLE_COLUMN.fullName, header: CLIENTS_TABLE_COLUMNS.fullName.label }),
  column.accessor("phoneMasked", { id: CLIENTS_TABLE_COLUMN.phoneMasked, header: CLIENTS_TABLE_COLUMNS.phoneMasked.label }),
  column.accessor("status", {
    id: CLIENTS_TABLE_COLUMN.status,
    header: CLIENTS_TABLE_COLUMNS.status.label,
    cell: (info) => <ClientStatusTag status={info.getValue()} />,
  }),
  column.accessor("registeredAt", {
    id: CLIENTS_TABLE_COLUMN.registeredAt,
    header: CLIENTS_TABLE_COLUMNS.registeredAt.label,
    cell: (info) => dateFormatter.format(new Date(info.getValue())),
  }),
  column.accessor("commissionKopecks", {
    id: CLIENTS_TABLE_COLUMN.commissionKopecks,
    header: CLIENTS_TABLE_COLUMNS.commissionKopecks.label,
    cell: (info) => formatMoney(info.getValue()),
  }),
  column.accessor("productsCount", {
    id: CLIENTS_TABLE_COLUMN.productsCount,
    header: CLIENTS_TABLE_COLUMNS.productsCount.label,
    cell: (info) => integerFormatter.format(info.getValue()),
  }),
];
