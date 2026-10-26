import { describe, expect, it } from "vitest";
import { ClientsSearchSchema } from "./schema";

describe("ClientsSearchSchema", () => {
  it("принимает корректные параметры", () => {
    expect(
      ClientsSearchSchema.parse({ q: "Иванов", status: "LEAD,FUNDED", from: "2026-01-01", to: "2026-03-31", sort: "fullName:asc" }),
    ).toEqual({ q: "Иванов", status: "LEAD,FUNDED", from: "2026-01-01", to: "2026-03-31", sort: "fullName:asc" });
  });

  it("некорректные значения превращает в «не задано», страница не падает", () => {
    expect(
      ClientsSearchSchema.parse({ status: "FOO", from: "2026-13-45", to: "вчера", sort: "phoneMasked:asc", q: { a: 1 } }),
    ).toEqual({ q: undefined, status: undefined, from: undefined, to: undefined, sort: undefined });
  });

  it("в статусе оставляет только известные значения в каноническом порядке", () => {
    expect(ClientsSearchSchema.parse({ status: "FUNDED,FOO,LEAD,LEAD" }).status).toBe("LEAD,FUNDED");
  });

  it("числа и булевы значения из URL приводит к строке", () => {
    expect(ClientsSearchSchema.parse({ q: 123 }).q).toBe("123");
  });
});
