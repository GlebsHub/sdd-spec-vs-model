import { QueryClientProvider } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { App as AntApp, ConfigProvider } from "antd";
import ruRU from "antd/locale/ru_RU";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { appTheme } from "@/shared/ui";
import type { AppRouter } from "./router";
import "./styles.css";

dayjs.locale("ru");

export type AppProps = {
  queryClient: QueryClient;
  router: AppRouter;
};

export const App = ({ queryClient, router }: AppProps) => (
  <ConfigProvider theme={appTheme} locale={ruRU}>
    <AntApp className="app-root">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AntApp>
  </ConfigProvider>
);
