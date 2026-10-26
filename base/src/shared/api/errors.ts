import type { ZodError } from "zod";

/** Сервер ответил статусом вне диапазона 2xx. */
export class HttpError extends Error {
  override readonly name = "HttpError";
  readonly status: number;

  constructor(status: number, url: string) {
    super(`HTTP ${String(status)} for ${url}`);
    this.status = status;
  }
}

/** Запрос не дошёл до сервера или ответ не удалось прочитать. */
export class NetworkError extends Error {
  override readonly name = "NetworkError";

  constructor(url: string, options?: { cause?: unknown }) {
    super(`Network error for ${url}`, options);
  }
}

/** Ответ получен, но не соответствует контракту (Zod-схеме). */
export class ContractError extends Error {
  override readonly name = "ContractError";
  readonly issues: ZodError["issues"];

  constructor(url: string, error: ZodError) {
    super(`Response of ${url} does not match the contract`, { cause: error });
    this.issues = error.issues;
  }
}

export const isHttpError = (error: unknown, status?: number): error is HttpError =>
  error instanceof HttpError && (status === undefined || error.status === status);
