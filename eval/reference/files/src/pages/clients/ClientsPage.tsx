import { getRouteApi } from "@tanstack/react-router";
import { Flex, Result, Typography } from "antd";
import { useMemo } from "react";
import { formatSort, formatStatuses, hasFilters, parseSort, parseStatuses, toListParams, useClientList } from "@/entities/client";
import type { ClientSort, ClientsSearch } from "@/entities/client";
import { ClientFilters } from "@/features/client-filters";
import type { ClientFiltersChangeOptions, ClientFiltersValue } from "@/features/client-filters";
import { ColumnSettings, useColumnVisibility } from "@/features/column-settings";
import type { ColumnSettingsColumn, ColumnVisibilityConfig } from "@/features/column-settings";
import {
  CLIENTS_TABLE_COLUMN,
  CLIENTS_TABLE_COLUMNS,
  CLIENTS_TABLE_COLUMN_IDS,
  CLIENTS_TABLE_DEFAULT_VISIBILITY,
  ClientsTable,
} from "@/widgets/clients-table";
import { useCurrentAgent } from "@/shared/lib/session";
import styles from "./ClientsPage.module.css";

const routeApi = getRouteApi("/clients");

const COLUMN_VISIBILITY_CONFIG: ColumnVisibilityConfig = {
  scope: "clients-table",
  defaults: CLIENTS_TABLE_DEFAULT_VISIBILITY,
  alwaysVisible: [CLIENTS_TABLE_COLUMN.fullName],
};

const SETTINGS_COLUMNS: ColumnSettingsColumn[] = CLIENTS_TABLE_COLUMN_IDS.map((id) => ({
  id,
  label: CLIENTS_TABLE_COLUMNS[id].label,
  required: CLIENTS_TABLE_COLUMNS[id].required,
}));

const totalFormatter = new Intl.NumberFormat("ru-RU");

const toSearchPatch = (patch: Partial<ClientFiltersValue>): Partial<ClientsSearch> => {
  const next: Partial<ClientsSearch> = {};
  if ("q" in patch) next.q = patch.q;
  if ("status" in patch) next.status = formatStatuses(patch.status ?? []);
  if ("from" in patch) next.from = patch.from;
  if ("to" in patch) next.to = patch.to;
  return next;
};

const PageTitle = ({ total }: { total: number | undefined }) => (
  <Flex align="baseline" gap="small">
    <Typography.Title level={2} className={styles.title}>
      Мои клиенты
    </Typography.Title>
    {total !== undefined && (
      <Typography.Text type="secondary" className={styles.counter}>
        {totalFormatter.format(total)}
      </Typography.Text>
    )}
  </Flex>
);

export const ClientsPage = () => {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const agent = useCurrentAgent();
  const params = useMemo(() => toListParams(search), [search]);
  const list = useClientList(params);
  const columns = useColumnVisibility(agent.id, COLUMN_VISIBILITY_CONFIG);
  const sort = parseSort(search.sort);

  const updateSearch = (patch: Partial<ClientsSearch>, replace: boolean) => {
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace });
  };

  const handleFiltersChange = (patch: Partial<ClientFiltersValue>, { replace }: ClientFiltersChangeOptions) => {
    updateSearch(toSearchPatch(patch), replace);
  };

  const handleResetFilters = () => {
    void navigate({ search: (prev) => ({ sort: prev.sort }) });
  };

  const handleSortChange = (next: ClientSort) => {
    updateSearch({ sort: formatSort(next) }, false);
  };

  const handleOpenClient = (clientId: string) => {
    void navigate({ to: "/clients/$clientId", params: { clientId } });
  };

  if (list.isForbidden) {
    return (
      <Flex vertical gap="middle">
        <PageTitle total={undefined} />
        <Result status="403" title="Раздел недоступен. Обратитесь к персональному менеджеру" />
      </Flex>
    );
  }

  const filtered = hasFilters(params);

  return (
    <Flex vertical gap="middle" className={styles.page}>
      <PageTitle total={list.total} />
      <Flex justify="space-between" align="flex-end" gap="middle" wrap>
        <ClientFilters
          value={{ q: search.q, status: parseStatuses(search.status), from: search.from, to: search.to }}
          onChange={handleFiltersChange}
          canReset={filtered}
          onReset={handleResetFilters}
        />
        <ColumnSettings
          columns={SETTINGS_COLUMNS}
          visibility={columns.visibility}
          onChange={columns.setVisibility}
          onReset={columns.reset}
        />
      </Flex>
      <ClientsTable
        list={list}
        sort={sort}
        onSortChange={handleSortChange}
        columnVisibility={columns.visibility}
        filtered={filtered}
        onResetFilters={handleResetFilters}
        onOpenClient={handleOpenClient}
      />
    </Flex>
  );
};
