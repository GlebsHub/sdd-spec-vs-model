import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "@/test";

describe("каркас приложения", () => {
  it("с корня перенаправляет на /clients", async () => {
    const { router } = await renderApp({ url: "/" });
    expect(await screen.findByRole("heading", { name: "Мои клиенты" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/clients");
  });

  it("карточка клиента: «Назад» возвращает на предыдущую страницу", async () => {
    const { router, user } = await renderApp({ url: "/clients" });
    await router.navigate({ to: "/clients/$clientId", params: { clientId: "42" } });
    expect(await screen.findByRole("heading", { name: "Карточка клиента" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(await screen.findByRole("heading", { name: "Мои клиенты" })).toBeInTheDocument();
  });

  it("карточка клиента без истории: «Назад» ведёт на /clients", async () => {
    const { user } = await renderApp({ url: "/clients/42" });
    await user.click(await screen.findByRole("button", { name: "Назад" }));
    expect(await screen.findByRole("heading", { name: "Мои клиенты" })).toBeInTheDocument();
  });

  it("неизвестный адрес показывает 404", async () => {
    await renderApp({ url: "/nope" });
    expect(await screen.findByText("Страница не найдена")).toBeInTheDocument();
  });
});
