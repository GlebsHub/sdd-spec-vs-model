import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { Layout as AntLayout, Flex, Menu, Typography, theme } from "antd";
import { useCurrentAgent } from "@/shared/lib/session";
import styles from "./Layout.module.css";

const MENU_KEY = {
  clients: "clients",
} as const;

export const Layout = () => {
  const { token } = theme.useToken();
  const agent = useCurrentAgent();
  const { pathname } = useLocation();
  const selectedKeys = pathname.startsWith("/clients") ? [MENU_KEY.clients] : [];

  return (
    <AntLayout className={styles.root}>
      <AntLayout.Header className={styles.header} style={{ paddingInline: token.paddingLG }}>
        <Flex align="center" gap="large" className={styles.headerContent}>
          <Typography.Text strong>Агентский кабинет</Typography.Text>
          <Menu
            mode="horizontal"
            selectedKeys={selectedKeys}
            className={styles.menu}
            items={[{ key: MENU_KEY.clients, label: <Link to="/clients">Мои клиенты</Link> }]}
          />
          <Typography.Text type="secondary">{agent.name}</Typography.Text>
        </Flex>
      </AntLayout.Header>
      <AntLayout.Content className={styles.content} style={{ padding: token.paddingLG }}>
        <Outlet />
      </AntLayout.Content>
    </AntLayout>
  );
};
