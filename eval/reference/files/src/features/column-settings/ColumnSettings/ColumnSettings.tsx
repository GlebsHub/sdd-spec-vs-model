import { SettingOutlined } from "@ant-design/icons";
import { Button, Checkbox, Flex, Popover } from "antd";
import { useState } from "react";
import type { ColumnVisibility } from "../columnVisibilityStorage";

export type ColumnSettingsColumn = {
  id: string;
  label: string;
  /** Колонку нельзя скрыть: переключатель не показывается. */
  required?: boolean;
};

export type ColumnSettingsProps = {
  columns: readonly ColumnSettingsColumn[];
  visibility: ColumnVisibility;
  onChange: (visibility: ColumnVisibility) => void;
  onReset: () => void;
};

export const ColumnSettings = ({ columns, visibility, onChange, onReset }: ColumnSettingsProps) => {
  const [open, setOpen] = useState(false);

  const content = (
    <Flex vertical gap="small" role="group" aria-label="Видимые колонки">
      {columns
        .filter((column) => !column.required)
        .map((column) => (
          <Checkbox
            key={column.id}
            checked={visibility[column.id] ?? true}
            onChange={(event) => {
              onChange({ ...visibility, [column.id]: event.target.checked });
            }}
          >
            {column.label}
          </Checkbox>
        ))}
      <Button size="small" onClick={onReset}>
        По умолчанию
      </Button>
    </Flex>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" open={open} onOpenChange={setOpen}>
      <Button icon={<SettingOutlined aria-hidden />} aria-expanded={open}>
        Настроить колонки
      </Button>
    </Popover>
  );
};
