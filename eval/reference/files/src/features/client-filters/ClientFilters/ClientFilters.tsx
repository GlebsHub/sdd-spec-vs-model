import { Button, DatePicker, Flex, Input, Select, Typography } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useId, useState } from "react";
import { CLIENT_STATUS_OPTIONS } from "@/entities/client";
import type { ClientStatus } from "@/entities/client";
import { SEARCH_DEBOUNCE_MS } from "../constants";
import { useDebouncedCallback } from "../useDebouncedCallback";
import styles from "./ClientFilters.module.css";

const API_DATE_FORMAT = "YYYY-MM-DD";
const DISPLAY_DATE_FORMAT = "DD.MM.YYYY";

export type ClientFiltersValue = {
  q: string | undefined;
  status: ClientStatus[];
  from: string | undefined;
  to: string | undefined;
};

export type ClientFiltersChangeOptions = {
  /** Заменить запись истории вместо новой: для текстового поиска. */
  replace: boolean;
};

export type ClientFiltersProps = {
  value: ClientFiltersValue;
  onChange: (patch: Partial<ClientFiltersValue>, options: ClientFiltersChangeOptions) => void;
  /** Показывать «Сбросить фильтры». */
  canReset: boolean;
  onReset: () => void;
};

const toDayjs = (value: string | undefined): Dayjs | null => (value ? dayjs(value, API_DATE_FORMAT) : null);

export const ClientFilters = ({ value, onChange, canReset, onReset }: ClientFiltersProps) => {
  const searchId = useId();
  const statusId = useId();
  const periodId = useId();
  const periodLabelId = useId();
  const [searchInput, setSearchInput] = useState(value.q ?? "");
  const [syncedQ, setSyncedQ] = useState(value.q);

  // Поиск изменили снаружи (сброс, «назад», ссылка) — показываем значение из URL.
  if (value.q !== syncedQ) {
    setSyncedQ(value.q);
    setSearchInput(value.q ?? "");
  }

  const debouncedSearch = useDebouncedCallback((q: string) => {
    onChange({ q: q === "" ? undefined : q }, { replace: true });
  }, SEARCH_DEBOUNCE_MS);

  useEffect(() => debouncedSearch.cancel, [debouncedSearch]);

  const handleReset = () => {
    debouncedSearch.cancel();
    onReset();
  };

  return (
    <Flex wrap gap="middle" align="flex-end">
      <Flex vertical gap="small" className={styles.search}>
        <label htmlFor={searchId}>Поиск по ФИО</label>
        <Input
          id={searchId}
          allowClear
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            debouncedSearch.run(event.target.value);
          }}
        />
      </Flex>
      <Flex vertical gap="small" className={styles.status}>
        <label htmlFor={statusId}>Статус</label>
        <Select<ClientStatus[]>
          id={statusId}
          mode="multiple"
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          options={CLIENT_STATUS_OPTIONS}
          value={value.status}
          onChange={(status) => {
            onChange({ status }, { replace: false });
          }}
        />
      </Flex>
      <Flex vertical gap="small" role="group" aria-labelledby={periodLabelId}>
        <Typography.Text id={periodLabelId}>
          <label htmlFor={periodId}>Период регистрации</label>
        </Typography.Text>
        <DatePicker.RangePicker
          id={{ start: periodId }}
          allowEmpty={[true, true]}
          format={DISPLAY_DATE_FORMAT}
          placeholder={["с", "по"]}
          value={[toDayjs(value.from), toDayjs(value.to)]}
          onChange={(range) => {
            onChange(
              { from: range?.[0]?.format(API_DATE_FORMAT), to: range?.[1]?.format(API_DATE_FORMAT) },
              { replace: false },
            );
          }}
        />
      </Flex>
      {canReset && <Button onClick={handleReset}>Сбросить фильтры</Button>}
    </Flex>
  );
};
