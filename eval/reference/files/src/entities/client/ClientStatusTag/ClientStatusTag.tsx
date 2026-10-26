import { Tag, theme } from "antd";
import type { ClientStatus } from "@/shared/api";
import { CLIENT_STATUS_COLOR_TOKEN, CLIENT_STATUS_LABEL } from "../status";

export type ClientStatusTagProps = {
  status: ClientStatus;
};

export const ClientStatusTag = ({ status }: ClientStatusTagProps) => {
  const { token } = theme.useToken();
  return <Tag color={token[CLIENT_STATUS_COLOR_TOKEN[status]]}>{CLIENT_STATUS_LABEL[status]}</Tag>;
};
