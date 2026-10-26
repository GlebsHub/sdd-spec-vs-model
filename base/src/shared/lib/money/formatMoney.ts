const NBSP = "\u00A0";
const KOPECKS_PER_RUBLE = 100;

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

/**
 * Форматирует сумму в копейках: `1234567` → `12 345,67 ₽`.
 * Разделитель разрядов и пробел перед `₽` — неразрывные (U+00A0). Всегда два знака после запятой.
 * Только целочисленная арифметика. Принимает безопасное целое ≥ 0, иначе RangeError.
 */
export const formatMoney = (kopecks: number): string => {
  if (!Number.isSafeInteger(kopecks) || kopecks < 0) {
    throw new RangeError(`formatMoney expects a non-negative safe integer of kopecks, got ${String(kopecks)}`);
  }
  const rubles = Math.trunc(kopecks / KOPECKS_PER_RUBLE);
  const rest = kopecks % KOPECKS_PER_RUBLE;
  return `${groupThousands(String(rubles))},${String(rest).padStart(2, "0")}${NBSP}₽`;
};
