export type LoggedRequest = {
  method: string;
  path: string;
  /** Параметры запроса как пришли, строками. Повторяющийся параметр — массив. */
  params: Record<string, string | string[]>;
  status: number;
};

let log: LoggedRequest[] = [];

export const logRequest = (request: Request, status: number): void => {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    params[key] = values.length === 1 && values[0] !== undefined ? values[0] : values;
  }
  log.push({ method: request.method, path: url.pathname, params, status });
};

/** Запросы к мок-бэкенду в порядке поступления. */
export const getRequestLog = (): readonly LoggedRequest[] => [...log];

export const clearRequestLog = (): void => {
  log = [];
};
