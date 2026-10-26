import { describe, expect, it } from "vitest";
import { formatMoney } from "./formatMoney";

const NBSP = "\u00A0";

describe("formatMoney", () => {
  it.each([
    [1234567, `12${NBSP}345,67${NBSP}₽`],
    [0, `0,00${NBSP}₽`],
    [5, `0,05${NBSP}₽`],
    [99, `0,99${NBSP}₽`],
    [100, `1,00${NBSP}₽`],
    [10, `0,10${NBSP}₽`],
    [99999, `999,99${NBSP}₽`],
    [100000, `1${NBSP}000,00${NBSP}₽`],
    [100000000, `1${NBSP}000${NBSP}000,00${NBSP}₽`],
    [Number.MAX_SAFE_INTEGER, `90${NBSP}071${NBSP}992${NBSP}547${NBSP}409,91${NBSP}₽`],
  ])("%i копеек → %s", (kopecks, expected) => {
    expect(formatMoney(kopecks)).toBe(expected);
  });

  it("использует неразрывные пробелы, а не обычные", () => {
    expect(formatMoney(1234567)).not.toContain(" ");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "отклоняет %s",
    (value) => {
      expect(() => formatMoney(value)).toThrow(RangeError);
    },
  );
});
