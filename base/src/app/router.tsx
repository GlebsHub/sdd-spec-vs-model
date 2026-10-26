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
import { ClientsPage } from "@/pages/clients";
import { NotFoundPage } from "@/pages/not-found";
import { Layout } from "./Layout/Layout";

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
  });

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
