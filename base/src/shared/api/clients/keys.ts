/**
 * Фабрика query-ключей клиентов. Ключ списка содержит все параметры, от которых зависит ответ.
 * Тип параметров списка задаёт код, который строит запрос.
 */
export const clientKeys = {
  all: ["clients"] as const,
  lists: () => [...clientKeys.all, "list"] as const,
  list: <TParams extends object>(params: TParams) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, "detail"] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};
