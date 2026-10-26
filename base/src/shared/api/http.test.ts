import { HttpResponse, http as mswHttp } from "msw";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { server } from "@/mocks/node";
import { ContractError, HttpError, NetworkError, http } from "@/shared/api";

const Schema = z.object({ value: z.number() });

describe("http.get", () => {
  it("возвращает ответ, прошедший схему, и не передаёт undefined-параметры", async () => {
    let received = "";
    server.use(
      mswHttp.get("/api/echo", ({ request }) => {
        received = new URL(request.url).search;
        return HttpResponse.json({ value: 1 });
      }),
    );
    await expect(http.get("/echo", { schema: Schema, params: { a: "x", b: undefined, c: 2 } })).resolves.toEqual({
      value: 1,
    });
    expect(received).toBe("?a=x&c=2");
  });

  it("бросает HttpError со статусом", async () => {
    server.use(mswHttp.get("/api/echo", () => new HttpResponse(null, { status: 403 })));
    const error: unknown = await http.get("/echo", { schema: Schema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 403 });
  });

  it("бросает ContractError, если ответ не по схеме", async () => {
    server.use(mswHttp.get("/api/echo", () => HttpResponse.json({ value: "1" })));
    await expect(http.get("/echo", { schema: Schema })).rejects.toBeInstanceOf(ContractError);
  });

  it("бросает NetworkError при сетевом сбое", async () => {
    server.use(mswHttp.get("/api/echo", () => HttpResponse.error()));
    await expect(http.get("/echo", { schema: Schema })).rejects.toBeInstanceOf(NetworkError);
  });
});
