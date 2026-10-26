import type { QueryClient } from "@tanstack/react-query";
import {
  createBrowserHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { ClientCardPage } from "@/pages/client-card";
import { ClientsPage, clientsRouteOptions } from "@/pages/clients";
import { NotFoundPage } from "@/pages/not-found";
import { CLIENTS_TABLE_SCROLL_ID } from "@/widgets/clients-table";
import { Layout } from "./Layout/Layout";

/**
 * Позиции прокрутки привязаны к документу: после перезагрузки страницы они не восстанавливаются (SPEC п. 9.2),
 * а при переходах внутри приложения и «назад» — восстанавливаются (conventions §5.3).
 */
const DOCUMENT_ID = crypto.randomUUID();

export type RouterContext = {
  queryClient: QueryClient;
};

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Layout,
  notFoundComponent: NotFoundPage,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- redirect в TanStack Router выполняется через throw
    throw redirect({ to: "/clients" });
  },
});

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/clients",
  ...clientsRouteOptions,
  component: ClientsPage,
});

const clientCardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/clients/$clientId",
  component: ClientCardPage,
});

export const routeTree = rootRoute.addChildren([indexRoute, clientsRoute, clientCardRoute]);

type CreateAppRouterOptions = {
  queryClient: QueryClient;
  history?: RouterHistory;
};

export const createAppRouter = ({ queryClient, history = createBrowserHistory() }: CreateAppRouterOptions) =>
  createRouter({
    routeTree,
    history,
    context: { queryClient },
    scrollRestoration: true,
    getScrollRestorationKey: (location) => `${DOCUMENT_ID}:${location.state.__TSR_key ?? location.href}`,
    // При новом переходе (фильтры, сортировка) роутер сбрасывает эти контейнеры к началу, при «назад» — восстанавливает.
    scrollToTopSelectors: [`[data-scroll-restoration-id="${CLIENTS_TABLE_SCROLL_ID}"]`],
  });

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
