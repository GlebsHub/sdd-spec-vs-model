import type { ThemeConfig } from "antd";

/**
 * Токены статусов клиента (спецификация, п. 4.2). Имена в спецификации → имена токенов:
 * `status-neutral` → `colorStatusNeutral`, `status-info` → `colorStatusInfo`,
 * `status-success` → `colorStatusSuccess`, `status-muted` → `colorStatusMuted`.
 * В компонентах значения берутся из `theme.useToken()`.
 */
export type StatusTokens = {
  colorStatusNeutral: string;
  colorStatusInfo: string;
  colorStatusSuccess: string;
  colorStatusMuted: string;
};

declare module "antd/es/theme/interface" {
  interface AliasToken {
    colorStatusNeutral: string;
    colorStatusInfo: string;
    colorStatusSuccess: string;
    colorStatusMuted: string;
  }
}

const STATUS_TOKENS: StatusTokens = {
  colorStatusNeutral: "#595959",
  colorStatusInfo: "#1677ff",
  colorStatusSuccess: "#389e0d",
  colorStatusMuted: "#8c8c8c",
};

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    ...STATUS_TOKENS,
  },
  components: {
    Layout: {
      headerBg: "#ffffff",
      bodyBg: "#f5f5f5",
    },
  },
};
