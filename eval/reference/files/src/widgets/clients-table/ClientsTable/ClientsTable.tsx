import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons";
import { useElementScrollRestoration } from "@tanstack/react-router";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type { Header } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button, Empty, Flex, Result, Skeleton, Spin, Typography } from "antd";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { SORT_DIRECTION, nextSort } from "@/entities/client";
import type { Client, ClientList, ClientSort } from "@/entities/client";
import type { ColumnVisibility } from "@/features/column-settings";
import { CLIENTS_TABLE_COLUMNS, clientsTableColumns } from "../columns";
import type { ClientsTableColumnId } from "../columns";
import { CLIENTS_TABLE_SCROLL_ID, OVERSCAN, PREFETCH_THRESHOLD, ROW_HEIGHT, SKELETON_ROWS } from "../layout";
import styles from "./ClientsTable.module.css";


export type ClientsTableProps = {
  list: ClientList;
  sort: ClientSort;
  onSortChange: (sort: ClientSort) => void;
  columnVisibility: ColumnVisibility;
  /** Задан ли хотя бы один фильтр: определяет вид пустого состояния. */
  filtered: boolean;
  onResetFilters: () => void;
  onOpenClient: (id: string) => void;
};

const cellClass = (id: string, extra?: string): string => {
  const layout = CLIENTS_TABLE_COLUMNS[id as ClientsTableColumnId];
  return [styles.cell, styles[id], layout.align === "end" ? styles.alignEnd : undefined, extra].filter(Boolean).join(" ");
};

const SortHeader = ({ header, sort, onSortChange }: { header: Header<Client, unknown>; sort: ClientSort; onSortChange: (sort: ClientSort) => void }) => {
  // id колонок — ключи CLIENTS_TABLE_COLUMNS (columns.tsx).
  const layout = CLIENTS_TABLE_COLUMNS[header.column.id as ClientsTableColumnId];
  const sortField = layout.sortField;
  const active = sortField !== undefined && sort.field === sortField;
  const ariaSort = active ? (sort.direction === SORT_DIRECTION.asc ? "ascending" : "descending") : undefined;

  return (
    <th role="columnheader" scope="col" aria-sort={ariaSort} className={cellClass(header.column.id)}>
      {sortField === undefined ? (
        <span className={styles.headerLabel}>{layout.label}</span>
      ) : (
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => {
            onSortChange(nextSort(sort, sortField));
          }}
        >
          {layout.label}
          {active && sort.direction === SORT_DIRECTION.asc ? (
            <CaretUpOutlined aria-hidden />
          ) : (
            <CaretDownOutlined aria-hidden className={active ? undefined : styles.sortIconInactive} />
          )}
        </button>
      )}
    </th>
  );
};

export const ClientsTable = ({
  list,
  sort,
  onSortChange,
  columnVisibility,
  filtered,
  onResetFilters,
  onOpenClient,
}: ClientsTableProps) => {
  const { clients, total, isInitialLoading, isPlaceholderData, isError, isFetchingNextPage, isFetchNextPageError, hasNextPage, fetchNextPage } = list;
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollEntry = useElementScrollRestoration({ id: CLIENTS_TABLE_SCROLL_ID });

  const table = useReactTable({
    data: clients,
    columns: clientsTableColumns,
    state: { columnVisibility },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (client) => client.id,
    manualSorting: true,
    manualFiltering: true,
  });
  const rows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
    initialOffset: scrollEntry?.scrollY,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualRows.at(-1)?.index ?? -1;

  useEffect(() => {
    if (
      rows.length > 0 &&
      rows.length - 1 - lastVisibleIndex <= PREFETCH_THRESHOLD &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetchNextPageError &&
      !isPlaceholderData
    ) {
      fetchNextPage();
    }
  }, [rows.length, lastVisibleIndex, hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage]);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onOpenClient(id);
    }
  };

  const headerGroup = table.getHeaderGroups()[0];
  const visibleColumns = table.getVisibleLeafColumns();
  const showFirstPageError = isError && clients.length === 0;
  const showEmpty = !isInitialLoading && !showFirstPageError && total === 0;
  const showRows = !isInitialLoading && !showFirstPageError && !showEmpty;

  return (
    <div className={styles.root}>
      <div ref={scrollRef} className={styles.scroller} data-scroll-restoration-id={CLIENTS_TABLE_SCROLL_ID}>
        <table
          role="table"
          aria-label="Клиенты"
          aria-rowcount={total === undefined ? -1 : total + 1}
          aria-busy={isInitialLoading || isFetchingNextPage}
          className={styles.table}
        >
          <thead role="rowgroup" className={styles.head}>
            <tr role="row" aria-rowindex={1} className={styles.row}>
              {headerGroup?.headers.map((header) => (
                <SortHeader key={header.id} header={header} sort={sort} onSortChange={onSortChange} />
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup" className={styles.body} style={showRows ? { height: virtualizer.getTotalSize() } : undefined}>
            {isInitialLoading &&
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={index} role="row" className={styles.row} style={{ height: ROW_HEIGHT }}>
                  {visibleColumns.map((column) => (
                    <td key={column.id} role="cell" className={cellClass(column.id)}>
                      <Skeleton.Input active size="small" block />
                    </td>
                  ))}
                </tr>
              ))}
            {showRows &&
              virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index];
                if (!row) {
                  return null;
                }
                return (
                  <tr
                    key={row.id}
                    role="row"
                    tabIndex={0}
                    aria-rowindex={virtualRow.index + 2}
                    className={[styles.row, styles.bodyRow, isPlaceholderData ? styles.placeholderRow : undefined].filter(Boolean).join(" ")}
                    style={{ height: ROW_HEIGHT, transform: `translateY(${String(virtualRow.start)}px)` }}
                    onClick={() => {
                      onOpenClient(row.id);
                    }}
                    onKeyDown={(event) => {
                      handleRowKeyDown(event, row.id);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} role="cell" className={cellClass(cell.column.id)}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>

        {showFirstPageError && (
          <Result
            className={styles.state}
            status="error"
            title="Не удалось загрузить клиентов"
            extra={<Button onClick={list.retry}>Повторить</Button>}
          />
        )}
        {showEmpty &&
          (filtered ? (
            <Empty className={styles.state} description="Ничего не найдено">
              <Button onClick={onResetFilters}>Сбросить фильтры</Button>
            </Empty>
          ) : (
            <Empty
              className={styles.state}
              description="У вас пока нет клиентов. Поделитесь реферальной ссылкой, чтобы пригласить первого"
            />
          ))}

        {showRows && (
          <div className={styles.footer}>
            {isFetchingNextPage && (
              <Flex role="status" gap="small" align="center">
                <Spin size="small" />
                <Typography.Text>Загружаем ещё…</Typography.Text>
              </Flex>
            )}
            {isFetchNextPageError && !isFetchingNextPage && (
              <Flex gap="middle" align="center">
                <Typography.Text type="danger">Не удалось загрузить клиентов</Typography.Text>
                <Button size="small" onClick={list.retryNextPage}>
                  Повторить
                </Button>
              </Flex>
            )}
            {!hasNextPage && !isFetchNextPageError && (
              <Typography.Text type="secondary">Показаны все клиенты</Typography.Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
